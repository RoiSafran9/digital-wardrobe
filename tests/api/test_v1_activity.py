"""Server activity events: recorded once, after the action succeeded, from the verified account (spec §4.1)."""
import pytest
from api.credits import WalletGate, get_gate, get_prices
from api.store import MemoryStore
from api.worker import run_once
from tests.api.test_v1_items import add_item
from tests.api.test_worker import factory, garment_job, photo_bytes
from tests.api.v1_helpers import A, as_user, v1_client

PHOTO = ("photo.png", photo_bytes(), "image/png")


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def server_events(store, name=None):
    return [e for e in store.events if e["source"] == "server" and (name is None or e["event"] == name)]


def test_edits_record_each_changed_field_and_whether_it_was_the_first(client, store):
    item = add_item(store, A)
    assert client.patch(f"/v1/items/{item['id']}", json={"category": "coat", "colors": ["navy"]}, headers=as_user(A)).status_code == 200
    assert client.patch(f"/v1/items/{item['id']}", json={"name": "Old coat"}, headers=as_user(A)).status_code == 200
    events = server_events(store, "item_edited")
    assert sorted((e["props"]["field"], e["props"]["first"]) for e in events) == \
        [("category", True), ("colors", True), ("name", False)]
    assert all(e["item_id"] == item["id"] and e["user_id"] == A for e in events)
    assert "coat" not in str(events) and "navy" not in str(events)


def test_a_refused_edit_records_nothing(client, store):
    item = add_item(store, A)
    assert client.patch(f"/v1/items/{item['id']}", json={"category": ""}, headers=as_user(A)).status_code == 400
    assert server_events(store) == []


def test_discard_and_remove_are_told_apart(client, store):
    pending = add_item(store, A, origin="outfit_photo", review_state="pending")
    garment = add_item(store, A)
    client.delete(f"/v1/items/{pending['id']}", headers=as_user(A))
    client.delete(f"/v1/items/{garment['id']}", headers=as_user(A))
    assert [e["props"]["review"] for e in server_events(store, "item_deleted")] == ["pending", "none"]


def test_keeping_an_outfit_result_is_recorded(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT", "on")
    item = add_item(store, A, origin="outfit_photo", review_state="pending")
    assert client.post(f"/v1/items/{item['id']}/keep", headers=as_user(A)).status_code == 200
    [event] = server_events(store, "item_kept")
    assert event["item_id"] == item["id"]


def test_push_on_and_off(client, store):
    token = {"token": "ExponentPushToken[abc]"}
    client.post("/v1/push-token", json=token, headers=as_user(A))
    client.request("DELETE", "/v1/push-token", json=token, headers=as_user(A))
    assert [e["event"] for e in server_events(store)] == ["push_enabled", "push_disabled"]
    assert "ExponentPushToken" not in str(store.events)


def test_sign_ins_and_the_welcome_grant(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_WELCOME_CREDITS", "40")
    monkeypatch.setenv("WARDROBE_BETA_INVITES", "*")
    client.post("/v1/bootstrap", headers=as_user(A))
    client.post("/v1/bootstrap", headers=as_user(A))
    assert [e["props"]["first"] for e in server_events(store, "signed_in")] == [True, False]
    assert [e["props"] for e in server_events(store, "welcome_granted")] == [{"credits": 40}]


def test_no_credits_refusal_is_recorded(store):
    client = v1_client(store)
    client.app.dependency_overrides[get_gate] = lambda: WalletGate(store)
    client.app.dependency_overrides[get_prices] = lambda: {"garment": 1, "back": 1, "turn": 3}
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 402
    assert [e["props"] for e in server_events(store, "refused")] == [{"route": "job", "reason": "no_credits"}]


def test_paused_generation_refusal_is_recorded(client, store, monkeypatch):
    monkeypatch.setenv("WARDROBE_GENERATION", "off")
    assert client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).status_code == 503
    assert [e["props"] for e in server_events(store, "refused")] == [{"route": "job", "reason": "unavailable"}]


def test_signed_out_requests_record_nothing(client, store):
    assert client.post("/v1/jobs", files={"photo": PHOTO}).status_code == 401
    assert store.events == []


async def test_a_job_outcome_is_recorded_once_not_per_attempt(store):
    job_id = garment_job(store)
    crashing = factory()

    def crash(logger):
        providers = crashing(logger)
        providers.vision.crash = True
        return providers
    await run_once(store, crash)  # attempt 1 fails and is retried
    assert server_events(store, "job_finished") == []
    await run_once(store, factory())
    [event] = server_events(store, "job_finished")
    assert event["job_id"] == job_id
    props = event["props"]
    assert (props["kind"], props["status"], props["pieces_made"], props["attempts"]) == ("garment", "succeeded", 2, 2)
    assert "failure" not in props and 0 <= props["seconds"] <= 1000


async def test_a_failed_job_says_why(store):
    job_id = garment_job(store)
    store.jobs[job_id]["max_attempts"] = 1
    from tests.api.test_worker import FakeVision
    from pipeline.orchestrator import Providers
    from tests.api.test_worker import FakeImageGen
    await run_once(store, lambda logger: Providers(vision=FakeVision(items=[]), imagegen=FakeImageGen()))
    [event] = server_events(store, "job_finished")
    assert event["props"]["status"] == "failed" and event["props"]["failure"] == "no_garment"
