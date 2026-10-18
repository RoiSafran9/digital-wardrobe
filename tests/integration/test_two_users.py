"""M4: the whole multi-user flow with two accounts, against the local Supabase stack.

Real tokens, database, Storage and RLS; the AI model is faked (no paid calls).
"""
import asyncio
import uuid
import httpx
import pytest
from fastapi.testclient import TestClient
from api.main import create_app
from api.worker import run_once
from tests.api.test_worker import FakeVision, detected, factory, photo_bytes
from tests.integration.conftest import PUBLISHABLE, URL, bearer, sign_in


@pytest.fixture(scope="module")
def client(settings):
    return TestClient(create_app(settings, start_worker=False))


async def drain(store, providers, limit=20):
    for _ in range(limit):
        if not await run_once(store, providers):
            return


def capture(client, token, data=None):
    r = client.post("/v1/jobs", files={"photo": ("photo.png", data or photo_bytes(), "image/png")},
                    headers={**bearer(token), "Idempotency-Key": str(uuid.uuid4())})
    assert r.status_code == 202, r.text
    return r.json()["id"]


def closet(client, token):
    return client.get("/v1/items", headers=bearer(token)).json()["items"]


def storage_get(path, token):
    return httpx.get(f"{URL}/storage/v1/object/authenticated/wardrobe/{path}", headers={"apikey": PUBLISHABLE, **bearer(token)})


@pytest.fixture(scope="module")
def pieces(client, store, users):
    """A and B each add a piece; the worker processes both."""
    a, b = users
    jobs = (capture(client, a["token"]), capture(client, b["token"]))
    asyncio.run(drain(store, factory(FakeVision([detected(0, text="A SIDE")]))))
    return jobs


async def test_each_user_sees_only_their_own_piece(client, users, pieces):
    a, b = users
    mine, theirs = closet(client, a["token"]), closet(client, b["token"])
    assert len(mine) == 1 and len(theirs) == 1 and mine[0]["id"] != theirs[0]["id"]
    assert client.get(f"/v1/jobs/{pieces[0]}", headers=bearer(b["token"])).status_code == 404


async def test_private_files_are_refused_to_the_other_user_even_straight_from_storage(store, users, pieces):
    a, b = users
    item = store.list_items(a["id"])[0]
    assert storage_get(item["display_path"], a["token"]).status_code == 200
    assert storage_get(item["display_path"], b["token"]).status_code in (400, 403, 404)
    assert httpx.get(f"{URL}/storage/v1/object/public/wardrobe/{item['display_path']}").status_code in (400, 403, 404)


async def test_edit_and_delete_only_touch_the_owners_items(client, users, pieces):
    a, b = users
    mine = closet(client, a["token"])[0]
    assert client.patch(f"/v1/items/{mine['id']}", json={"category": "stolen"}, headers=bearer(b["token"])).status_code == 404
    assert client.delete(f"/v1/items/{mine['id']}", headers=bearer(b["token"])).status_code == 404
    edited = client.patch(f"/v1/items/{mine['id']}", json={"category": "coat"}, headers=bearer(a["token"])).json()
    assert edited["facts"]["category"]["value"] == "coat"
    assert closet(client, a["token"])[0]["facts"]["category"]["value"] == "coat"


async def test_back_and_360_for_one_user_leave_the_other_alone(client, store, users, pieces):
    a, b = users
    mine = closet(client, a["token"])[0]
    client.post(f"/v1/items/{mine['id']}/back", files={"photo": ("b.png", photo_bytes(), "image/png")},
                headers={**bearer(a["token"]), "Idempotency-Key": str(uuid.uuid4())})
    await drain(store, factory(FakeVision([detected(0, text="TEAM 9")])))
    client.post(f"/v1/items/{mine['id']}/turn", headers={**bearer(a["token"]), "Idempotency-Key": str(uuid.uuid4())})
    await drain(store, factory())
    item = client.get(f"/v1/items/{mine['id']}", headers=bearer(a["token"])).json()
    assert item["back"]["visible_text"] == "TEAM 9" and item["turn"]["state"] == "done" and len(item["turn"]["views"]) == 4
    assert httpx.get(item["turn"]["views"][2]["url"]).status_code == 200
    theirs = closet(client, b["token"])[0]
    assert theirs["back"] is None and theirs["turn"] is None


class CrashOnce(FakeVision):
    calls = 0

    async def detect_items_with_facts(self, image_path):
        CrashOnce.calls += 1
        if CrashOnce.calls == 1:
            raise RuntimeError("model hiccup")
        return [detected(0)]


async def test_a_job_that_crashes_once_is_retried_and_succeeds_once(client, store, users, pieces):
    a, _ = users
    before = len(closet(client, a["token"]))
    job_id = capture(client, a["token"])
    vision = CrashOnce()
    await drain(store, lambda logger: factory(vision)(logger))
    job = client.get(f"/v1/jobs/{job_id}", headers=bearer(a["token"])).json()
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 1
    assert len(closet(client, a["token"])) == before + 1


async def test_an_unusable_photo_fails_with_its_reason_and_leaves_no_files(client, store, users, pieces):
    a, _ = users
    before = {i["id"] for i in closet(client, a["token"])}
    job_id = capture(client, a["token"])
    await drain(store, factory(FakeVision([])))
    job = client.get(f"/v1/jobs/{job_id}", headers=bearer(a["token"])).json()
    # No garment found fails with a reason the app shows; finishing "succeeded" with no pieces
    # looked like a hang on the phone.
    assert job["status"] == "failed" and "no garment" in job["error"].lower()
    assert {i["id"] for i in closet(client, a["token"])} == before
    assert store.list_paths(f"{a['id']}/jobs/{job_id}") == []


async def test_another_device_and_a_restarted_server_see_the_same_closet(settings, client, users, pieces):
    a, _ = users
    first = sorted(i["id"] for i in closet(client, a["token"]))
    other_device = sign_in(a["email"])
    restarted = TestClient(create_app(settings, start_worker=False))
    assert sorted(i["id"] for i in closet(restarted, other_device)) == first


async def test_removed_items_disappear_for_every_device(client, users, pieces):
    a, _ = users
    mine = closet(client, a["token"])[0]
    assert client.delete(f"/v1/items/{mine['id']}", headers=bearer(a["token"])).status_code == 204
    assert mine["id"] not in {i["id"] for i in closet(client, sign_in(a["email"]))}
