"""The multi-user API (WARDROBE_AUTH=on): every route acts for the signed-in user only.

Anything belonging to someone else answers 404, exactly like something that doesn't exist.
"""
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from api.auth import User, current_user
from api.credits import CreditError
from api.controls import BUDGET_USED, PAID_KINDS, WELCOME_KEY, daily_ai_jobs, start_of_day, free_scans_per_hour, generation_on, invited, require_generation, welcome_credits
from api.credits import MAX_FRONTS, InsufficientCredits, action_for, get_gate, get_prices, hold_amount, job_cost
from api.facts_edit import apply_patch, patch_error
from api.activity import EVENTS_PER_HOUR, record, validate as validate_event
from api.schemas import (AccountDeleteIn, EventBatchIn, EventBatchOut, EventIn, GarmentGenerateIn, GarmentScanOut, ProfileIn, ProfileOut, PushTokenIn, RegenerateIn, RegionIn, BackOut, CreditEntryOut, CreditsOut, ItemPatch, JobOut, OutfitCandidateOut, OutfitGenerateIn, OutfitScanOut, PricesOut,
                         TurnOut, TurnViewOut, V1ItemOut, V1ItemsResponse)
from api.store import INTERRUPTED, get_store
from pipeline.types import ItemFacts

router = APIRouter(prefix="/v1")
log = logging.getLogger("wardrobe.v1")

PHOTO_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic",
               ".heif": "image/heif", ".webp": "image/webp"}
NOT_FOUND = HTTPException(404, "not found")


def idempotency_key(key: str | None = Header(None, alias="Idempotency-Key")) -> str:
    if not key or not 1 <= len(key) <= 200:
        raise HTTPException(400, "missing Idempotency-Key header")
    return key


def job_out(job: dict) -> JobOut:
    result = job.get("result") or {}
    return JobOut(id=job["id"], kind=job["kind"], status=job["status"], error=job.get("error"),
                  item_id=job.get("item_id"), item_ids=result.get("item_ids", []),
                  quality=result.get("quality"), failed=result.get("failed", []), cost_credits=job.get("cost_credits"),
                  max_fronts=job.get("max_items"), over_limit=result.get("over_limit", 0),
                  progress=job.get("progress"))


def queue_job(store, user: User, kind: str, key: str, photo: UploadFile | None, gate, prices, item_id: str | None = None,
              max_items: int | None = None, out=job_out, extra: dict | None = None, input_path: str | None = None):
    """Create (or find) the user's job for this key; a new job answers 202, a repeat 200."""
    existing = store.job_by_key(user.id, key)
    if existing:
        return JSONResponse(status_code=200, content=out(existing).model_dump())
    cap = daily_ai_jobs()
    if cap and kind in PAID_KINDS and store.count_jobs_since(PAID_KINDS, start_of_day()) >= cap:
        raise HTTPException(503, BUDGET_USED)  # the operator's cost guard: nothing is held or uploaded
    if store.profile_status(user.id) == "disabled":
        raise HTTPException(403, "this account is disabled")

    ext = None
    if photo is not None:
        if not photo.filename:
            raise HTTPException(400, "no photo provided")
        ext = os.path.splitext(photo.filename)[1].lower()
        if ext not in PHOTO_TYPES:
            raise HTTPException(400, "unsupported photo type")

    job_id, cost = str(uuid.uuid4()), job_cost(prices, kind)
    try:
        gate.reserve(user.id, job_id, action_for(kind), hold_amount(cost, max_items))  # AI Credits: hold the cost before any work
    except InsufficientCredits:
        raise HTTPException(402, "not enough AI credits")

    uploaded, created = None, False
    try:
        if ext:
            input_path = uploaded = f"{user.id}/jobs/{job_id}/upload{ext}"
            store.upload(input_path, photo.file.read(), PHOTO_TYPES[ext])
        job, created = store.create_job(user.id, kind, key, input_path, item_id=item_id, job_id=job_id, cost_credits=cost,
                                        max_items=max_items, extra=extra)
    finally:
        if not created:
            gate.release(job_id)  # failed, or lost a race with the same key: one hold per job
            if uploaded:
                store.remove([uploaded])
    return JSONResponse(status_code=202 if created else 200, content=out(job).model_dump())


@router.post("/jobs", response_model=JobOut, status_code=202, dependencies=[Depends(require_generation)])
def create_garment_job(user: User = Depends(current_user), photo: UploadFile | None = File(None),
                       max_fronts: str | None = Form(None), key: str = Depends(idempotency_key),
                       store=Depends(get_store), gate=Depends(get_gate), prices=Depends(get_prices)):
    """max_fronts: how many front images (one per garment in the photo) the user approved paying for;
    default 1. Only used while billing is on: then the job holds price × max_fronts, makes at most that
    many fronts (largest pieces first) and is charged only for the fronts it made."""
    if photo is None:
        raise HTTPException(400, "no photo provided")
    fronts = _whole(max_fronts, "max_fronts", 1, MAX_FRONTS) or 1
    return queue_job(store, user, "garment", key, photo, gate, prices, max_items=fronts if prices else None)


@router.get("/prices", response_model=PricesOut)
def prices_list(user: User = Depends(current_user), prices=Depends(get_prices)):
    """The AI Price List the app can show; empty while billing is off. `outfit` says whether the
    Outfit Photo flow is switched on (WARDROBE_OUTFIT=on), so the app shows that mode only then."""
    return PricesOut(billing=bool(prices), prices=prices, outfit=_outfit_enabled(), generation=generation_on())


CREDIT_PAGE, CREDIT_PAGE_MAX = 20, 100


def _whole(value: str | None, name: str, low: int, high: int | None = None) -> int | None:
    if value is None:
        return None
    if not value.isdigit() or int(value) < low or (high is not None and int(value) > high):
        raise HTTPException(400, f"{name} must be a whole number from {low}" + (f" to {high}" if high else " up"))
    return int(value)


@router.get("/credits", response_model=CreditsOut)
def credits(user: User = Depends(current_user), store=Depends(get_store), limit: str | None = None, before: str | None = None):
    """The user's AI Credits balance and activity, newest first. Read-only: credits change only on the server."""
    size = _whole(limit, "limit", 1, CREDIT_PAGE_MAX) or CREDIT_PAGE
    cursor = _whole(before, "before", 1)
    wallet = store.credits(user.id)
    rows = store.credit_entries(user.id, size + 1, cursor)
    entries = [CreditEntryOut(id=r["id"], kind=r["kind"], amount=r["amount"], action=r.get("action"),
                              job_id=r.get("job_id"), note=r.get("note"), created_at=str(r["created_at"]))
               for r in rows[:size]]
    granted = store.credit_granted(user.id)
    return CreditsOut(balance=wallet["balance"], held=wallet["held"], available=wallet["balance"] - wallet["held"],
                      granted=granted, used=max(granted - wallet["balance"], 0), entries=entries, next_before=entries[-1].id if len(rows) > size else None)


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    job = store.get_job(user.id, job_id) if _is_uuid(job_id) else None
    if job is None:
        raise NOT_FOUND
    return job_out(job)


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


# A 360 job waits in the queue and then takes about a minute; one "running" for this long died.
TURN_STALE_SECONDS = 30 * 60


def _paths(item: dict) -> list[str]:
    back, turn = item.get("back") or {}, item.get("turn") or {}
    paths = [item.get("display_path"), item.get("crop_path"), item.get("cutout_path"),
             back.get("generated_path"), back.get("cutout_path")]
    for view in turn.get("views", []):
        paths += [view.get("path"), view.get("cutout_path")]
    return [p for p in paths if p]


def _turn_out(turn: dict | None, urls: dict[str, str]) -> TurnOut | None:
    if not turn:
        return None
    state = turn.get("state")
    if state == "running":
        started = turn.get("started_at")
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(started)).total_seconds() if started else 0
        return TurnOut(state="failed", error=INTERRUPTED) if age > TURN_STALE_SECONDS else TurnOut(state="running")
    if state == "failed":
        return TurnOut(state="failed", error=turn.get("error"))
    views = [TurnViewOut(angle=v["angle"], url=urls[v["path"]], cutout_url=urls.get(v.get("cutout_path") or ""))
             for v in turn.get("views", []) if v.get("path") in urls]
    return TurnOut(state="done", views=views)


def item_out(item: dict, urls: dict[str, str]) -> V1ItemOut:
    back = item.get("back")
    display = urls[item["display_path"]]
    created = item["created_at"]
    return V1ItemOut(
        id=item["id"], created_at=created.isoformat() if isinstance(created, datetime) else str(created), tier=item.get("tier") or "low", facts=ItemFacts.model_validate(item["facts"]),
        generated_url=display, crop_url=urls.get(item.get("crop_path") or "", display),
        cutout_url=urls.get(item.get("cutout_path") or ""),
        back=BackOut(generated_url=urls[back["generated_path"]], cutout_url=urls.get(back.get("cutout_path") or ""),
                     visible_text=back.get("visible_text") or "") if back and back.get("generated_path") in urls else None,
        turn=_turn_out(item.get("turn"), urls),
        origin=item.get("origin") or "garment_photo", review_state=item.get("review_state"),
    )


def _own_item(store, user: User, item_id: str) -> dict:
    item = store.get_item(user.id, item_id) if _is_uuid(item_id) else None
    if item is None:
        raise NOT_FOUND
    return item


@router.get("/items", response_model=V1ItemsResponse)
def list_items(user: User = Depends(current_user), store=Depends(get_store), review: str | None = None):
    """The closet. ?review=pending lists Outfit Photo results still waiting for keep/discard instead."""
    if review not in (None, "pending"):
        raise HTTPException(400, "review must be 'pending'")
    items = store.pending_items(user.id) if review else store.list_items(user.id)
    urls = store.sign([p for item in items for p in _paths(item)])
    return V1ItemsResponse(items=[item_out(item, urls) for item in items if item["display_path"] in urls])


@router.get("/items/{item_id}", response_model=V1ItemOut)
def get_item(item_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    item = _own_item(store, user, item_id)
    return item_out(item, store.sign(_paths(item)))


@router.patch("/items/{item_id}", response_model=V1ItemOut)
def edit_item(item_id: str, patch: ItemPatch, background: BackgroundTasks, user: User = Depends(current_user),
              store=Depends(get_store)):
    item = _own_item(store, user, item_id)
    error = patch_error(patch)
    if error:
        raise HTTPException(400, error)
    facts = apply_patch(ItemFacts.model_validate(item["facts"]), patch)
    updated = store.update_item(user.id, item_id, {"facts": facts.model_dump(mode="json")})
    first = item.get("facts_original") is None
    for field in sorted(patch.model_dump(exclude_unset=True)):  # the field's name only, never its value
        background.add_task(record, store, user.id, "item_edited", {"field": field, "first": first}, item_id=item_id)
    return item_out(updated, store.sign(_paths(updated)))


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, background: BackgroundTasks, user: User = Depends(current_user), store=Depends(get_store)):
    item = _own_item(store, user, item_id)
    store.update_item(user.id, item_id, {"deleted_at": datetime.now(timezone.utc).isoformat()})
    # pending = an outfit result discarded in review; otherwise a piece removed from the closet
    background.add_task(record, store, user.id, "item_deleted", {"review": item.get("review_state") or "none"}, item_id=item_id)
    return Response(status_code=204)


@router.post("/items/{item_id}/back", response_model=JobOut, status_code=202, dependencies=[Depends(require_generation)])
def add_back(item_id: str, user: User = Depends(current_user), photo: UploadFile | None = File(None),
             key: str = Depends(idempotency_key), store=Depends(get_store),
             gate=Depends(get_gate), prices=Depends(get_prices)):
    _own_item(store, user, item_id)
    if photo is None:
        raise HTTPException(400, "no photo provided")
    return queue_job(store, user, "back", key, photo, gate, prices, item_id=item_id)


@router.post("/items/{item_id}/turn", response_model=JobOut, status_code=202, dependencies=[Depends(require_generation)])
def start_turn(item_id: str, user: User = Depends(current_user), key: str = Depends(idempotency_key),
               store=Depends(get_store), gate=Depends(get_gate), prices=Depends(get_prices)):
    _own_item(store, user, item_id)
    if store.job_by_key(user.id, key) is None and store.active_job(user.id, item_id, "turn"):
        raise HTTPException(409, "the 360 view is already being made")
    response = queue_job(store, user, "turn", key, None, gate, prices, item_id=item_id)
    if response.status_code == 202:
        store.update_item(user.id, item_id, {"turn": {"state": "running", "started_at": datetime.now(timezone.utc).isoformat()}})
    return response


# --- Outfit Photo (M1): free candidate scan of a photo of a person wearing clothes -------------------
# Off unless the server starts with WARDROBE_OUTFIT=on: then the routes answer 404 like any unknown path.

def _outfit_enabled() -> bool:
    return os.environ.get("WARDROBE_OUTFIT", "").strip().lower() == "on"


def outfit_on():
    if not _outfit_enabled():
        raise NOT_FOUND


def _scan_expired(job: dict) -> bool:
    expires = (job.get("result") or {}).get("expires_at")
    return bool(expires) and datetime.fromisoformat(expires) <= datetime.now(timezone.utc)


def scan_out(job: dict, store) -> OutfitScanOut:
    result = job.get("result") or {}
    candidates = result.get("candidates") or []
    urls = store.sign([c["preview_path"] for c in candidates if c.get("preview_path")])
    return OutfitScanOut(
        id=job["id"], status=job["status"], error=job.get("error"), scene_kind=result.get("scene_kind"),
        person_count=result.get("person_count"), expires_at=result.get("expires_at"),
        candidates=[OutfitCandidateOut(**{k: v for k, v in c.items() if k in OutfitCandidateOut.model_fields},
                                       preview_url=urls.get(c.get("preview_path") or ""))
                    for c in candidates])


@router.post("/outfit-scans", response_model=OutfitScanOut, status_code=202, dependencies=[Depends(outfit_on), Depends(require_generation)])
def create_outfit_scan(user: User = Depends(current_user), photo: UploadFile | None = File(None),
                       key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                       prices=Depends(get_prices)):
    """Stage 1: find the garments a person is wearing. Free to the user (no hold, no charge); nothing is generated."""
    if photo is None:
        raise HTTPException(400, "no photo provided")
    existing = store.job_by_key(user.id, key)
    if existing and existing["kind"] != "outfit_scan":
        raise HTTPException(409, "this Idempotency-Key was already used for another request")
    if not existing:
        _limit_free_scans(store, user)
    return queue_job(store, user, "outfit_scan", key, photo, gate, prices, out=lambda job: scan_out(job, store))


def _own_scan(store, user: User, scan_id: str) -> dict:
    """The caller's scan; someone else's or unknown answers 404, an expired one 410."""
    job = store.get_job(user.id, scan_id) if _is_uuid(scan_id) else None
    if job is None or job["kind"] != "outfit_scan":
        raise NOT_FOUND
    if _scan_expired(job):
        raise HTTPException(410, "this scan has expired — scan the photo again")
    return job


@router.get("/outfit-scans/{scan_id}", response_model=OutfitScanOut, dependencies=[Depends(outfit_on)])
def get_outfit_scan(scan_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    """The scan and its candidates with short-lived preview URLs."""
    return scan_out(_own_scan(store, user, scan_id), store)


MAX_PICKS = 8


@router.post("/outfit-scans/{scan_id}/generate", response_model=JobOut, status_code=202, dependencies=[Depends(outfit_on), Depends(require_generation)])
def generate_from_scan(scan_id: str, body: OutfitGenerateIn, user: User = Depends(current_user),
                       key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                       prices=Depends(get_prices)):
    """Stage 2: make catalog images for the picked candidates only. With billing on, holds one front price per pick
    (the action 'garment') and charges only for the images made. 409 if the price changed since the user saw it."""
    existing = store.job_by_key(user.id, key)
    if existing:
        if existing["kind"] != "outfit_generate":
            raise HTTPException(409, "this Idempotency-Key was already used for another request")
        return JSONResponse(status_code=200, content=job_out(existing).model_dump())
    scan = _own_scan(store, user, scan_id)
    if scan["status"] != "succeeded":
        raise HTTPException(409, "the scan isn't finished yet")
    picks = list(dict.fromkeys(body.candidate_ids))
    known = {c["id"] for c in (scan.get("result") or {}).get("candidates") or []}
    if not 1 <= len(picks) <= MAX_PICKS:
        raise HTTPException(400, f"pick 1 to {MAX_PICKS} garments")
    if any(p not in known for p in picks):
        raise HTTPException(400, "unknown garment in this scan")
    corrections = {}
    for cid, category in (body.corrections or {}).items():
        category = (category or "").strip()
        if cid not in picks:
            raise HTTPException(400, "corrections must be for picked garments")
        if not 1 <= len(category) <= CATEGORY_MAX:
            raise HTTPException(400, f"a corrected type must be 1 to {CATEGORY_MAX} characters")
        corrections[cid] = category
    unit = job_cost(prices, "outfit_generate")
    if body.expected_unit_price != unit:
        raise HTTPException(409, "the price changed — check it and confirm again")
    extra = {"scan_job_id": scan["id"], "candidate_ids": picks}
    if corrections:
        extra["corrections"] = corrections
    return queue_job(store, user, "outfit_generate", key, None, gate, prices,
                     max_items=len(picks) if prices else None, extra=extra)


CATEGORY_MAX = 40
MAX_SCAN_CANDIDATES = 8
MIN_REGION_PX = 8
MARKED_NOTE = "Marked by you — the details come from your photo."


@router.post("/outfit-scans/{scan_id}/regions", response_model=OutfitScanOut, dependencies=[Depends(outfit_on)])
def mark_region(scan_id: str, body: RegionIn, background: BackgroundTasks, user: User = Depends(current_user),
                store=Depends(get_store)):
    """A garment the scan missed: the user marks it on the photo. No model call (free); it becomes a candidate
    with a crop of that area, and generation works from the crop like any other pick."""
    import tempfile
    import cv2
    import numpy as np
    from pipeline.outfit import OutfitCandidate, preview_crop
    from pipeline.types import BBox
    scan = _own_scan(store, user, scan_id)
    if scan["status"] != "succeeded":
        raise HTTPException(409, "the scan isn't finished yet")
    result = dict(scan.get("result") or {})
    candidates = list(result.get("candidates") or [])
    if len(candidates) >= MAX_SCAN_CANDIDATES:
        raise HTTPException(400, f"a photo can have at most {MAX_SCAN_CANDIDATES} garments")
    category = body.category.strip()
    if not 1 <= len(category) <= CATEGORY_MAX:
        raise HTTPException(400, f"the type must be 1 to {CATEGORY_MAX} characters")
    image = cv2.imdecode(np.frombuffer(store.download(scan["input_path"]), np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(409, "this scan's photo is no longer available — scan it again")
    h, w = image.shape[:2]
    b = body.box
    if b.x < 0 or b.y < 0 or b.width < MIN_REGION_PX or b.height < MIN_REGION_PX or b.x + b.width > w or b.y + b.height > h:
        raise HTTPException(400, "mark an area inside the photo")
    n = 1 + sum(1 for c in candidates if str(c.get("id", "")).startswith("m"))
    candidate = OutfitCandidate(
        id=f"m{n}", box=BBox(x=b.x, y=b.y, width=b.width, height=b.height), cut_off_by_frame=False,
        category=category, layer="single", colors=[], pattern="", visible_text="",
        description=f"{category}, marked by the user", visible_parts=[], hidden_parts=[],
        visibility="partial", uncertainty=MARKED_NOTE)
    with tempfile.TemporaryDirectory() as tmp:
        photo = f"{tmp}/photo.jpg"
        cv2.imwrite(photo, image)
        crop = preview_crop(photo, candidate, f"{tmp}/{candidate.id}.jpg")
        ok, jpg = cv2.imencode(".jpg", cv2.imread(crop), [cv2.IMWRITE_JPEG_QUALITY, 85])
    path = f"{user.id}/scans/{scan['id']}/{candidate.id}.jpg"
    store.upload(path, jpg.tobytes(), "image/jpeg")
    candidates.append({**candidate.model_dump(mode="json"), "preview_path": path})
    result["candidates"] = candidates
    store.finish_job(scan["id"], "succeeded", result)
    background.add_task(record, store, user.id, "region_added", job_id=scan["id"])  # the type typed is not kept
    return scan_out(store.get_job(user.id, scan["id"]), store)


@router.post("/items/{item_id}/regenerate", response_model=JobOut, status_code=202, dependencies=[Depends(outfit_on), Depends(require_generation)])
def regenerate_item(item_id: str, body: RegenerateIn, user: User = Depends(current_user),
                    key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                    prices=Depends(get_prices)):
    """A new image for an outfit result still waiting for review. Priced and charged like one front image;
    409 if the price changed, the result was already kept, or its scan has expired."""
    existing = store.job_by_key(user.id, key)
    if existing:
        if existing["kind"] != "outfit_regenerate":
            raise HTTPException(409, "this Idempotency-Key was already used for another request")
        return JSONResponse(status_code=200, content=job_out(existing).model_dump())
    item = _own_item(store, user, item_id)
    if item.get("origin") != "outfit_photo" or item.get("review_state") != "pending":
        raise HTTPException(409, "only outfit results waiting for review can be made again")
    source = store.get_job(user.id, item.get("job_id") or "") if item.get("job_id") else None
    if not source or source["kind"] != "outfit_generate":
        raise HTTPException(409, "this result can't be made again")
    unit = job_cost(prices, "outfit_regenerate")
    if body.expected_unit_price != unit:
        raise HTTPException(409, "the price changed — check it and confirm again")
    piece = item["piece_index"]
    cid = f"m{piece - 100}" if piece >= 100 else f"c{piece}"
    extra = {"scan_job_id": source["scan_job_id"], "candidate_ids": [cid]}
    if source.get("corrections"):
        extra["corrections"] = {k: v for k, v in source["corrections"].items() if k == cid}
    return queue_job(store, user, "outfit_regenerate", key, None, gate, prices, item_id=item_id, extra=extra)


@router.post("/items/{item_id}/keep", response_model=V1ItemOut, dependencies=[Depends(outfit_on)])
def keep_item(item_id: str, background: BackgroundTasks, user: User = Depends(current_user), store=Depends(get_store)):
    """The user accepts an outfit result: it joins the closet. Discarding is DELETE /v1/items/{id} (soft delete)."""
    item = _own_item(store, user, item_id)
    if item.get("review_state") == "pending":
        item = store.update_item(user.id, item_id, {"review_state": "kept"})
        background.add_task(record, store, user.id, "item_kept", item_id=item_id)
    return item_out(item, store.sign(_paths(item)))


@router.delete("/account", status_code=204)
def delete_account(body: AccountDeleteIn | None = None, user: User = Depends(current_user), store=Depends(get_store)):
    """Deletes the signed-in account and everything in it. The user comes only from the verified token;
    the body must say DELETE so a stray request can't do it."""
    if body is None or body.confirm != "DELETE":
        raise HTTPException(400, 'send {"confirm": "DELETE"} to delete your account')
    store.delete_account(user.id)
    # The account's activity rows went with it; only this line (kept 14 days) says it happened.
    log.info("account deleted")
    return Response(status_code=204)


NAME_MAX = 40


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: User = Depends(current_user), store=Depends(get_store)):
    return ProfileOut(email=user.email, display_name=store.display_name(user.id))


@router.patch("/profile", response_model=ProfileOut)
def edit_profile(body: ProfileIn, user: User = Depends(current_user), store=Depends(get_store)):
    """The name the app greets the user with, set at sign-up and changeable in Account."""
    name = (body.display_name or "").strip()
    if not 1 <= len(name) <= NAME_MAX:
        raise HTTPException(400, f"display_name must be 1 to {NAME_MAX} characters")
    store.set_display_name(user.id, name)
    return ProfileOut(email=user.email, display_name=name)


def _push_token(body: PushTokenIn | None) -> str:
    from api.push import valid_token
    token = (body.token if body else None) or ""
    if not valid_token(token):
        raise HTTPException(400, "token must be an Expo push token")
    return token


@router.post("/push-token", status_code=204)
def add_push_token(background: BackgroundTasks, body: PushTokenIn | None = None, user: User = Depends(current_user),
                   store=Depends(get_store)):
    """'Notify when ready' on: this phone gets a push when the user's AI work finishes."""
    store.add_push_token(user.id, _push_token(body))
    background.add_task(record, store, user.id, "push_enabled")
    return Response(status_code=204)


@router.delete("/push-token", status_code=204)
def remove_push_token(background: BackgroundTasks, body: PushTokenIn | None = None, user: User = Depends(current_user),
                      store=Depends(get_store)):
    store.remove_push_token(user.id, _push_token(body))
    background.add_task(record, store, user.id, "push_disabled")
    return Response(status_code=204)


GARMENT_SCAN_PICKS_MAX = MAX_FRONTS


def garment_scan_out(job: dict) -> GarmentScanOut:
    r = job.get("result") or {}
    return GarmentScanOut(id=job["id"], status=job["status"], error=job.get("error"), quality=r.get("quality"),
                          pieces=r.get("pieces") or [], reason=r.get("reason"), image=r.get("image"),
                          expires_at=r.get("expires_at"))


def _own_garment_scan(store, user: User, scan_id: str) -> dict:
    job = store.get_job(user.id, scan_id) if _is_uuid(scan_id) else None
    if job is None or job["kind"] != "garment_scan":
        raise NOT_FOUND
    if _scan_expired(job):
        raise HTTPException(410, "this scan has expired — take the photo again")
    return job


@router.post("/garment-scans", response_model=GarmentScanOut, status_code=202, dependencies=[Depends(require_generation)])
def create_garment_scan(user: User = Depends(current_user), photo: UploadFile | None = File(None),
                        key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                        prices=Depends(get_prices)):
    """Find the pieces in a garment photo before paying for any (spec D6 b). Free: no hold, no charge, nothing made."""
    if photo is None:
        raise HTTPException(400, "no photo provided")
    existing = store.job_by_key(user.id, key)
    if existing and existing["kind"] != "garment_scan":
        raise HTTPException(409, "this Idempotency-Key was already used for another request")
    if not existing:
        _limit_free_scans(store, user)
    return queue_job(store, user, "garment_scan", key, photo, gate, prices, out=garment_scan_out)


@router.get("/garment-scans/{scan_id}", response_model=GarmentScanOut)
def get_garment_scan(scan_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    return garment_scan_out(_own_garment_scan(store, user, scan_id))


@router.post("/garment-scans/{scan_id}/generate", response_model=JobOut, status_code=202, dependencies=[Depends(require_generation)])
def generate_from_garment_scan(scan_id: str, body: GarmentGenerateIn, user: User = Depends(current_user),
                               key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                               prices=Depends(get_prices)):
    """Front images for the picked pieces only, from the scan's stored detection (no second detection call).
    Holds price × picks and charges per front made, like max_fronts; 409 if the price changed."""
    existing = store.job_by_key(user.id, key)
    if existing:
        if existing["kind"] != "garment":
            raise HTTPException(409, "this Idempotency-Key was already used for another request")
        return JSONResponse(status_code=200, content=job_out(existing).model_dump())
    scan = _own_garment_scan(store, user, scan_id)
    if scan["status"] != "succeeded":
        raise HTTPException(409, "the scan isn't finished yet")
    picks = list(dict.fromkeys(body.piece_indexes))
    known = {p["index"] for p in (scan.get("result") or {}).get("pieces") or []}
    if not 1 <= len(picks) <= GARMENT_SCAN_PICKS_MAX or any(p not in known for p in picks):
        raise HTTPException(400, "pick pieces found in this photo")
    if body.expected_unit_price != job_cost(prices, "garment"):
        raise HTTPException(409, "the price changed — check it and confirm again")
    return queue_job(store, user, "garment", key, None, gate, prices, max_items=len(picks) if prices else None,
                     input_path=scan["input_path"],
                     extra={"scan_job_id": scan["id"], "candidate_ids": [f"p{i}" for i in picks]})


FREE_SCAN_KINDS = ("garment_scan", "outfit_scan")


def _limit_free_scans(store, user: User):
    """Free scans still cost the app a model call: cap them per account per hour."""
    if store.count_recent_jobs(user.id, FREE_SCAN_KINDS, 3600) >= free_scans_per_hour():
        raise HTTPException(429, "too many photo scans in the last hour — try again in a little while")


def _signed_in(store, user_id: str, granted: int) -> None:
    """After the response: the sign-in (first or not) and the welcome grant, for the activity record."""
    try:
        first = not store.has_event(user_id, "signed_in")
    except Exception:
        first = False
    record(store, user_id, "signed_in", {"first": first})
    if granted:
        record(store, user_id, "welcome_granted", {"credits": min(granted, 1000)})


@router.post("/bootstrap")
def bootstrap(background: BackgroundTasks, user: User = Depends(current_user), store=Depends(get_store)):
    """Called by the app after each sign-in. Grants the welcome credits once per invited account (a fixed
    operation key makes repeats, second devices and reinstalls no-ops). Off unless WARDROBE_WELCOME_CREDITS is set."""
    result = _welcome(user, store)
    background.add_task(_signed_in, store, user.id, result["welcome_granted"])
    return result


def _welcome(user: User, store) -> dict:
    amount = welcome_credits()
    if not amount or not invited(user.email) or store.profile_status(user.id) == "disabled":
        return {"welcome_granted": 0}
    if store.find_grant(user.id, WELCOME_KEY):
        return {"welcome_granted": 0}
    try:
        store.credit_grant(user.id, amount, WELCOME_KEY, "Welcome credits", "welcome")
    except CreditError:
        return {"welcome_granted": 0}
    return {"welcome_granted": amount}


@router.post("/events", status_code=204)
def record_event(body: EventIn, user: User = Depends(current_user), store=Depends(get_store)):
    """First 3 Pieces activation steps (api/activity.py): allow-listed names and props only, server time.
    Once-only events that were already recorded are ignored."""
    try:
        props = validate_event(body.event, body.props)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if store.count_recent_events(user.id, 3600) >= EVENTS_PER_HOUR:
        raise HTTPException(429, "too many events")
    store.insert_event(user.id, body.event, props)
    return Response(status_code=204)


CLIENT_TIME_WINDOW = timedelta(days=7)


@router.post("/events/batch", response_model=EventBatchOut)
def record_events(body: EventBatchIn, user: User = Depends(current_user), store=Depends(get_store)):
    """App events, up to 50 at a time (api/activity.py). Invalid ones are skipped, not a 400 for the batch;
    an event id already stored is skipped too, so a resent batch changes nothing. Server time is kept; the
    phone's time only for ordering, clamped to the last week."""
    if store.count_recent_events(user.id, 3600) >= EVENTS_PER_HOUR:
        raise HTTPException(429, "too many events")
    now = datetime.now(timezone.utc)
    rows = []
    for e in body.events:
        try:
            props = validate_event(e.event, e.props)
        except ValueError:
            continue
        at = e.client_at if e.client_at.tzinfo else e.client_at.replace(tzinfo=timezone.utc)
        rows.append({"user_id": user.id, "event": e.event, "props": props, "source": "app",
                     "client_event_id": str(e.client_event_id), "client_at": min(max(at, now - CLIENT_TIME_WINDOW), now),
                     "session_id": str(e.session_id) if e.session_id else None, "app_version": body.app_version})
    stored = store.insert_events(rows)
    return {"stored": stored, "skipped": len(body.events) - stored}
