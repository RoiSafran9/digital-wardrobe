"""Deleting your own account: everything of yours goes, nobody else's does."""
import pytest
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, as_user, v1_client
from tests.api.test_v1_items import add_item


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def _seed(store, user):
    item = add_item(store, user)
    store.upload(f"{user}/items/{item['id']}/generated.png", b"png", "image/png")
    store.create_job(user, "garment", f"k-{user}", f"{user}/jobs/j/upload.jpg")
    store.credit_grant(user, 10, f"grant-{user}", "test", "admin")
    return item


def test_delete_account_removes_only_your_own_data(client, store):
    _seed(store, A)
    theirs = _seed(store, B)
    r = client.request("DELETE", "/v1/account", json={"confirm": "DELETE"}, headers=as_user(A))
    assert r.status_code == 204
    assert not store.user_exists(A)
    assert not [p for p in store.files if p.startswith(f"{A}/")]
    assert not [i for i in store.items.values() if i["user_id"] == A]
    assert not [j for j in store.jobs.values() if j["user_id"] == A]
    assert store.credits(A) is None or store.credits(A)["balance"] == 0
    # The other account is untouched.
    assert store.user_exists(B)
    assert store.get_item(B, theirs["id"]) is not None
    assert [p for p in store.files if p.startswith(f"{B}/")]
    assert store.credits(B)["balance"] == 10


def test_delete_account_requires_the_confirmation_word(client, store):
    _seed(store, A)
    for body in (None, {}, {"confirm": "yes"}):
        r = client.request("DELETE", "/v1/account", json=body, headers=as_user(A))
        assert r.status_code == 400
    assert store.user_exists(A)


def test_delete_account_needs_sign_in(client):
    assert client.request("DELETE", "/v1/account", json={"confirm": "DELETE"}).status_code == 401


def test_job_progress_is_visible_to_its_owner_only(client, store):
    job, _ = store.create_job(A, "garment", "k1", None)
    store.set_job_progress(job["id"], 1, 3)
    assert client.get(f"/v1/jobs/{job['id']}", headers=as_user(A)).json()["progress"] == {"done": 1, "total": 3}
    assert client.get(f"/v1/jobs/{job['id']}", headers=as_user(B)).status_code == 404
