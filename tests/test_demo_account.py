"""App Review demo account tool: dry run by default, a fresh password on every create, disable blocks it."""
import json
import httpx
import pytest
from api.auth import load_settings
from api.store import BANNED_FOR, MemoryStore, SupabaseStore
from scripts.demo_account import ALPHABET, DEFAULT_EMAIL, main, new_password


@pytest.fixture
def store():
    return MemoryStore()


def _password(out: str) -> str:
    return next(line.split()[1] for line in out.splitlines() if line.startswith("Password"))


def test_dry_run_creates_nothing(store, capsys):
    assert main(["create"], store=store) == 0
    assert "Dry run" in capsys.readouterr().out
    assert store.emails == {} and store.passwords == {}


def test_create_makes_the_account_and_prints_its_password_once(store, capsys):
    assert main(["create", "--apply"], store=store) == 0
    user_id = store.emails[DEFAULT_EMAIL]
    assert _password(capsys.readouterr().out) == store.passwords[user_id]


def test_create_again_unblocks_and_rotates_the_password(store, capsys):
    main(["create", "--apply"], store=store)
    user_id = store.emails[DEFAULT_EMAIL]
    first = store.passwords[user_id]
    main(["disable", "--apply"], store=store)
    assert user_id in store.banned
    capsys.readouterr()
    main(["create", "--apply"], store=store)
    assert store.emails[DEFAULT_EMAIL] == user_id  # same account, not a second one
    assert user_id not in store.banned
    assert store.passwords[user_id] != first
    assert _password(capsys.readouterr().out) == store.passwords[user_id]


def test_disable_blocks_and_forgets_the_password_without_printing_it(store, capsys):
    main(["create", "--apply"], store=store)
    user_id = store.emails[DEFAULT_EMAIL]
    shown = _password(capsys.readouterr().out)
    assert main(["disable", "--apply"], store=store) == 0
    out = capsys.readouterr().out
    assert user_id in store.banned and store.passwords[user_id] != shown
    assert store.passwords[user_id] not in out


def test_disable_dry_run_and_missing_account_change_nothing(store, capsys):
    assert main(["disable", "--apply"], store=store) == 0
    assert "nothing to disable" in capsys.readouterr().out
    main(["create", "--apply"], store=store)
    assert main(["disable"], store=store) == 0
    assert store.banned == set()


def test_passwords_are_long_random_and_typeable():
    seen = {new_password() for _ in range(50)}
    assert len(seen) == 50
    for pw in seen:
        groups = pw.split("-")
        assert len(groups) == 4 and all(len(g) == 5 and set(g) <= set(ALPHABET) for g in groups)


def test_supabase_store_uses_the_admin_api():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, json.loads(request.content)))
        return httpx.Response(200, json={"id": "u1"})

    settings = load_settings({"WARDROBE_AUTH": "on", "SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SECRET_KEY": "sk"})
    store = SupabaseStore(settings, client=httpx.Client(base_url="https://x.supabase.co", transport=httpx.MockTransport(handler)))
    assert store.create_auth_user(" Review@X.com ", "pw") == "u1"
    store.update_auth_user("u1", "pw2", banned=True)
    store.update_auth_user("u1", "pw3", banned=False)
    assert calls == [
        ("POST", "/auth/v1/admin/users", {"email": "review@x.com", "password": "pw", "email_confirm": True}),
        ("PUT", "/auth/v1/admin/users/u1", {"password": "pw2", "ban_duration": BANNED_FOR}),
        ("PUT", "/auth/v1/admin/users/u1", {"password": "pw3", "ban_duration": "none"}),
    ]
