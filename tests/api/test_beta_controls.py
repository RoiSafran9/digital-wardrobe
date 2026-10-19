"""Beta controls: pausing new AI work, limits on free scans, the one-time welcome grant, and health."""
import pytest
from fastapi.testclient import TestClient
from api.store import MemoryStore
from tests.api.test_outfit_generate import client_for
from tests.api.v1_helpers import A, B, PHOTO, as_user


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return client_for(store)


# --- pause switch -----------------------------------------------------------------------------------

def test_pausing_generation_refuses_new_ai_work_but_keeps_the_closet_readable(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_GENERATION", "off")
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 503 and "paused" in r.json()["error"]
    assert client.post("/v1/garment-scans", files={"photo": PHOTO}, headers=as_user(A, "k2")).status_code == 503
    assert client.get("/v1/items", headers=as_user(A)).status_code == 200
    assert client.get("/v1/prices", headers=as_user(A)).json()["generation"] is False
    assert store.jobs == {}


def test_generation_is_on_by_default(client):
    assert client.get("/v1/prices", headers=as_user(A)).json()["generation"] is True


# --- free scan limit --------------------------------------------------------------------------------

def test_free_scans_are_limited_per_account_per_hour(client, monkeypatch):
    monkeypatch.setenv("WARDROBE_FREE_SCANS_PER_HOUR", "2")
    codes = [client.post("/v1/garment-scans", files={"photo": PHOTO}, headers=as_user(A, f"s{i}")).status_code for i in range(3)]
    assert codes == [202, 202, 429]
    assert client.post("/v1/garment-scans", files={"photo": PHOTO}, headers=as_user(B, "s9")).status_code == 202
    # A retry with the same key is not a new scan.
    assert client.post("/v1/garment-scans", files={"photo": PHOTO}, headers=as_user(A, "s0")).status_code == 200


# --- welcome credits ----------------------------------------------------------------------------------

def test_welcome_credits_are_off_unless_configured(client, store):
    r = client.post("/v1/bootstrap", headers=as_user(A))
    assert r.status_code == 200 and r.json() == {"welcome_granted": 0}
    assert store.credit_granted(A) == 0


def test_an_invited_account_gets_the_welcome_grant_exactly_once(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_WELCOME_CREDITS", "40")
    monkeypatch.setenv("WARDROBE_BETA_INVITES", f"{A}@test.dev, friend@x.com")
    first = client.post("/v1/bootstrap", headers=as_user(A)).json()
    again = client.post("/v1/bootstrap", headers=as_user(A)).json()
    assert first == {"welcome_granted": 40} and again == {"welcome_granted": 0}
    assert store.credit_granted(A) == 40
    # Not invited: nothing.
    assert client.post("/v1/bootstrap", headers=as_user(B)).json() == {"welcome_granted": 0}
    assert store.credit_granted(B) == 0


def test_an_open_beta_invites_everyone_but_never_a_disabled_account(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_WELCOME_CREDITS", "10")
    monkeypatch.setenv("WARDROBE_BETA_INVITES", "*")
    store.disabled.add(B)
    assert client.post("/v1/bootstrap", headers=as_user(A)).json() == {"welcome_granted": 10}
    assert client.post("/v1/bootstrap", headers=as_user(B)).status_code in (200, 403)
    assert store.credit_granted(B) == 0


# --- health ----------------------------------------------------------------------------------------------

def test_health_needs_no_sign_in_and_reports_the_queue(store):
    from api.routes.health import router
    from api.store import get_store
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_store] = lambda: store
    store.create_job(A, "garment", "k", None)
    body = TestClient(app).get("/healthz").json()
    assert body["status"] == "ok" and body["queued"] == 1 and body["oldest_queued_seconds"] >= 0
    assert "generation" in body


# --- daily AI budget -----------------------------------------------------------------------------------

def test_a_daily_cap_on_ai_jobs_stops_new_paid_work_for_everyone(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_DAILY_AI_JOBS", "2")
    codes = [client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(u, f"j{i}")).status_code
             for i, u in enumerate([A, B, A])]
    assert codes == [202, 202, 503]
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(B, "j9"))
    assert "today" in r.json()["error"].lower()
    # Free scans are limited separately, not by the daily AI budget.
    assert client.post("/v1/garment-scans", files={"photo": PHOTO}, headers=as_user(A, "s1")).status_code == 202


def test_no_daily_cap_by_default(client):
    codes = [client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, f"j{i}")).status_code for i in range(3)]
    assert codes == [202, 202, 202]


# --- scheduled cleanup --------------------------------------------------------------------------------

async def test_the_worker_sweeps_storage_on_schedule_only_when_asked(store, monkeypatch):
    from api import worker
    calls = []
    monkeypatch.setattr(worker, "_sweep_now", lambda s: calls.append(s))
    monkeypatch.delenv("WARDROBE_SWEEP_EVERY_HOURS", raising=False)
    assert worker.maybe_sweep(store, now=10_000.0) is False and calls == []
    monkeypatch.setenv("WARDROBE_SWEEP_EVERY_HOURS", "6")
    worker._last_sweep = None
    assert worker.maybe_sweep(store, now=10_000.0) is True
    assert worker.maybe_sweep(store, now=10_000.0 + 3600) is False  # not yet due
    assert worker.maybe_sweep(store, now=10_000.0 + 6 * 3600) is True
    assert len(calls) == 2
