"""The worker keeps each job's model calls (ai_calls) and a failure code per failed job (activity logging L2)."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
import pytest
from api.store import MemoryStore
from api.worker import AI_CALLS_RETENTION_DAYS, _sweep_now, run_once
from pipeline.orchestrator import Providers
from tests.api.test_worker import A, FakeImageGen, FakeVision, detected, garment_job, photo_bytes


class LoggingVision(FakeVision):
    """Detection that logs one model call, like GeminiProvider does."""
    def __init__(self, logger, raise_with=None, **kwargs):
        super().__init__(**kwargs)
        self.logger, self.raise_with = logger, raise_with

    async def detect_items_with_facts(self, image_path):
        if self.raise_with:
            self.logger.log(stage="stage1_detect_facts", model="gemini-3.1-flash-lite", prompt_version="v4",
                            latency_ms=60000.0, status="error", error_class=type(self.raise_with).__name__)
            raise self.raise_with
        self.logger.log(stage="stage1_detect_facts", model="gemini-3.1-flash-lite", prompt_version="v4",
                        latency_ms=1234.5, status="ok", input_tokens=1000, output_tokens=200, cost_usd=0.00055)
        return self.items


class LoggingImageGen(FakeImageGen):
    def __init__(self, logger):
        super().__init__()
        self.logger = logger

    async def generate(self, crop_path, facts, violations, complete_edges=False):
        self.logger.log(stage="stage4_generate", model="gemini-3.1-flash-image", prompt_version="v5", latency_ms=9000.0,
                        status="ok", input_tokens=1200, output_tokens=1290, images_out=1, cost_usd=0.0676, fallback=True)
        return await super().generate(crop_path, facts, violations, complete_edges)


def logging_factory(raise_with=None, items=None):
    def make(logger):
        return Providers(vision=LoggingVision(logger, raise_with, items=items), imagegen=LoggingImageGen(logger))
    return make


async def test_a_succeeded_job_keeps_its_model_calls():
    store = MemoryStore()
    job_id = garment_job(store)
    await run_once(store, logging_factory())
    assert store.jobs[job_id]["status"] == "succeeded"
    calls = store.ai_calls
    assert sorted(c["stage"] for c in calls) == ["stage1_detect_facts", "stage4_generate", "stage4_generate"]
    for c in calls:
        assert c["job_id"] == job_id and c["user_id"] == A and c["job_kind"] == "garment" and c["attempt"] == 1
    gen = next(c for c in calls if c["stage"] == "stage4_generate")
    assert (gen["model"], gen["input_tokens"], gen["output_tokens"], gen["images_out"], gen["fallback"]) == \
        ("gemini-3.1-flash-image", 1200, 1290, 1, True)
    assert gen["est_cost_usd"] == 0.0676 and gen["latency_ms"] == 9000 and gen["status"] == "ok"
    assert "error" not in gen


async def test_a_failed_job_still_keeps_its_calls_and_why():
    store = MemoryStore()
    job_id = garment_job(store)
    store.jobs[job_id]["max_attempts"] = 1
    await run_once(store, logging_factory(raise_with=asyncio.TimeoutError()))
    job = store.jobs[job_id]
    assert job["status"] == "failed" and job["failure_code"] == "model_timeout"
    [call] = store.ai_calls
    assert call["status"] == "error" and call["error_class"] == "TimeoutError" and call["est_cost_usd"] is None


async def test_a_retried_job_keeps_both_attempts():
    store = MemoryStore()
    job_id = garment_job(store)
    await run_once(store, logging_factory(raise_with=RuntimeError("model unavailable")))
    assert store.jobs[job_id]["status"] == "queued" and store.jobs[job_id].get("failure_code") is None
    await run_once(store, logging_factory())
    assert store.jobs[job_id]["status"] == "succeeded"
    assert sorted({c["attempt"] for c in store.ai_calls}) == [1, 2]


async def test_failing_to_keep_the_calls_never_fails_the_job(caplog):
    store = MemoryStore()

    def broken(rows):
        raise RuntimeError("Supabase down")
    store.insert_ai_calls = broken
    job_id = garment_job(store)
    with caplog.at_level(logging.WARNING):
        await run_once(store, logging_factory())
    assert store.jobs[job_id]["status"] == "succeeded"
    assert any("model calls" in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize("kind,setup,code", [
    ("garment", "no_garment", "no_garment"),
    ("garment", "crash", "internal"),
    ("garment", "google", "model_error"),
    ("garment", "no_image", "model_refused"),
    ("back", "item_gone", "item_gone"),
    ("garment_from_scan", "expired", "scan_expired"),
])
async def test_failure_codes(kind, setup, code):
    store = MemoryStore()
    items, raise_with = None, None
    if setup == "no_garment":
        items = []
    elif setup == "crash":
        raise_with = RuntimeError("bug")
    elif setup == "google":
        from google.genai import errors
        raise_with = errors.ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE", "message": "overloaded"}})
    elif setup == "no_image":
        from pipeline.providers.gemini import NoImageReturned
        raise_with = NoImageReturned("no image in the answer")
    if kind == "garment":
        job_id = garment_job(store)
    elif kind == "back":
        job, _ = store.create_job(A, "back", "kb", f"{A}/jobs/x/upload.png", item_id="11111111-2222-4333-8444-555555555555")
        job_id = job["id"]
    else:
        scan, _ = store.create_job(A, "garment_scan", "ks", None)
        store.jobs[scan["id"]]["result"] = {"expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}
        store.jobs[scan["id"]]["status"] = "succeeded"
        job_id = garment_job(store)
        store.jobs[job_id]["scan_job_id"] = scan["id"]
        store.jobs[job_id]["candidate_ids"] = ["c0"]
    store.jobs[job_id]["max_attempts"] = 1
    while await run_once(store, logging_factory(raise_with=raise_with, items=items)):
        pass
    assert store.jobs[job_id]["status"] == "failed"
    assert store.jobs[job_id]["failure_code"] == code


async def test_the_sweep_purges_cost_rows_after_400_days():
    assert AI_CALLS_RETENTION_DAYS == 400
    store = MemoryStore()
    now = datetime.now(timezone.utc)
    store.insert_ai_calls([{"stage": "old", "model": "m", "status": "ok", "created_at": now - timedelta(days=401)},
                           {"stage": "new", "model": "m", "status": "ok", "created_at": now - timedelta(days=399)}])
    _sweep_now(store)
    assert [c["stage"] for c in store.ai_calls] == ["new"]
