"""Deleting an account on the local stack: the auth user, every row and every file go; others stay."""
import uuid
import pytest
from api.store import SupabaseStore
from tests.integration.conftest import CONFIGURED, PASSWORD

pytestmark = pytest.mark.skipif(not CONFIGURED, reason="needs SUPABASE_TEST_* (local Supabase stack)")


def test_delete_account_removes_the_user_rows_and_files(settings, admin, users):
    email = f"gone-{uuid.uuid4().hex[:8]}@test.dev"
    r = admin.post("/auth/v1/admin/users", json={"email": email, "password": PASSWORD, "email_confirm": True})
    r.raise_for_status()
    gone = r.json()["id"]
    store = SupabaseStore(settings)
    store.upload(f"{gone}/items/x/generated.png", b"png", "image/png")
    store.upload(f"{users[0]['id']}/items/keep/generated.png", b"png", "image/png")
    store.create_job(gone, "garment", "k1", None)

    store.delete_account(gone)

    assert admin.get(f"/auth/v1/admin/users/{gone}").status_code == 404
    assert store.list_paths(gone) == []
    assert admin.get("/rest/v1/profiles", params={"id": f"eq.{gone}"}).json() == []
    assert admin.get("/rest/v1/generation_jobs", params={"user_id": f"eq.{gone}"}).json() == []
    assert f"{users[0]['id']}/items/keep/generated.png" in store.list_paths(users[0]["id"])  # someone else's stays
