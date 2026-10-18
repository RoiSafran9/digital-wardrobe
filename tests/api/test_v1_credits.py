"""Credit hooks in the job flow: cost recorded per job, one hold per job, refused when credits run out."""
import pytest
from api.credits import InsufficientCredits, get_gate, get_prices
from api.store import MemoryStore
from tests.api.v1_helpers import A, PHOTO, as_user, v1_client


class RecordingGate:
    def __init__(self, refuse=False):
        self.calls, self.refuse = [], refuse

    def reserve(self, user_id, job_id, kind, cost):
        self.calls.append(("reserve", user_id, job_id, kind, cost))
        if self.refuse:
            raise InsufficientCredits()

    def release(self, job_id):
        self.calls.append(("release", job_id))

    def settle(self, job_id, amount):
        self.calls.append(("settle", job_id, amount))

    def refund(self, job_id):
        self.calls.append(("refund", job_id))

    def reconcile(self):
        return 0


def client_with(store, gate, prices):
    client = v1_client(store)
    client.app.dependency_overrides[get_gate] = lambda: gate
    client.app.dependency_overrides[get_prices] = lambda: prices
    return client


@pytest.fixture
def store():
    return MemoryStore()


def test_billing_off_records_no_cost(store):
    gate = RecordingGate()
    r = client_with(store, gate, {}).post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 202 and r.json()["cost_credits"] is None
    assert store.jobs[r.json()["id"]]["cost_credits"] is None


def test_each_job_records_its_cost_and_holds_it_once(store):
    gate = RecordingGate()
    client = client_with(store, gate, {"garment": 2, "turn": 5})
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    job_id = r.json()["id"]
    assert r.json()["cost_credits"] == 2 and store.jobs[job_id]["cost_credits"] == 2
    client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))  # repeat
    assert gate.calls == [("reserve", A, job_id, "garment", 2)]


def test_a_lost_race_on_the_same_key_releases_its_hold(store, monkeypatch):
    gate = RecordingGate()
    client = client_with(store, gate, {"garment": 2})
    first = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()["id"]
    monkeypatch.setattr(store, "job_by_key", lambda user, key: None)
    client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    (_, _, second_hold, _, _), release = gate.calls[1], gate.calls[2]
    assert second_hold != first and release == ("release", second_hold)


def test_running_out_of_credits_refuses_the_job_and_leaves_nothing(store):
    r = client_with(store, RecordingGate(refuse=True), {"garment": 2}).post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 402 and r.json() == {"error": "not enough AI credits"}
    assert store.jobs == {} and store.files == {}


def test_the_price_list_is_served_to_signed_in_users(store):
    client = client_with(store, RecordingGate(), {"garment": 1, "turn": 3})
    assert client.get("/v1/prices", headers=as_user(A)).json() == {"billing": True, "prices": {"garment": 1, "turn": 3}}
    assert client_with(store, RecordingGate(), {}).get("/v1/prices", headers=as_user(A)).json() == {"billing": False, "prices": {}}
    assert client.get("/v1/prices").status_code == 401
