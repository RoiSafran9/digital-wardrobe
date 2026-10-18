"""GET /v1/credits: the signed-in user's AI Credits balance and activity, read-only."""
import pytest
from api.credits import CreditError
from api.store import MemoryStore
from tests.api.v1_helpers import A, B, as_user, v1_client

JOB1, JOB2 = "10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002"


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def test_a_new_account_has_an_empty_wallet(client):
    r = client.get("/v1/credits", headers=as_user(A))
    assert r.status_code == 200
    assert r.json() == {"balance": 0, "held": 0, "available": 0, "entries": [], "next_before": None}


def test_balance_held_and_available_after_a_grant_and_a_hold(client, store):
    store.credit_grant(A, 10, "ff-1", "F&F pilot", "owner")
    store.credit_reserve(A, JOB1, "garment", 3)
    body = client.get("/v1/credits", headers=as_user(A)).json()
    assert (body["balance"], body["held"], body["available"]) == (10, 3, 7)
    assert [(e["kind"], e["amount"], e["action"], e["job_id"]) for e in body["entries"]] == [
        ("hold", 3, "garment", JOB1), ("grant", 10, None, None)]
    assert body["entries"][1]["note"] == "F&F pilot" and "granted_by" not in body["entries"][1]


def test_activity_pages_newest_first(client, store):
    store.credit_grant(A, 10, "ff-1", "F&F pilot", "owner")
    store.credit_reserve(A, JOB1, "garment", 1)
    store.credit_settle(JOB1)
    first = client.get("/v1/credits?limit=2", headers=as_user(A)).json()
    assert [e["kind"] for e in first["entries"]] == ["charge", "hold"]
    assert first["next_before"] == first["entries"][-1]["id"]
    second = client.get(f"/v1/credits?limit=2&before={first['next_before']}", headers=as_user(A)).json()
    assert [e["kind"] for e in second["entries"]] == ["grant"] and second["next_before"] is None


def test_users_see_only_their_own_credits(client, store):
    store.credit_grant(A, 10, "ff-1", "F&F pilot", "owner")
    store.credit_grant(B, 2, "ff-1", "F&F pilot", "owner")
    store.credit_grant(A, 5, "ff-2", "F&F pilot", "owner")
    body = client.get("/v1/credits?before=999", headers=as_user(B)).json()  # a cursor past A's rows too
    assert body["balance"] == 2 and [e["amount"] for e in body["entries"]] == [2]
    assert client.get("/v1/credits", headers=as_user(A)).json()["balance"] == 15


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "before=0", "before=abc"])
def test_bad_paging_is_refused(client, query):
    assert client.get(f"/v1/credits?{query}", headers=as_user(A)).status_code == 400


def test_credits_need_sign_in(client):
    assert client.get("/v1/credits").status_code == 401


# The in-memory store follows the same rules as the database functions (pgTAP proves those).

def test_memory_store_refuses_overspend_and_replays_safely(store):
    store.credit_grant(A, 3, "ff-1", "F&F pilot", "owner")
    assert store.credit_grant(A, 3, "ff-1", "F&F pilot", "owner")["amount"] == 3
    assert store.credits(A) == {"balance": 3, "held": 0}
    with pytest.raises(CreditError) as e:
        store.credit_reserve(A, JOB1, "garment", 4)
    assert e.value.code == "WC402"
    store.credit_reserve(A, JOB1, "garment", 3)
    store.credit_reserve(A, JOB1, "garment", 3)
    assert store.credits(A) == {"balance": 3, "held": 3}
    store.credit_release(JOB1)
    assert store.credit_release(JOB1)["kind"] == "release"
    with pytest.raises(CreditError) as e:
        store.credit_settle(JOB1)
    assert e.value.code == "WC409"
    assert store.credits(A) == {"balance": 3, "held": 0}
    assert store.credit_settle(JOB2) is None


@pytest.mark.parametrize("call, code", [
    (lambda s: s.credit_grant(A, 0, "k", "r", "owner"), "WC422"),
    (lambda s: s.credit_grant(A, 5, "k", "", "owner"), "WC422"),
    (lambda s: s.credit_reserve(A, JOB1, "regenerate", 1), "WC422"),
    (lambda s: s.credit_reserve(A, JOB1, "garment", -1), "WC422"),
])
def test_memory_store_refuses_bad_input(store, call, code):
    with pytest.raises(CreditError) as e:
        call(store)
    assert e.value.code == code


def test_memory_store_refuses_unknown_and_disabled_users(store):
    store.deleted_users.add(B)
    with pytest.raises(CreditError) as e:
        store.credit_grant(B, 1, "k", "r", "owner")
    assert e.value.code == "WC404"
    store.disabled.add(A)
    with pytest.raises(CreditError) as e:
        store.credit_grant(A, 1, "k", "r", "owner")
    assert e.value.code == "WC403"
