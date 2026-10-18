"""Against a running local Supabase stack (npx supabase start). Skipped unless configured:

  SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_SECRET_KEY=... SUPABASE_TEST_PUBLISHABLE_KEY=... pytest tests/integration
"""
import uuid
import httpx
import pytest
from fastapi.testclient import TestClient
from api.auth import InvalidToken, Settings, TokenVerifier
from api.main import create_app

from tests.integration.conftest import PUBLISHABLE, SECRET, URL


def test_real_tokens_verify_and_a_wrong_issuer_does_not(users):
    verifier = TokenVerifier(f"{URL}/auth/v1/.well-known/jwks.json", f"{URL}/auth/v1")
    assert verifier.verify(users[0]["token"]).id == users[0]["id"]
    with pytest.raises(InvalidToken):
        TokenVerifier(f"{URL}/auth/v1/.well-known/jwks.json", "https://other/auth/v1").verify(users[0]["token"])


def test_files_upload_sign_download_remove(store, users):
    path = f"{users[0]['id']}/items/{uuid.uuid4()}/generated.png"
    store.upload(path, b"\x89PNG fake", "image/png")
    assert store.download(path) == b"\x89PNG fake"
    url = store.sign([path])[path]
    assert httpx.get(url).content == b"\x89PNG fake"
    store.remove([path])
    assert store.sign([path]) == {}


def test_jobs_are_idempotent_and_per_user(store, users):
    a, b = users
    job, created = store.create_job(a["id"], "garment", "integration-key", None)
    again, created_again = store.create_job(a["id"], "garment", "integration-key", None)
    assert (created, created_again) == (True, False) and again["id"] == job["id"]
    assert store.get_job(b["id"], job["id"]) is None
    claimed = store.claim_job(60)
    assert claimed["status"] == "running" and claimed["attempts"] == 1
    store.finish_job(claimed["id"], "succeeded", {"item_ids": []})
    assert store.get_job(claimed["user_id"], claimed["id"])["status"] == "succeeded"


def test_items_are_isolated_and_deduplicated(store, users):
    a, b = users
    job, _ = store.create_job(a["id"], "garment", f"items-{uuid.uuid4()}", None)
    base = f"{a['id']}/items/{uuid.uuid4()}"
    row = {"user_id": a["id"], "job_id": job["id"], "piece_index": 0, "tier": "high", "facts": {"category": {"value": "x"}},
           "source_path": f"{base}/source.jpg", "display_path": f"{base}/generated.png"}
    item = store.insert_item(row)
    assert store.insert_item(row)["id"] == item["id"]
    assert [i["id"] for i in store.list_items(a["id"])].count(item["id"]) == 1
    assert store.list_items(b["id"]) == [] and store.get_item(b["id"], item["id"]) is None
    assert store.update_item(b["id"], item["id"], {"deleted_at": "2026-10-18T00:00:00Z"}) is None
    assert store.update_item(a["id"], item["id"], {"facts": {"category": {"value": "y"}}})["facts_original"] == {"category": {"value": "x"}}


def test_the_v1_api_keeps_users_apart_with_real_tokens(settings, users):
    a, b = users
    client = TestClient(create_app(settings, start_worker=False))
    photo = ("photo.jpg", b"\xff\xd8\xff fake", "image/jpeg")
    r = client.post("/v1/jobs", files={"photo": photo},
                    headers={"Authorization": f"Bearer {a['token']}", "Idempotency-Key": str(uuid.uuid4())})
    assert r.status_code == 202
    job_id = r.json()["id"]
    assert client.get(f"/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {a['token']}"}).status_code == 200
    assert client.get(f"/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {b['token']}"}).status_code == 404
    assert client.get("/v1/items", headers={"Authorization": f"Bearer {b['token']}"}).json() == {"items": []}
    assert client.get("/v1/items", headers={"Authorization": "Bearer not-a-token"}).status_code == 401


async def test_a_job_runs_end_to_end_through_the_worker(settings, store, users):
    from api.worker import run_once
    from tests.api.test_worker import FakeVision, detected, factory, photo_bytes
    a, b = users
    client = TestClient(create_app(settings, start_worker=False))
    headers = {"Authorization": f"Bearer {a['token']}", "Idempotency-Key": str(uuid.uuid4())}
    job_id = client.post("/v1/jobs", files={"photo": ("photo.png", photo_bytes(), "image/png")}, headers=headers).json()["id"]

    for _ in range(10):  # other queued test jobs may be ahead of ours
        await run_once(store, factory(FakeVision([detected(0)])))
        job = client.get(f"/v1/jobs/{job_id}", headers={"Authorization": f"Bearer {a['token']}"}).json()
        if job["status"] in ("succeeded", "failed"):
            break
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 1

    items = client.get("/v1/items", headers={"Authorization": f"Bearer {a['token']}"}).json()["items"]
    mine = next(i for i in items if i["id"] == job["item_ids"][0])
    assert httpx.get(mine["generated_url"]).status_code == 200
    assert client.patch(f"/v1/items/{mine['id']}", json={"category": "coat"},
                        headers={"Authorization": f"Bearer {b['token']}"}).status_code == 404
    assert client.patch(f"/v1/items/{mine['id']}", json={"category": "coat"},
                        headers={"Authorization": f"Bearer {a['token']}"}).json()["facts"]["category"]["value"] == "coat"


def test_jobs_store_their_credit_cost(store, users):
    job, _ = store.create_job(users[0]["id"], "garment", f"cost-{uuid.uuid4()}", None, cost_credits=2)
    assert store.get_job(users[0]["id"], job["id"])["cost_credits"] == 2
