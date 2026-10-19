"""The multi-user API (WARDROBE_AUTH=on): every route acts for the signed-in user only.

Anything belonging to someone else answers 404, exactly like something that doesn't exist.
"""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from api.auth import User, current_user
from api.credits import MAX_FRONTS, InsufficientCredits, action_for, get_gate, get_prices, hold_amount, job_cost
from api.facts_edit import apply_patch, patch_error
from api.schemas import (AccountDeleteIn, BackOut, CreditEntryOut, CreditsOut, ItemPatch, JobOut, OutfitCandidateOut, OutfitGenerateIn, OutfitScanOut, PricesOut,
                         TurnOut, TurnViewOut, V1ItemOut, V1ItemsResponse)
from api.store import INTERRUPTED, get_store
from pipeline.types import ItemFacts

router = APIRouter(prefix="/v1")

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
              max_items: int | None = None, out=job_out, extra: dict | None = None):
    """Create (or find) the user's job for this key; a new job answers 202, a repeat 200."""
    existing = store.job_by_key(user.id, key)
    if existing:
        return JSONResponse(status_code=200, content=out(existing).model_dump())
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

    input_path, created = None, False
    try:
        if ext:
            input_path = f"{user.id}/jobs/{job_id}/upload{ext}"
            store.upload(input_path, photo.file.read(), PHOTO_TYPES[ext])
        job, created = store.create_job(user.id, kind, key, input_path, item_id=item_id, job_id=job_id, cost_credits=cost,
                                        max_items=max_items, extra=extra)
    finally:
        if not created:
            gate.release(job_id)  # failed, or lost a race with the same key: one hold per job
            if input_path:
                store.remove([input_path])
    return JSONResponse(status_code=202 if created else 200, content=out(job).model_dump())


@router.post("/jobs", response_model=JobOut, status_code=202)
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
    return PricesOut(billing=bool(prices), prices=prices, outfit=_outfit_enabled())


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
def edit_item(item_id: str, patch: ItemPatch, user: User = Depends(current_user), store=Depends(get_store)):
    item = _own_item(store, user, item_id)
    error = patch_error(patch)
    if error:
        raise HTTPException(400, error)
    facts = apply_patch(ItemFacts.model_validate(item["facts"]), patch)
    updated = store.update_item(user.id, item_id, {"facts": facts.model_dump(mode="json")})
    return item_out(updated, store.sign(_paths(updated)))


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    _own_item(store, user, item_id)
    store.update_item(user.id, item_id, {"deleted_at": datetime.now(timezone.utc).isoformat()})
    return Response(status_code=204)


@router.post("/items/{item_id}/back", response_model=JobOut, status_code=202)
def add_back(item_id: str, user: User = Depends(current_user), photo: UploadFile | None = File(None),
             key: str = Depends(idempotency_key), store=Depends(get_store),
             gate=Depends(get_gate), prices=Depends(get_prices)):
    _own_item(store, user, item_id)
    if photo is None:
        raise HTTPException(400, "no photo provided")
    return queue_job(store, user, "back", key, photo, gate, prices, item_id=item_id)


@router.post("/items/{item_id}/turn", response_model=JobOut, status_code=202)
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


@router.post("/outfit-scans", response_model=OutfitScanOut, status_code=202, dependencies=[Depends(outfit_on)])
def create_outfit_scan(user: User = Depends(current_user), photo: UploadFile | None = File(None),
                       key: str = Depends(idempotency_key), store=Depends(get_store), gate=Depends(get_gate),
                       prices=Depends(get_prices)):
    """Stage 1: find the garments a person is wearing. Free to the user (no hold, no charge); nothing is generated."""
    if photo is None:
        raise HTTPException(400, "no photo provided")
    existing = store.job_by_key(user.id, key)
    if existing and existing["kind"] != "outfit_scan":
        raise HTTPException(409, "this Idempotency-Key was already used for another request")
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


@router.post("/outfit-scans/{scan_id}/generate", response_model=JobOut, status_code=202, dependencies=[Depends(outfit_on)])
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
    unit = job_cost(prices, "outfit_generate")
    if body.expected_unit_price != unit:
        raise HTTPException(409, "the price changed — check it and confirm again")
    return queue_job(store, user, "outfit_generate", key, None, gate, prices,
                     max_items=len(picks) if prices else None,
                     extra={"scan_job_id": scan["id"], "candidate_ids": picks})


@router.post("/items/{item_id}/keep", response_model=V1ItemOut, dependencies=[Depends(outfit_on)])
def keep_item(item_id: str, user: User = Depends(current_user), store=Depends(get_store)):
    """The user accepts an outfit result: it joins the closet. Discarding is DELETE /v1/items/{id} (soft delete)."""
    item = _own_item(store, user, item_id)
    if item.get("review_state") == "pending":
        item = store.update_item(user.id, item_id, {"review_state": "kept"})
    return item_out(item, store.sign(_paths(item)))


@router.delete("/account", status_code=204)
def delete_account(body: AccountDeleteIn | None = None, user: User = Depends(current_user), store=Depends(get_store)):
    """Deletes the signed-in account and everything in it. The user comes only from the verified token;
    the body must say DELETE so a stray request can't do it."""
    if body is None or body.confirm != "DELETE":
        raise HTTPException(400, 'send {"confirm": "DELETE"} to delete your account')
    store.delete_account(user.id)
    return Response(status_code=204)
