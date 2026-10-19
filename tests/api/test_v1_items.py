"""User-scoped items: each user sees and changes only their own; others' IDs act like they don't exist."""
from datetime import datetime, timedelta, timezone
import pytest
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, PHOTO, as_user, v1_client


def _field(value):
    return {"value": value, "confidence": 0.8, "basis": "observed"}


FACTS = {"category": _field("jacket"), "colors": _field(["gray"]), "pattern": _field("solid"),
         "visible_text": _field(""), "trims": _field("zip collar"),
         "visible_parts": _field(["front"]), "occluded_parts": _field(["back"])}


def add_item(store, user, **extra):
    row = {"user_id": user, "tier": "high", "facts": FACTS,
           "source_path": f"{user}/items/x/source.jpg", "display_path": f"{user}/items/x/generated.png",
           "crop_path": f"{user}/items/x/crop.png", "cutout_path": f"{user}/items/x/cutout.png", **extra}
    return store.insert_item(row)


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def test_list_shows_only_the_callers_items_with_signed_image_urls(client, store):
    mine = add_item(store, A)
    add_item(store, B)
    items = client.get("/v1/items", headers=as_user(A)).json()["items"]
    assert [i["id"] for i in items] == [mine["id"]]
    item = items[0]
    assert item["generated_url"] == f"https://storage.test/{A}/items/x/generated.png?token=signed"
    assert item["crop_url"].startswith(f"https://storage.test/{A}/") and item["cutout_url"].startswith(f"https://storage.test/{A}/")
    assert item["facts"]["category"]["value"] == "jacket" and item["tier"] == "high"
    assert item["back"] is None and item["turn"] is None


def test_back_and_finished_360_come_with_signed_urls(client, store):
    add_item(store, A,
             back={"generated_path": f"{A}/items/x/back/generated.png", "cutout_path": None, "visible_text": "LOGO"},
             turn={"state": "done", "views": [{"angle": "front", "path": f"{A}/items/x/turn/front.png",
                                               "cutout_path": f"{A}/items/x/turn/front_cutout.png"}]})
    item = client.get("/v1/items", headers=as_user(A)).json()["items"][0]
    assert item["back"] == {"generated_url": f"https://storage.test/{A}/items/x/back/generated.png?token=signed",
                            "cutout_url": None, "visible_text": "LOGO"}
    assert item["turn"]["state"] == "done" and item["turn"]["views"][0]["url"].endswith("turn/front.png?token=signed")


def test_a_360_stuck_running_for_too_long_reads_as_interrupted(client, store):
    old = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    add_item(store, A, turn={"state": "running", "started_at": old})
    assert client.get("/v1/items", headers=as_user(A)).json()["items"][0]["turn"] == {
        "state": "failed", "error": "Interrupted — try again", "views": []}


def test_deleted_items_are_hidden(client, store):
    item = add_item(store, A)
    assert client.delete(f"/v1/items/{item['id']}", headers=as_user(A)).status_code == 204
    assert client.get("/v1/items", headers=as_user(A)).json()["items"] == []
    assert store.items[item["id"]]["deleted_at"] is not None  # soft delete: recoverable


def test_patch_edits_facts_and_keeps_the_original(client, store):
    item = add_item(store, A)
    r = client.patch(f"/v1/items/{item['id']}", json={"category": " coat ", "colors": ["navy"]}, headers=as_user(A))
    assert r.status_code == 200
    assert r.json()["facts"]["category"]["value"] == "coat" and r.json()["facts"]["colors"]["value"] == ["navy"]
    assert store.items[item["id"]]["facts_original"]["category"]["value"] == "jacket"


def test_patch_name_v1(client, store):
    item = add_item(store, A)
    r = client.patch(f"/v1/items/{item['id']}", json={"name": "Cream sweater"}, headers=as_user(A))
    assert r.status_code == 200 and r.json()["facts"]["name"]["value"] == "Cream sweater"
    assert "name" not in (store.items[item["id"]]["facts_original"] or {}) or store.items[item["id"]]["facts_original"].get("name") is None


def test_patch_name_v1_other_user_404(client, store):
    item = add_item(store, A)
    r = client.patch(f"/v1/items/{item['id']}", json={"name": "Mine now"}, headers=as_user(B))
    assert r.status_code == 404
    assert store.items[item["id"]]["facts"].get("name") is None


@pytest.mark.parametrize("patch,message", [
    ({"name": "x" * 61}, "name must be 1 to 60 characters"),
    ({"category": "  "}, "category can't be empty"),
    ({"colors": ["chartreuse"]}, "colors must be one or more of:"),
    ({"pattern": "zigzag"}, "pattern must be one of:"),
])
def test_patch_validates_like_the_local_api(client, store, patch, message):
    item = add_item(store, A)
    r = client.patch(f"/v1/items/{item['id']}", json=patch, headers=as_user(A))
    assert r.status_code == 400 and r.json()["error"].startswith(message)


@pytest.mark.parametrize("method,suffix,kwargs", [
    ("patch", "", {"json": {"category": "stolen"}}),
    ("delete", "", {}),
    ("post", "/back", {"files": {"photo": PHOTO}}),
    ("post", "/turn", {}),
])
def test_another_users_item_answers_404_and_stays_untouched(client, store, method, suffix, kwargs):
    item = add_item(store, A)
    before = dict(store.items[item["id"]])
    r = getattr(client, method)(f"/v1/items/{item['id']}{suffix}", headers=as_user(B, "k1"), **kwargs)
    assert r.status_code == 404 and r.json() == {"error": "not found"}
    assert store.items[item["id"]] == before and store.jobs == {} and store.files == {}


@pytest.mark.parametrize("item_id", ["not-a-uuid", "00000000-0000-4000-8000-000000000000"])
def test_unknown_items_answer_404(client, item_id):
    assert client.patch(f"/v1/items/{item_id}", json={}, headers=as_user(A)).status_code == 404


def test_back_photo_queues_a_back_job_for_the_item(client, store):
    item = add_item(store, A)
    r = client.post(f"/v1/items/{item['id']}/back", files={"photo": PHOTO}, headers=as_user(A, "back-1"))
    assert r.status_code == 202
    job = store.jobs[r.json()["id"]]
    assert (job["kind"], job["item_id"], job["user_id"]) == ("back", item["id"], A)
    assert job["input_path"].startswith(f"{A}/jobs/")


def test_360_queues_once_and_marks_the_item_running(client, store):
    item = add_item(store, A)
    r = client.post(f"/v1/items/{item['id']}/turn", headers=as_user(A, "turn-1"))
    assert r.status_code == 202 and store.jobs[r.json()["id"]]["kind"] == "turn"
    assert store.items[item["id"]]["turn"]["state"] == "running"
    again = client.post(f"/v1/items/{item['id']}/turn", headers=as_user(A, "turn-2"))
    assert again.status_code == 409 and again.json() == {"error": "the 360 view is already being made"}


def test_items_routes_need_sign_in(client):
    assert client.get("/v1/items").status_code == 401


def test_items_say_when_they_were_added(client, store):
    add_item(store, A)
    created = client.get("/v1/items", headers=as_user(A)).json()["items"][0]["created_at"]
    assert created.startswith("20")  # ISO timestamp


def test_one_item_can_be_fetched_by_its_owner_only(client, store):
    item = add_item(store, A)
    r = client.get(f"/v1/items/{item['id']}", headers=as_user(A))
    assert r.status_code == 200 and r.json()["id"] == item["id"] and r.json()["generated_url"].endswith("?token=signed")
    assert client.get(f"/v1/items/{item['id']}", headers=as_user(B)).status_code == 404
    assert client.get("/v1/items/not-a-uuid", headers=as_user(A)).status_code == 404
