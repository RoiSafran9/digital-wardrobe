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
from api.credits import CreditGate, NoCharge
from api.item_loader import load_item
from pipeline.back import BackPhotoRejected, run_back
from pipeline.orchestrator import run_photo
from pipeline.run_log import RunLogger
from pipeline.turn import TURN_ORDER, TurnFailed, refs_for_item, run_turn
from pipeline.types import ItemFacts

log = logging.getLogger("wardrobe.worker")

GENERIC_FAILURE = "Something went wrong — try again"
ITEM_GONE = "That item no longer exists"


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
    try:
        outcome = await run_photo(photo, output_dir, providers(logger), logger)
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
            "crop_path": uploads.put_if_exists(f"{base}/crop.png", os.path.join(item_dir, "crop.png")),
            "cutout_path": uploads.put_if_exists(f"{base}/cutout.png", os.path.join(item_dir, "cutout.png")),
        }
        item_ids.append(store.insert_item(row)["id"])

    quality = outcome["quality"]
    store.remove([job["input_path"]])  # each item keeps its own copy as source
    return {"item_ids": item_ids, "quality": {"status": quality.status, "reason": quality.reason},
            "failed": outcome["failed"], "retakes": retakes}


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
        "crop_path": uploads.put_if_exists(f"{base}/crop.png", os.path.join(out, "crop.png")),
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


HANDLERS = {"garment": _garment, "back": _back, "turn": _turn}


def _fail(store, gate, job, uploads, message):
    store.remove(uploads.paths + ([job["input_path"]] if job.get("input_path") else []))
    store.finish_job(job["id"], "failed", error=message)
    gate.refund(job["id"])  # AI Credits hook: a job that failed for good costs nothing
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
        gate.settle(job["id"])  # AI Credits hook: the hold becomes a charge
    except JobRejected as e:
        _fail(store, gate, job, uploads, str(e))
    except Exception:
        log.exception("job %s (%s) failed on attempt %s", job["id"], job["kind"], job["attempts"])
        if job["attempts"] >= job["max_attempts"]:
            _fail(store, gate, job, uploads, GENERIC_FAILURE)
        else:
            store.retry_job(job["id"], GENERIC_FAILURE)
    return True


async def run_forever(store, provider_factory, idle_seconds: float = 2.0, gate: CreditGate | None = None) -> None:
    while True:
        try:
            worked = await run_once(store, provider_factory, gate=gate)
        except Exception:
            log.exception("worker loop error")  # e.g. Supabase unreachable; keep going
            worked = False
        if not worked:
            await asyncio.sleep(idle_seconds)
