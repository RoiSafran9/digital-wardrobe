"""Per-action billing in the job API and worker, with the wallet in memory (billing on in these tests only)."""
import pytest
from api.credits import WalletGate, get_gate, get_prices
from api.store import MemoryStore
from api.worker import run_once
from tests.api.test_worker import FakeVision, detected, factory, photo_bytes
from tests.api.v1_helpers import A, B, as_user, v1_client

PHOTO = ("photo.png", photo_bytes(), "image/png")

PRICES = {"garment": 1, "back": 1, "turn": 3}


@pytest.fixture
def store():
    s = MemoryStore()
    s.credit_grant(A, 5, "ff", "F&F pilot", "owner")
    return s


@pytest.fixture
def gate(store):
    return WalletGate(store)


@pytest.fixture
def client(store, gate):
    c = v1_client(store)
    c.app.dependency_overrides[get_gate] = lambda: gate
    c.app.dependency_overrides[get_prices] = lambda: PRICES
    return c


def capture(client, user=A, key="k1", **data):
    return client.post("/v1/jobs", files={"photo": PHOTO}, data=data, headers=as_user(user, key))


def test_a_capture_holds_one_front_by_default(client, store):
    r = capture(client)
    assert r.status_code == 202 and r.json()["max_fronts"] == 1 and r.json()["cost_credits"] == 1
    assert store.credits(A) == {"balance": 5, "held": 1}


def test_approving_more_fronts_holds_price_times_fronts(client, store):
    r = capture(client, max_fronts="3")
    assert r.json()["max_fronts"] == 3 and store.credits(A)["held"] == 3


@pytest.mark.parametrize("value", ["0", "21", "two", "-1"])
def test_a_bad_max_fronts_is_refused(client, store, value):
    assert capture(client, max_fronts=value).status_code == 400
    assert store.credits(A)["held"] == 0 and store.jobs == {}


def test_more_fronts_than_credits_is_refused_before_anything_is_uploaded(client, store):
    r = capture(client, max_fronts="6")
    assert r.status_code == 402 and store.jobs == {} and store.files == {}


def test_an_account_without_credits_cannot_start_paid_work(client, store):
    assert capture(client, user=B).status_code == 402


def test_a_repeated_request_holds_once(client, store):
    capture(client, max_fronts="2")
    capture(client, max_fronts="2")
    assert store.credits(A)["held"] == 2


async def test_two_pieces_with_one_front_approved_make_and_charge_one(client, store, gate):
    job_id = capture(client).json()["id"]
    await run_once(store, factory(FakeVision([detected(0), detected(500)])), gate=gate)
    job = client.get(f"/v1/jobs/{job_id}", headers=as_user(A)).json()
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 1 and job["over_limit"] == 1
    assert store.credits(A) == {"balance": 4, "held": 0}


async def test_three_approved_two_made_charges_two_and_gives_one_back(client, store, gate):
    capture(client, max_fronts="3")
    await run_once(store, factory(FakeVision([detected(0), detected(500)])), gate=gate)
    assert store.credits(A) == {"balance": 3, "held": 0}
    assert [(e["kind"], e["amount"]) for e in store.ledger[-2:]] == [("charge", 2), ("release", 1)]


async def test_a_photo_with_no_garment_costs_nothing(client, store, gate):
    capture(client, max_fronts="2")
    await run_once(store, factory(FakeVision([])), gate=gate)
    assert store.credits(A) == {"balance": 5, "held": 0}


async def test_a_job_that_fails_for_good_costs_nothing(client, store, gate):
    capture(client)
    for _ in range(2):
        await run_once(store, factory(FakeVision(crash=True)), gate=gate)
    assert store.credits(A) == {"balance": 5, "held": 0}


async def test_back_and_360_are_one_action_each(client, store, gate):
    capture(client)
    await run_once(store, factory(FakeVision([detected(0)])), gate=gate)
    item = store.list_items(A)[0]["id"]
    client.post(f"/v1/items/{item}/back", files={"photo": PHOTO}, headers=as_user(A, "b1"))
    await run_once(store, factory(FakeVision([detected(0)])), gate=gate)
    client.post(f"/v1/items/{item}/turn", headers=as_user(A, "t1"))
    await run_once(store, factory(), gate=gate)
    assert [(e["kind"], e["action"], e["amount"]) for e in store.ledger if e["kind"] == "charge"] == [
        ("charge", "garment", 1), ("charge", "back", 1), ("charge", "turn", 3)]
    assert store.credits(A) == {"balance": 0, "held": 0}
    assert client.post(f"/v1/items/{item}/turn", headers=as_user(A, "t2")).status_code == 402


async def test_a_failed_settle_leaves_the_job_done_and_reconcile_charges_it(client, store, gate, monkeypatch):
    job_id = capture(client).json()["id"]
    monkeypatch.setattr(store, "credit_settle", lambda *a: (_ for _ in ()).throw(RuntimeError("network")))
    await run_once(store, factory(FakeVision([detected(0)])), gate=gate)
    assert store.jobs[job_id]["status"] == "succeeded" and store.credits(A)["held"] == 1
    monkeypatch.undo()
    assert gate.reconcile() == 1
    assert store.credits(A) == {"balance": 4, "held": 0}


async def test_reconcile_releases_a_job_the_queue_expired(client, store, gate):
    job_id = capture(client).json()["id"]
    store.jobs[job_id].update(status="failed", error="Interrupted — try again")  # as claim_generation_job does
    gate.reconcile()
    assert store.credits(A) == {"balance": 5, "held": 0}


def test_reconcile_releases_a_stale_hold_whose_job_never_appeared(store):
    store.credit_reserve(A, "never-created", "garment", 2)
    assert WalletGate(store, grace_seconds=3600).reconcile() == 0  # its request may still be running
    assert WalletGate(store, grace_seconds=0).reconcile() == 1
    assert store.credits(A) == {"balance": 5, "held": 0}


def test_billing_off_ignores_max_fronts_and_holds_nothing(store):
    c = v1_client(store)
    r = c.post("/v1/jobs", files={"photo": PHOTO}, data={"max_fronts": "3"}, headers=as_user(A, "k1"))
    assert r.status_code == 202 and r.json()["max_fronts"] is None and r.json()["cost_credits"] is None
    assert store.credits(A)["held"] == 0
