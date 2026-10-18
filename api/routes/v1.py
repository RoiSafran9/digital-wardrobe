"""The multi-user API (WARDROBE_AUTH=on): every route acts for the signed-in user only.

Anything belonging to someone else answers 404, exactly like something that doesn't exist.
"""
import os
import uuid
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from api.auth import User, current_user
from api.schemas import JobOut
from api.store import get_store

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
