"""Runs queued generation jobs with the existing pipeline and stores results for the job's owner.

Each job rebuilds the item folder layout the pipeline already understands in a temp dir, runs
run_photo / run_back / run_turn unchanged, then uploads the files under the owner's Storage folder.
The job row is the truth: a worker that dies leaves a lease that runs out, and the job is claimed again.
"""
import asyncio
import glob
import logging
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
import cv2
from api.credits import FREE_KINDS, CreditGate, NoCharge, charge_for
from api.item_loader import load_item
from pipeline.back import BackPhotoRejected, run_back
from pipeline import outfit
from pipeline.orchestrator import Providers, run_photo
from pipeline.run_log import RunLogger
from pipeline.turn import TURN_ORDER, TurnFailed, refs_for_item, run_turn
from pipeline.types import ItemFacts

log = logging.getLogger("wardrobe.worker")

GENERIC_FAILURE = "Something went wrong — try again"
ITEM_GONE = "That item no longer exists"
NO_GARMENT = "No garment found in the photo — lay the piece flat, in good light, and try again"

# Photo crops are only a fallback picture; full-resolution PNGs went past the bucket's 25 MB limit.
CROP_MAX_SIDE = 2048
CROP_JPEG_QUALITY = 90


class JobRejected(Exception):
    """The job can't succeed as asked (bad photo, item gone); retrying won't help. Message is for the user."""


def _sentence(message: str) -> str:
    return message[:1].upper() + message[1:] if message else GENERIC_FAILURE


def _write(path: str, data: bytes) -> str:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return path


class _Uploads:
    """Uploads made for one job, so a failed job leaves nothing behind."""
    def __init__(self, store):
        self.store, self.paths = store, []

    def put(self, path: str, local: str, content_type: str = "image/png") -> str:
        with open(local, "rb") as f:
            self.store.upload(path, f.read(), content_type)
        self.paths.append(path)
        return path

    def put_if_exists(self, path: str, local: str) -> str | None:
        return self.put(path, local) if os.path.exists(local) else None

    def put_photo_if_exists(self, path: str, local: str) -> str | None:
        """A photo (crop) as a JPEG no larger than CROP_MAX_SIDE, so it always fits the bucket."""
        image = cv2.imread(local) if os.path.exists(local) else None
        if image is None:
            return None
        scale = CROP_MAX_SIDE / max(image.shape[:2])
        if scale < 1:
            image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, CROP_JPEG_QUALITY])
        if not ok:
            return None
        self.store.upload(path, data.tobytes(), "image/jpeg")
        self.paths.append(path)
        return path


class _RecordingVision:
    """Keeps what detection returned, so an empty result can say why pieces were left out."""
    def __init__(self, vision):
        self.vision, self.detected = vision, []

    async def detect_items_with_facts(self, image_path):
        self.detected = await self.vision.detect_items_with_facts(image_path)
        return self.detected


def _nothing_found(detected) -> str:
    reasons = [d.exclusion_reason for d in detected if not d.included and d.exclusion_reason]
    return f"No garment to add: {reasons[0]}" if reasons else NO_GARMENT


def _item_id(job_id: str, piece_index: int) -> str:
    # Stable per job and piece: a retried job overwrites the same files and finds the same row.
    return str(uuid.uuid5(uuid.UUID(job_id), f"piece-{piece_index}"))


async def _garment(store, job, providers, tmp, uploads):
    user = job["user_id"]
    ext = os.path.splitext(job["input_path"])[1] or ".jpg"
    original = store.download(job["input_path"])
    photo = _write(os.path.join(tmp, "upload" + ext), original)
    output_dir = os.path.join(tmp, "out", "photo")
    logger = RunLogger(os.path.join(tmp, "run_log.jsonl"))
    given = providers(logger)
    vision = _RecordingVision(given.vision)
    try:
        # With billing on, make at most the fronts the user approved paying for (largest pieces first).
        outcome = await run_photo(photo, output_dir, Providers(vision=vision, imagegen=given.imagegen), logger,
                                  max_items=job.get("max_items"))
    except ValueError as e:
        raise JobRejected(_sentence(str(e))) from e

    item_ids, retakes = [], []
    for item_dir in sorted(glob.glob(os.path.join(output_dir, "item_*")), key=lambda d: int(d.rsplit("_", 1)[1])):
        loaded = load_item(item_dir)
        if loaded is None:
            continue
        _, result, facts = loaded
        piece = int(item_dir.rsplit("_", 1)[1])
        if not os.path.exists(os.path.join(item_dir, "generated.png")):
            retakes.append({"piece_index": piece, "reason": result.reason, "retake_instruction": result.retake_instruction})
            continue
        item_id = _item_id(job["id"], piece)
        base = f"{user}/items/{item_id}"
        store.upload(f"{base}/source{ext}", original, "image/png" if ext == ".png" else "image/jpeg")
        uploads.paths.append(f"{base}/source{ext}")
        row = {
            "id": item_id, "user_id": user, "job_id": job["id"], "piece_index": piece, "tier": result.tier,
            "facts": facts.model_dump(mode="json"), "source_path": f"{base}/source{ext}", "source_kind": "original",
            "display_path": uploads.put(f"{base}/generated.png", os.path.join(item_dir, "generated.png")),
            "crop_path": uploads.put_photo_if_exists(f"{base}/crop.jpg", os.path.join(item_dir, "crop.png")),
            "cutout_path": uploads.put_if_exists(f"{base}/cutout.png", os.path.join(item_dir, "cutout.png")),
        }
        item_ids.append(store.insert_item(row)["id"])

    quality = outcome["quality"]
    if quality.status == "ok" and not item_ids and not retakes and not outcome["failed"]:
        # Nothing detected (or everything left out): a "succeeded" job with no items looked like a hang.
        raise JobRejected(_sentence(_nothing_found(vision.detected)))
    store.remove([job["input_path"]])  # each item keeps its own copy as source
    return {"item_ids": item_ids, "quality": {"status": quality.status, "reason": quality.reason},
            "failed": outcome["failed"], "retakes": retakes, "over_limit": outcome.get("over_limit", 0)}


def _item_or_reject(store, job) -> dict:
    item = store.get_item(job["user_id"], job["item_id"])
    if item is None:
        raise JobRejected(ITEM_GONE)
    return item


def _facts_text(facts: ItemFacts) -> str:
    value = facts.visible_text.value
    return " ".join(value) if isinstance(value, list) else value


async def _back(store, job, providers, tmp, uploads):
    item = _item_or_reject(store, job)
    front = _write(os.path.join(tmp, "item", "generated.png"), store.download(item["display_path"]))
    photo = _write(os.path.join(tmp, "upload" + (os.path.splitext(job["input_path"])[1] or ".jpg")),
                   store.download(job["input_path"]))
    out = os.path.join(tmp, "item", "back")
    logger = RunLogger(os.path.join(tmp, "back_log.jsonl"))
    try:
        facts = await run_back(photo, front, out, providers(logger), logger)
    except (BackPhotoRejected, ValueError) as e:
        raise JobRejected(_sentence(str(e))) from e
    base = f"{job['user_id']}/items/{item['id']}/back/{job['id']}"
    back = {
        "generated_path": uploads.put(f"{base}/generated.png", os.path.join(out, "generated.png")),
        "cutout_path": uploads.put_if_exists(f"{base}/cutout.png", os.path.join(out, "cutout.png")),
        "crop_path": uploads.put_photo_if_exists(f"{base}/crop.jpg", os.path.join(out, "crop.png")),
        "visible_text": _facts_text(facts),
    }
    store.update_item(job["user_id"], item["id"], {"back": back})
    store.remove([job["input_path"]])
    return {"item_ids": [item["id"]]}


async def _turn(store, job, providers, tmp, uploads):
    item = _item_or_reject(store, job)
    item_dir = os.path.join(tmp, "item")
    facts = ItemFacts.model_validate(item["facts"])
    _write(os.path.join(item_dir, "generated.png"), store.download(item["display_path"]))
    if item.get("crop_path"):
        _write(os.path.join(item_dir, "crop.png"), store.download(item["crop_path"]))
    _write(os.path.join(item_dir, "facts.json"), facts.model_dump_json().encode())
    back = item.get("back") or {}
    if back.get("generated_path"):
        _write(os.path.join(item_dir, "back", "generated.png"), store.download(back["generated_path"]))
        if back.get("crop_path"):
            _write(os.path.join(item_dir, "back", "crop.png"), store.download(back["crop_path"]))
        back_facts = facts.model_copy(update={"visible_text": facts.visible_text.model_copy(update={"value": back.get("visible_text", "")})})
        _write(os.path.join(item_dir, "back", "facts.json"), back_facts.model_dump_json().encode())

    out = os.path.join(tmp, "turn")
    imagegen = providers(RunLogger(os.path.join(tmp, "turn_log.jsonl"))).imagegen
    try:
        await run_turn(refs_for_item(item_dir), out, imagegen)
    except TurnFailed as e:
        raise JobRejected(_sentence(str(e))) from e
    base = f"{job['user_id']}/items/{item['id']}/turn/{job['id']}"
    views = [{"angle": view,
              "path": uploads.put(f"{base}/{view}.png", os.path.join(out, f"{view}.png")),
              "cutout_path": uploads.put_if_exists(f"{base}/{view}_cutout.png", os.path.join(out, f"{view}_cutout.png"))}
             for view in TURN_ORDER]
    store.update_item(job["user_id"], item["id"], {"turn": {"state": "done", "views": views}})
    return {"item_ids": [item["id"]]}


# Outfit Photo: how long the person photo and its preview crops are kept (owner decision D6, proposed 24 h).
OUTFIT_SCAN_TTL = timedelta(hours=24)
MAX_OUTFIT_CANDIDATES = 8


async def _outfit_scan(store, job, providers, tmp, uploads):
    """Stage 1 (free): find the garments the person wears and store a preview crop of each. No generation.
    The uploaded photo stays (for the later generate step) until the scan expires; scripts/sweep_storage removes it."""
    ext = os.path.splitext(job["input_path"])[1] or ".jpg"
    photo = _write(os.path.join(tmp, "upload" + ext), store.download(job["input_path"]))
    vision = providers(RunLogger(os.path.join(tmp, "scan_log.jsonl"))).vision
    try:
        scan = await vision.detect_outfit(photo)
    except ValueError as e:  # unreadable photo
        raise JobRejected(_sentence(str(e))) from e
    base = f"{job['user_id']}/scans/{job['id']}"
    candidates = []
    for c in scan.candidates[:MAX_OUTFIT_CANDIDATES]:
        local = outfit.preview_crop(photo, c, os.path.join(tmp, f"{c.id}.jpg"))
        candidates.append({**c.model_dump(mode="json"), "preview_path": uploads.put_photo_if_exists(f"{base}/{c.id}.jpg", local)})
    expires = datetime.now(timezone.utc) + OUTFIT_SCAN_TTL
    return {"scene_kind": scan.scene_kind, "person_count": scan.person_count, "candidates": candidates,
            "expires_at": expires.isoformat()}


SCAN_GONE = "This scan has expired — scan the photo again"
# Tier from how much of the garment the photo showed: the rest of the catalog image is the model's completion.
VISIBILITY_TIER = {"full": "high", "partial": "medium", "low": "low"}


def _scan_for(store, job) -> tuple[dict, "outfit.OutfitScan"]:
    scan_job = store.get_job(job["user_id"], job["scan_job_id"])
    result = (scan_job or {}).get("result") or {}
    expires = result.get("expires_at")
    if (not scan_job or scan_job["kind"] != "outfit_scan" or scan_job["status"] != "succeeded"
            or not expires or datetime.fromisoformat(expires) <= datetime.now(timezone.utc)):
        raise JobRejected(SCAN_GONE)
    return scan_job, outfit.OutfitScan.model_validate(result)


async def _outfit_generate(store, job, providers, tmp, uploads):
    """Stage 2: catalog images ONLY for the picked candidates. Each result waits in review ('pending') until the
    user keeps it. A candidate that fails doesn't stop the others and isn't charged (charge_for counts item_ids)."""
    user = job["user_id"]
    scan_job, scan = _scan_for(store, job)
    try:
        original = store.download(scan_job["input_path"])
    except Exception as e:
        raise JobRejected(SCAN_GONE) from e
    photo = _write(os.path.join(tmp, "upload" + (os.path.splitext(scan_job["input_path"])[1] or ".jpg")), original)
    out_dir = os.path.join(tmp, "out")
    imagegen = providers(RunLogger(os.path.join(tmp, "outfit_log.jsonl"))).imagegen
    try:
        results = await imagegen.generate_outfit(photo, scan, list(job["candidate_ids"]), out_dir)
    except ValueError as e:  # unknown candidate IDs or an unreadable photo
        raise JobRejected(_sentence(str(e))) from e
    by_id = {c.id: c for c in scan.candidates}
    item_ids, failed = [], []
    for cid in job["candidate_ids"]:
        item_dir = os.path.join(out_dir, cid)
        if (results.get(cid) or {}).get("status") != "generated" or not os.path.exists(os.path.join(item_dir, "generated.png")):
            failed.append(cid)
            continue
        candidate = by_id[cid]
        piece = int(cid[1:])
        item_id = _item_id(job["id"], piece)
        base = f"{user}/items/{item_id}"
        crop = uploads.put_photo_if_exists(f"{base}/crop.jpg", os.path.join(item_dir, "crop.png"))
        row = {
            "id": item_id, "user_id": user, "job_id": job["id"], "piece_index": piece,
            "tier": VISIBILITY_TIER[candidate.visibility], "facts": outfit.facts_for(candidate).model_dump(mode="json"),
            # The garment crop is the item's source: the full photo of the person is never kept with an item.
            "source_path": crop, "source_kind": "crop", "crop_path": crop,
            "display_path": uploads.put(f"{base}/generated.png", os.path.join(item_dir, "generated.png")),
            "cutout_path": uploads.put_if_exists(f"{base}/cutout.png", os.path.join(item_dir, "cutout.png")),
            "origin": "outfit_photo", "review_state": "pending",
        }
        item_ids.append(store.insert_item(row)["id"])
    if not item_ids:
        raise JobRejected("Couldn't make an image of the selected garments — try again or photograph them laid flat")
    return {"item_ids": item_ids, "failed": failed}


HANDLERS = {"garment": _garment, "back": _back, "turn": _turn, "outfit_scan": _outfit_scan,
            "outfit_generate": _outfit_generate}


def _fail(store, gate, job, uploads, message):
    store.remove(uploads.paths + ([job["input_path"]] if job.get("input_path") else []))
    store.finish_job(job["id"], "failed", error=message)
    try:
        if job["kind"] not in FREE_KINDS:  # a free job (outfit scan) holds nothing to give back
            gate.refund(job["id"])  # AI Credits: a job that failed for good costs nothing
    except Exception:
        log.exception("refund for job %s failed; reconcile will release it", job["id"])
    if job["kind"] == "turn" and store.get_item(job["user_id"], job["item_id"]):
        store.update_item(job["user_id"], job["item_id"], {"turn": {"state": "failed", "error": message}})


async def run_once(store, provider_factory, lease_seconds: int = 600, gate: CreditGate | None = None) -> bool:
    """Claim and run one job. False when the queue is empty."""
    gate = gate or NoCharge()
    job = store.claim_job(lease_seconds)
    if job is None:
        return False
    uploads = _Uploads(store)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            result = await HANDLERS[job["kind"]](store, job, provider_factory, tmp, uploads)
        store.finish_job(job["id"], "succeeded", result)
    except JobRejected as e:
        _fail(store, gate, job, uploads, str(e))
    except Exception:
        log.exception("job %s (%s) failed on attempt %s", job["id"], job["kind"], job["attempts"])
        if job["attempts"] >= job["max_attempts"]:
            _fail(store, gate, job, uploads, GENERIC_FAILURE)
        else:
            store.retry_job(job["id"], GENERIC_FAILURE)
    else:
        # AI Credits: charge only for what the job delivered; the rest of the hold goes back.
        # Outside the try above: the job is done whatever happens here, and reconcile settles it if this fails.
        try:
            if job["kind"] not in FREE_KINDS:  # a free job (outfit scan) has no hold to settle
                gate.settle(job["id"], charge_for(job, result))
        except Exception:
            log.exception("settle for job %s failed; reconcile will settle it", job["id"])
    return True


RECONCILE_EVERY_SECONDS = 60


async def run_forever(store, provider_factory, idle_seconds: float = 2.0, gate: CreditGate | None = None) -> None:
    gate = gate or NoCharge()
    last_reconcile = float("-inf")
    while True:
        now = asyncio.get_running_loop().time()
        if now - last_reconcile >= RECONCILE_EVERY_SECONDS:
            last_reconcile = now
            try:
                gate.reconcile()  # AI Credits: end holds of expired, crashed or never-created jobs
            except Exception:
                log.exception("credit reconcile failed")
        try:
            worked = await run_once(store, provider_factory, gate=gate)
        except Exception:
            log.exception("worker loop error")  # e.g. Supabase unreachable; keep going
            worked = False
        if not worked:
            await asyncio.sleep(idle_seconds)
