import pytest
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, PHOTO, as_user, v1_client


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def test_a_photo_becomes_a_queued_job_with_the_upload_in_the_users_folder(client, store):
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 202
    job = r.json()
    assert job["status"] == "queued" and job["kind"] == "garment" and job["item_ids"] == []
    stored = store.jobs[job["id"]]
    assert stored["user_id"] == A and stored["input_path"] == f"{A}/jobs/{job['id']}/upload.jpg"
    assert store.files[stored["input_path"]] == PHOTO[1]


def test_retrying_with_the_same_key_returns_the_same_job_without_another_upload(client, store):
    first = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()
    again = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert again.status_code == 200 and again.json()["id"] == first["id"]
    assert len(store.jobs) == 1 and len(store.files) == 1


def test_a_race_on_the_same_key_keeps_one_upload(client, store, monkeypatch):
    # Both requests passed the "already exists?" check; the second loses at insert time.
    first = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()
    monkeypatch.setattr(store, "job_by_key", lambda user, key: None)
    again = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert again.status_code == 200 and again.json()["id"] == first["id"]
    assert list(store.files) == [store.jobs[first["id"]]["input_path"]]


def test_another_user_cannot_see_the_job(client):
    job = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()
    assert client.get(f"/v1/jobs/{job['id']}", headers=as_user(A)).status_code == 200
    r = client.get(f"/v1/jobs/{job['id']}", headers=as_user(B))
    assert r.status_code == 404 and r.json() == {"error": "not found"}


def test_the_same_key_from_another_user_is_a_different_job(client):
    a = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()
    b = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(B, "k1"))
    assert b.status_code == 202 and b.json()["id"] != a["id"]


@pytest.mark.parametrize("headers,files,message", [
    (as_user(A), {"photo": PHOTO}, "missing Idempotency-Key header"),
    (as_user(A, "x" * 201), {"photo": PHOTO}, "missing Idempotency-Key header"),
    (as_user(A, "k1"), None, "no photo provided"),
    (as_user(A, "k1"), {"photo": ("doc.pdf", b"%PDF", "application/pdf")}, "unsupported photo type"),
])
def test_bad_requests(client, headers, files, message):
    r = client.post("/v1/jobs", files=files, headers=headers)
    assert r.status_code == 400 and r.json() == {"error": message}


def test_signed_out_callers_are_refused(client):
    assert client.post("/v1/jobs", files={"photo": PHOTO}).status_code == 401
    assert client.get("/v1/jobs/whatever").status_code == 401


def test_a_disabled_account_cannot_start_jobs(client, store):
    store.disabled.add(A)
    r = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1"))
    assert r.status_code == 403 and r.json() == {"error": "this account is disabled"}
    assert store.jobs == {} and store.files == {}


def test_a_finished_job_reports_its_items_and_quality(client, store):
    job = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k1")).json()
    store.finish_job(job["id"], "succeeded", {"item_ids": ["i1"], "quality": {"status": "ok", "reason": None}, "failed": []})
    body = client.get(f"/v1/jobs/{job['id']}", headers=as_user(A)).json()
    assert body["status"] == "succeeded" and body["item_ids"] == ["i1"] and body["quality"]["status"] == "ok"
