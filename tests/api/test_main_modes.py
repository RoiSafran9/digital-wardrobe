import pytest
from fastapi.testclient import TestClient
from api.auth import Settings
from api.main import create_app

ON = Settings(auth_on=True, supabase_url="http://127.0.0.1:54321", secret_key="sb_secret_test",
              public_url="http://127.0.0.1:54321", issuer="http://127.0.0.1:54321/auth/v1")


def paths(app):
    return set(app.openapi()["paths"])


def test_local_mode_serves_the_legacy_api_only():
    p = paths(create_app(Settings(auth_on=False)))
    assert {"/runs", "/items", "/images/{run_id}/{photo_name}/{item_id}/{filename}"} <= p
    assert not any(path.startswith("/v1") for path in p)


def test_multi_user_mode_serves_v1_only_so_local_files_are_never_exposed():
    p = paths(create_app(ON, start_worker=False))
    assert {"/v1/jobs", "/v1/items"} <= p
    assert not {"/runs", "/items"} & p and not any(path.startswith("/images") for path in p)


def test_multi_user_routes_refuse_requests_without_a_token():
    client = TestClient(create_app(ON, start_worker=False))
    r = client.get("/v1/items")
    assert r.status_code == 401 and r.json() == {"error": "sign in again"}


def test_turning_auth_on_without_settings_fails_at_startup(monkeypatch):
    monkeypatch.setenv("WARDROBE_AUTH", "on")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        create_app()


def test_a_malformed_price_list_fails_at_startup(monkeypatch):
    monkeypatch.setenv("WARDROBE_CREDIT_PRICES", '{"garment": -1}')
    with pytest.raises(RuntimeError, match="WARDROBE_CREDIT_PRICES"):
        create_app(ON, start_worker=False)


def test_billing_is_off_unless_switched_on(monkeypatch):
    from api.credits import NoCharge, WalletGate, get_gate
    monkeypatch.delenv("WARDROBE_BILLING", raising=False)
    monkeypatch.delenv("WARDROBE_CREDIT_PRICES", raising=False)
    assert isinstance(create_app(ON, start_worker=False).dependency_overrides[get_gate](), NoCharge)
    monkeypatch.setenv("WARDROBE_BILLING", "on")
    monkeypatch.setenv("WARDROBE_CREDIT_PRICES", '{"garment": 1, "back": 1, "turn": 3}')
    assert isinstance(create_app(ON, start_worker=False).dependency_overrides[get_gate](), WalletGate)


def test_billing_on_with_a_missing_price_fails_at_startup(monkeypatch):
    monkeypatch.setenv("WARDROBE_BILLING", "on")
    monkeypatch.setenv("WARDROBE_CREDIT_PRICES", '{"garment": 1}')
    with pytest.raises(RuntimeError, match="missing: back, turn"):
        create_app(ON, start_worker=False)
