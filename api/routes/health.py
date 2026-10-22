"""GET /healthz — for the host's health check and a quick look at the queue. No sign-in, no user data."""
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from api import worker
from api.controls import PAID_KINDS, daily_ai_jobs, generation_on, start_of_day
from api.store import get_store
from pipeline.providers import gemini

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
        "ai_jobs_today": store.count_jobs_since(PAID_KINDS, start_of_day()),
        "daily_ai_jobs_cap": daily_ai_jobs() or None,
        "failed_jobs_last_hour": store.count_failed_jobs_since(datetime.now(timezone.utc) - timedelta(hours=1)),
        "image_model": gemini.image_model(),
    }
