"""The multi-user API (WARDROBE_AUTH=on): every route acts for the signed-in user only.

Anything belonging to someone else answers 404, exactly like something that doesn't exist.
"""
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, Header, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from api.auth import User, current_user
from api.facts_edit import apply_patch, patch_error
from api.schemas import BackOut, ItemPatch, JobOut, TurnOut, TurnViewOut, V1ItemOut, V1ItemsResponse
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
                  quality=result.get("quality"), failed=result.get("failed", []))


def queue_job(store, user: User, kind: str, key: str, photo: UploadFile | None, item_id: str | None = None):
    """Create (or find) the user's job for this key; a new job answers 202, a repeat 200."""
    existing = store.job_by_key(user.id, key)
    if existing:
        return JSONResponse(status_code=200, content=job_out(existing).model_dump())
    if store.profile_status(user.id) == "disabled":
        raise HTTPException(403, "this account is disabled")

    job_id, input_path = str(uuid.uuid4()), None
    if photo is not None:
        if not photo.filename:
            raise HTTPException(400, "no photo provided")
        ext = os.path.splitext(photo.filename)[1].lower()
        if ext not in PHOTO_TYPES:
            raise HTTPException(400, "unsupported photo type")
        input_path = f"{user.id}/jobs/{job_id}/upload{ext}"
        store.upload(input_path, photo.file.read(), PHOTO_TYPES[ext])

    job, created = store.create_job(user.id, kind, key, input_path, item_id=item_id, job_id=job_id)
    if not created and input_path:
        store.remove([input_path])  # lost a race with the same key: keep only the first upload
    return JSONResponse(status_code=202 if created else 200, content=job_out(job).model_dump())


@router.post("/jobs", response_model=JobOut, status_code=202)
def create_garment_job(user: User = Depends(current_user), photo: UploadFile | None = File(None),
                       key: str = Depends(idempotency_key), store=Depends(get_store)):
    if photo is None:
        raise HTTPException(400, "no photo provided")
    return queue_job(store, user, "garment", key, photo)


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
    )


def _own_item(store, user: User, item_id: str) -> dict:
    item = store.get_item(user.id, item_id) if _is_uuid(item_id) else None
    if item is None:
        raise NOT_FOUND
    return item


@router.get("/items", response_model=V1ItemsResponse)
def list_items(user: User = Depends(current_user), store=Depends(get_store)):
    items = store.list_items(user.id)
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
             key: str = Depends(idempotency_key), store=Depends(get_store)):
    _own_item(store, user, item_id)
    if photo is None:
        raise HTTPException(400, "no photo provided")
    return queue_job(store, user, "back", key, photo, item_id=item_id)


@router.post("/items/{item_id}/turn", response_model=JobOut, status_code=202)
def start_turn(item_id: str, user: User = Depends(current_user), key: str = Depends(idempotency_key),
               store=Depends(get_store)):
    _own_item(store, user, item_id)
    if store.job_by_key(user.id, key) is None and store.active_job(user.id, item_id, "turn"):
        raise HTTPException(409, "the 360 view is already being made")
    response = queue_job(store, user, "turn", key, None, item_id=item_id)
    if response.status_code == 202:
        store.update_item(user.id, item_id, {"turn": {"state": "running", "started_at": datetime.now(timezone.utc).isoformat()}})
    return response
