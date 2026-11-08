"""First-five beta correlation (docs/beta/first-five-mac/04 §2.1): app request id → "job queued" → worker
"job claimed"/"job finished" → ai_calls, all by job id; and nothing secret reaches a log line."""
import asyncio
import json
import logging
import pytest
from api import activity, logs, worker
from api.store import MemoryStore
from tests.api.test_logs import capture  # noqa: F401 (fixture)
from tests.api.test_worker import A
from tests.api.test_worker_ai_calls import garment_job, logging_factory
from tests.api.v1_helpers import PHOTO, as_user, v1_client

RID, RID2 = "ab" * 16, "cd" * 16


def _msgs(lines, msg):
    return [line for line in lines if line["msg"] == msg]


def test_a_queued_job_is_linked_to_the_request_that_made_it(capture):  # noqa: F811
    store = MemoryStore()
    client = v1_client(store)
    first = client.post("/v1/jobs", files={"photo": PHOTO}, headers={**as_user(A, "k1"), "X-Request-ID": RID})
    assert first.status_code == 202 and first.headers["X-Request-ID"] == RID
    again = client.post("/v1/jobs", files={"photo": PHOTO}, headers={**as_user(A, "k1"), "X-Request-ID": RID2})
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    lines = capture()
    [queued] = _msgs(lines, "job queued")
    [reused] = _msgs(lines, "job reused")
    job_id = first.json()["id"]
    assert (queued["request_id"], queued["job_id"], queued["kind"], queued["user_id"]) == (RID, job_id, "garment", A)
    assert (reused["request_id"], reused["job_id"]) == (RID2, job_id)
    assert len(store.jobs) == 1  # the resend made no second job
    assert "photo.jpg" not in json.dumps(lines)


async def test_the_worker_logs_each_job_under_its_id_with_timing_and_cost(capture):  # noqa: F811
    store = MemoryStore()
    job_id = garment_job(store)
    await worker.run_once(store, logging_factory())
    lines = capture()
    [claimed] = _msgs(lines, "job claimed")
    [finished] = _msgs(lines, "job finished")
    for line in (claimed, finished):
        assert line["job_id"] == job_id and line["user_id"] == A and line["kind"] == "garment" and line["attempt"] == 1
        assert "request_id" not in line  # the worker runs outside any request: linked by job id, not faked
    assert finished["outcome"] == "succeeded" and finished["pieces_made"] == 2
    assert finished["ai_calls"] == len(store.ai_calls) == 3
    assert finished["est_cost_usd"] == pytest.approx(sum(c["est_cost_usd"] for c in store.ai_calls))
    assert isinstance(finished["ms"], int) and claimed["since_created_s"] >= 0
    assert {c["job_id"] for c in store.ai_calls} == {job_id}
    assert all(line.get("job_id") in (None, job_id) for line in lines)
    assert logs.job_id.get() is None and logs.user_id.get() is None  # context ends with the job
    assert worker.running_jobs() == 0


async def test_a_retry_and_a_final_failure_are_logged_with_a_code_never_a_secret(capture):  # noqa: F811
    store = MemoryStore()
    job_id = garment_job(store)
    store.jobs[job_id]["max_attempts"] = 2
    leak = RuntimeError("upstream said Bearer abc.def-123 for someone@example.com at https://x.test/a.png?token=s3cr3t")
    await worker.run_once(store, logging_factory(raise_with=leak))
    store.jobs[job_id]["available_at"] = store.jobs[job_id].get("created_at")
    await worker.run_once(store, logging_factory(raise_with=asyncio.TimeoutError()))
    lines = capture()
    [retry] = _msgs(lines, "job will retry")
    [finished] = _msgs(lines, "job finished")
    assert retry["failure_code"] == "internal" and retry["level"] == "WARNING" and retry["job_id"] == job_id
    assert (finished["outcome"], finished["failure_code"], finished["attempt"]) == ("failed", "model_timeout", 2)
    text = json.dumps(lines)
    for secret in ("abc.def-123", "someone@example.com", "s3cr3t"):
        assert secret not in text
    assert "Bearer [redacted]" in text and "[email]" in text


@pytest.mark.parametrize("raw, gone", [
    ("Authorization: Bearer eyJhbGciOi.payload-part.sig", "eyJhbGciOi"),
    ("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123", "eyJzdWIiOiIxMjM0NTY3ODkwIn0"),
    ("GET https://sb.test/storage/v1/object/sign/x.png?token=abc&download=1", "abc&"),
    ("key sb_secret_AbCdEf1234567890 loaded", "AbCdEf1234567890"),
    ("gemini key AIzaSyA1234567890abcdef", "SyA1234567890abcdef"),
    ("code sent to tester@example.com", "tester@example.com"),
])
def test_redact_removes_tokens_keys_and_emails(raw, gone):
    assert gone not in logs.redact(raw)


def test_redacted_lines_stay_valid_json(capture):  # noqa: F811
    logging.getLogger("wardrobe.test").warning('said "https://a.test/x?token=q\\"w" to a@b.co', extra={"fields": {"n": 1}})
    [line] = capture()  # parses
    assert "q\\" not in line["msg"] and "a@b.co" not in line["msg"] and line["n"] == 1


def test_client_errors_may_carry_only_a_well_formed_request_id():
    assert activity.validate("client_error", {"where": "global", "kind": "network", "request_id": RID}) == \
        {"where": "global", "kind": "network", "request_id": RID}
    for bad in ("AB" * 16, "ab" * 15, "someone@example.com", 12):
        with pytest.raises(ValueError):
            activity.validate("client_error", {"where": "global", "kind": "network", "request_id": bad})
    with pytest.raises(ValueError):  # only on client_error
        activity.validate("item_opened", {"has_back": True, "has_turn": False, "request_id": RID})


def test_a_server_error_may_carry_its_http_status():
    props = {"where": "global", "kind": "http_5xx", "request_id": RID, "status": 530}
    assert activity.validate("client_error", props) == props
    for bad in (499, 600, 200, "530", 530.0, True):
        with pytest.raises(ValueError):
            activity.validate("client_error", {**props, "status": bad})


def test_an_app_error_with_its_request_id_is_stored(capture):  # noqa: F811
    store = MemoryStore()
    client = v1_client(store)
    body = {"app_version": "1.0.4", "events": [{"event": "client_error", "client_event_id": "0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e",
                                                "client_at": "2026-11-02T10:00:00Z", "session_id": None,
                                                "props": {"where": "global", "kind": "http_5xx", "request_id": RID, "status": 502}}]}
    assert client.post("/v1/events/batch", json=body, headers=as_user(A)).json()["stored"] == 1
    [row] = [e for e in store.events if e["event"] == "client_error"]
    assert row["props"]["request_id"] == RID and row["props"]["status"] == 502


def test_health_says_how_many_jobs_are_running():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from api.routes.health import router
    from api.store import get_store
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_store] = lambda: MemoryStore()
    assert TestClient(app).get("/healthz").json()["jobs_running"] == 0
