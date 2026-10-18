"""The storage sweeper on the real stack: a deleted account's files are found and removed; live ones stay."""
import uuid
from datetime import datetime, timezone
from scripts.sweep_storage import apply_sweep, plan_sweep
from tests.integration.conftest import PASSWORD


def test_a_deleted_accounts_files_are_swept(admin, store, users):
    email = f"gone-{uuid.uuid4().hex[:8]}@test.dev"
    gone = admin.post("/auth/v1/admin/users", json={"email": email, "password": PASSWORD, "email_confirm": True}).json()["id"]
    store.upload(f"{gone}/items/x/generated.png", b"png", "image/png")
    live = f"{users[0]['id']}/items/x/generated.png"
    store.upload(live, b"png", "image/png")
    admin.delete(f"/auth/v1/admin/users/{gone}")

    sweep = plan_sweep(store, datetime.now(timezone.utc))
    assert f"{gone}/items/x/generated.png" in sweep.remove and live not in sweep.remove
    apply_sweep(store, sweep)
    assert store.list_paths(gone) == [] and store.list_paths(f"{users[0]['id']}/items/x") == [live]
