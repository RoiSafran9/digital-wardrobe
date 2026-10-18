"""AI Credits billing end to end with two accounts on the local Supabase stack, the AI faked.

Billing is switched on for this app only (as WARDROBE_BILLING=on would); real tokens, jobs, Storage,
wallet functions and the queue's expiry.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from api.credits import WalletGate, get_gate, get_prices
from api.main import create_app
from api.worker import run_once
from tests.api.test_worker import FakeVision, detected, factory, photo_bytes
from tests.integration.conftest import bearer

PRICES = {"garment": 1, "back": 1, "turn": 3}


@pytest.fixture(scope="module")
def gate(store):
    return WalletGate(store, grace_seconds=0)


@pytest.fixture(scope="module")
def client(settings, gate):
    app = create_app(settings, start_worker=False)
    app.dependency_overrides[get_prices] = lambda: PRICES
    app.dependency_overrides[get_gate] = lambda: gate
    return TestClient(app)


@pytest.fixture(scope="module")
def funded(store, users):
    a, _ = users
    store.credit_grant(a["id"], 4, f"e2e-{uuid.uuid4()}", "billing e2e", "pytest")
    return users


def capture(client, token, **data):
    return client.post("/v1/jobs", files={"photo": ("p.png", photo_bytes(), "image/png")}, data=data,
                       headers={**bearer(token), "Idempotency-Key": str(uuid.uuid4())})


def wallet(client, token):
    return client.get("/v1/credits", headers=bearer(token)).json()


async def drain(store, providers, gate):
    while await run_once(store, providers, gate=gate):
        pass


async def test_each_account_pays_only_for_the_fronts_it_gets(client, store, gate, funded):
    a, b = funded
    assert capture(client, b["token"]).status_code == 402  # B has no credits: nothing queued
    r = capture(client, a["token"], max_fronts="3")
    assert r.status_code == 202 and wallet(client, a["token"])["held"] == 3
    await drain(store, factory(FakeVision([detected(0), detected(500)])), gate)
    job = client.get(f"/v1/jobs/{r.json()['id']}", headers=bearer(a["token"])).json()
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 2 and job["over_limit"] == 0
    mine = wallet(client, a["token"])
    assert (mine["balance"], mine["held"]) == (2, 0)
    assert [(e["kind"], e["amount"]) for e in mine["entries"][:2]] == [("release", 1), ("charge", 2)]
    assert wallet(client, b["token"])["entries"] == [] and wallet(client, b["token"])["balance"] == 0


async def test_a_cap_makes_the_largest_piece_and_reports_the_rest(client, store, gate, funded):
    a, _ = funded
    r = capture(client, a["token"])  # default: one front
    await drain(store, factory(FakeVision([detected(0), detected(500)])), gate)
    job = client.get(f"/v1/jobs/{r.json()['id']}", headers=bearer(a["token"])).json()
    assert len(job["item_ids"]) == 1 and job["over_limit"] == 1
    assert wallet(client, a["token"])["balance"] == 1


async def test_failures_and_expired_jobs_give_credits_back(client, store, gate, funded):
    a, _ = funded
    capture(client, a["token"])
    await drain(store, factory(FakeVision([])), gate)  # no garment: rejected
    assert (wallet(client, a["token"])["balance"], wallet(client, a["token"])["held"]) == (1, 0)

    # A job whose worker died on its last attempt: the queue marks it failed, reconcile releases it.
    job_id = capture(client, a["token"]).json()["id"]
    store._patch("generation_jobs", {"id": f"eq.{job_id}"},
                 {"status": "running", "attempts": 2, "locked_until": "2000-01-01T00:00:00Z"})
    store.claim_job(600)  # the queue marks the dead job failed, outside the worker's refund
    assert store.get_job(a["id"], job_id)["status"] == "failed"
    gate.reconcile()
    assert (wallet(client, a["token"])["balance"], wallet(client, a["token"])["held"]) == (1, 0)


async def test_a_crash_after_finishing_is_settled_by_reconcile(client, store, gate, funded, monkeypatch):
    a, _ = funded
    job_id = capture(client, a["token"]).json()["id"]
    monkeypatch.setattr(gate, "settle", lambda *args: (_ for _ in ()).throw(RuntimeError("worker died")))
    await drain(store, factory(FakeVision([detected(0)])), gate)
    monkeypatch.undo()
    assert store.get_job(a["id"], job_id)["status"] == "succeeded" and wallet(client, a["token"])["held"] == 1
    gate.reconcile()
    assert (wallet(client, a["token"])["balance"], wallet(client, a["token"])["held"]) == (0, 0)
    assert capture(client, a["token"]).status_code == 402  # out of credits now
    assert store.credit_drift() == []
