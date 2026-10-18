"""AI Credits wallet against the local Supabase stack: real locks, real RLS, real tokens.

Billing is off in the app; these call the wallet operations directly, as Milestone 2's gate will.
"""
import uuid
from concurrent.futures import ThreadPoolExecutor
import httpx
import pytest
from fastapi.testclient import TestClient
from api.credits import CreditError
from api.main import create_app
from api.store import SupabaseStore
from scripts.grant_credits import main as grant_cli
from tests.integration.conftest import PUBLISHABLE, URL, bearer


def _reserve(settings, user_id):
    store = SupabaseStore(settings)  # one connection per thread, like separate API requests
    try:
        store.credit_reserve(user_id, str(uuid.uuid4()), "garment", 1)
        return "held"
    except CreditError as e:
        return e.code


def test_parallel_reserves_never_overspend(settings, store, users):
    a = users[0]["id"]
    store.credit_grant(a, 3, f"it-{uuid.uuid4()}", "integration test", "pytest")
    before = store.credits(a)
    with ThreadPoolExecutor(max_workers=10) as pool:
        outcomes = list(pool.map(lambda _: _reserve(settings, a), range(10)))
    free = before["balance"] - before["held"]
    assert outcomes.count("held") == free and outcomes.count("WC402") == 10 - free
    after = store.credits(a)
    assert after["held"] == before["held"] + free and after["balance"] == before["balance"]
    assert store.credit_drift() == []


def test_parallel_settle_and_release_end_a_hold_once(settings, store, users):
    a = users[0]["id"]
    store.credit_grant(a, 1, f"it-{uuid.uuid4()}", "integration test", "pytest")
    job = str(uuid.uuid4())
    store.credit_reserve(a, job, "turn", 1)
    before = store.credits(a)

    def end(kind):
        s = SupabaseStore(settings)
        try:
            return (s.credit_settle if kind == "charge" else s.credit_release)(job)["kind"]
        except CreditError as e:
            return e.code

    with ThreadPoolExecutor(max_workers=6) as pool:
        outcomes = list(pool.map(end, ["charge", "release"] * 3))
    winner = "charge" if "charge" in outcomes else "release"
    assert set(outcomes) == {winner, "WC409"} and outcomes.count(winner) == 3
    after = store.credits(a)
    assert after["held"] == before["held"] - 1
    assert after["balance"] == before["balance"] - (1 if winner == "charge" else 0)
    assert store.credit_drift() == []


def test_the_api_shows_only_the_signed_in_users_credits(settings, store, users):
    a, b = users
    store.credit_grant(a["id"], 2, f"it-{uuid.uuid4()}", "visible reason", "pytest")
    client = TestClient(create_app(settings, start_worker=False))
    mine = client.get("/v1/credits", headers=bearer(a["token"])).json()
    assert mine["entries"][0]["note"] == "visible reason" and "granted_by" not in mine["entries"][0]
    theirs = client.get("/v1/credits", headers=bearer(b["token"])).json()
    assert all(e["note"] != "visible reason" for e in theirs["entries"])


def test_the_app_can_read_but_never_change_credits(users):
    a = users[0]
    headers = {"apikey": PUBLISHABLE, **bearer(a["token"])}
    with httpx.Client(base_url=URL, headers=headers) as app:
        wallets = app.get("/rest/v1/credit_wallets", params={"select": "user_id,balance"}).json()
        assert [w["user_id"] for w in wallets] == [a["id"]]
        assert app.patch("/rest/v1/credit_wallets", params={"user_id": f"eq.{a['id']}"}, json={"balance": 999}).status_code in (401, 403)
        r = app.post("/rest/v1/rpc/credit_grant", json={"p_user_id": a["id"], "p_amount": 999, "p_operation_key": "self",
                                                        "p_note": "x", "p_granted_by": "me"})
        assert r.status_code in (401, 403, 404)
        assert app.get("/rest/v1/credit_ledger", params={"select": "granted_by"}).status_code in (401, 403)


def test_the_grant_cli_is_idempotent_against_the_database(store, users, capsys):
    b = users[1]
    key = f"it-cli-{uuid.uuid4()}"
    args = ["--email", b["email"], "--amount", "4", "--reason", "F&F pilot", "--key", key, "--by", "pytest", "--apply"]
    start = store.credits(b["id"])["balance"]
    assert grant_cli(args, store=store) == 0
    assert grant_cli(args, store=store) == 0
    assert store.credits(b["id"])["balance"] == start + 4
    assert "already granted" in capsys.readouterr().out
