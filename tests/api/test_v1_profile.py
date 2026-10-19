"""Your profile: your email and the name you chose; only you can read or change it."""
import pytest
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, as_user, v1_client


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def test_a_new_account_has_no_name_yet(client):
    r = client.get("/v1/profile", headers=as_user(A))
    assert r.status_code == 200 and r.json() == {"email": f"{A}@test.dev", "display_name": None}


def test_setting_the_name_trims_it_and_only_changes_your_own(client):
    r = client.patch("/v1/profile", json={"display_name": "  Maya  "}, headers=as_user(A))
    assert r.status_code == 200 and r.json()["display_name"] == "Maya"
    assert client.get("/v1/profile", headers=as_user(A)).json()["display_name"] == "Maya"
    assert client.get("/v1/profile", headers=as_user(B)).json()["display_name"] is None


@pytest.mark.parametrize("name", ["", "   ", "x" * 41, None])
def test_a_name_must_be_1_to_40_characters(client, name):
    r = client.patch("/v1/profile", json={"display_name": name}, headers=as_user(A))
    assert r.status_code == 400 and r.json()["error"].startswith("display_name must be 1 to 40 characters")


def test_profile_needs_sign_in(client):
    assert client.get("/v1/profile").status_code == 401
    assert client.patch("/v1/profile", json={"display_name": "x"}).status_code == 401
