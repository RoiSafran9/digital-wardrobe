"""GET /healthz — for the host's health check and a quick look at the queue. No sign-in, no user data."""
import time
from fastapi import APIRouter, Depends
from api import worker
from api.controls import generation_on
from api.store import get_store

router = APIRouter()


@router.get("/healthz")
def healthz(store=Depends(get_store)):
    stats = store.queue_stats()
    beat = worker.last_beat()
    return {
        "status": "ok",
        "generation": generation_on(),
        "queued": stats["queued"],
        "oldest_queued_seconds": stats["oldest_queued_seconds"],
        "worker_seconds_since_beat": None if beat is None else round(time.monotonic() - beat, 1),
    }
