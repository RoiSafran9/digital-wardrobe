"""Shared setup for tests that run against a local Supabase stack (npx supabase start).

Skipped unless SUPABASE_TEST_URL, SUPABASE_TEST_SECRET_KEY and SUPABASE_TEST_PUBLISHABLE_KEY are set.
Each test module gets two fresh users; their rows and files are removed afterwards.
"""
import os
import uuid
import httpx
import pytest
from api.auth import Settings
from api.store import SupabaseStore

URL = os.environ.get("SUPABASE_TEST_URL", "")
SECRET = os.environ.get("SUPABASE_TEST_SECRET_KEY", "")
PUBLISHABLE = os.environ.get("SUPABASE_TEST_PUBLISHABLE_KEY", "")
CONFIGURED = bool(URL and SECRET and PUBLISHABLE)

PASSWORD = "integration-Test-123"


@pytest.fixture(scope="module")
def settings():
    return Settings(auth_on=True, supabase_url=URL, secret_key=SECRET, public_url=URL, issuer=f"{URL}/auth/v1")


@pytest.fixture(scope="module")
def admin():
    with httpx.Client(base_url=URL, headers={"apikey": SECRET, "Authorization": f"Bearer {SECRET}"}) as client:
        yield client


@pytest.fixture(scope="module")
def users(admin):
    made = []
    for name in ("a", "b"):
        email = f"{name}-{uuid.uuid4().hex[:8]}@test.dev"
        r = admin.post("/auth/v1/admin/users", json={"email": email, "password": PASSWORD, "email_confirm": True})
        r.raise_for_status()
        made.append({"id": r.json()["id"], "email": email, "token": sign_in(email)})
    yield made
    for user in made:
        _remove_folder(admin, user["id"])  # deleting an account doesn't remove its files (yet)
        admin.delete(f"/auth/v1/admin/users/{user['id']}")  # cascades profile, items, jobs


def sign_in(email: str) -> str:
    """A fresh access token for the user, like signing in on another device."""
    return httpx.post(f"{URL}/auth/v1/token?grant_type=password", headers={"apikey": PUBLISHABLE},
                      json={"email": email, "password": PASSWORD}).json()["access_token"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _remove_folder(admin, prefix):
    entries = admin.post("/storage/v1/object/list/wardrobe", json={"prefix": prefix, "limit": 1000}).json()
    files = [f"{prefix}/{e['name']}" for e in entries if e.get("id")]
    for folder in (e["name"] for e in entries if not e.get("id")):
        _remove_folder(admin, f"{prefix}/{folder}")
    if files:
        admin.request("DELETE", "/storage/v1/object/wardrobe", json={"prefixes": files})


@pytest.fixture(scope="module")
def store(settings):
    return SupabaseStore(settings)




def pytest_collection_modifyitems(config, items):
    if CONFIGURED:
        return
    skip = pytest.mark.skip(reason="no local Supabase stack configured")
    for item in items:
        if "tests/integration/" in str(item.fspath):
            item.add_marker(skip)
