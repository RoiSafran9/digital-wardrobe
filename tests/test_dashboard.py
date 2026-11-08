"""scripts/dashboard.py: the owner's local metrics page — its numbers, its privacy and its loopback-only server."""
import json
import threading
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

import pytest

from api.store import MemoryStore
from scripts.dashboard import Source, build, handler_for, mask_email, window
from scripts.usage_report import metrics

NOW = datetime(2026, 11, 8, 12, 0, tzinfo=timezone.utc)


def ago(days=0, hours=0):
    return NOW - timedelta(days=days, hours=hours)


def job(user, kind, when, status="succeeded", failure=None, seconds=30):
    return {"id": f"{user}-{kind}-{when.isoformat()}", "user_id": user, "kind": kind, "status": status,
            "failure_code": failure, "attempts": 1, "cost_credits": 1, "created_at": when,
            "finished_at": when + timedelta(seconds=seconds) if status in ("succeeded", "failed") else None}


def event(user, name, when, **props):
    return {"user_id": user, "event": name, "props": props, "source": "app", "job_id": None, "item_id": None,
            "session_id": None, "app_version": "1.0.0", "created_at": when}


def call(user, kind, model, usd, when, status="ok"):
    return {"user_id": user, "job_id": None, "job_kind": kind, "stage": "stage4_generate", "model": model,
            "status": status, "attempt": 1, "fallback": False, "latency_ms": 1200, "est_cost_usd": usd, "created_at": when}


@pytest.fixture
def rows():
    return {
        "now": NOW,
        "signups": [{"user_id": "u1", "created_at": ago(40)}, {"user_id": "u2", "created_at": ago(3)}],
        "items": [{"id": "i1", "user_id": "u1", "job_id": None, "created_at": ago(39), "deleted_at": None,
                   "origin": "garment_photo", "review_state": None, "migrated": False},
                  {"id": "i2", "user_id": "u2", "job_id": None, "created_at": ago(2), "deleted_at": None,
                   "origin": "outfit_photo", "review_state": "kept", "migrated": False},
                  {"id": "i3", "user_id": "u2", "job_id": None, "created_at": ago(2), "deleted_at": None,
                   "origin": "outfit_photo", "review_state": "pending", "migrated": False}],
        "removed": [],
        "jobs": [job("u1", "garment", ago(39)), job("u2", "outfit_scan", ago(2)),
                 job("u2", "outfit_generate", ago(2), status="failed", failure="model_error"),
                 job("u2", "garment", ago(0, 1), status="queued")],
        "ledger": [{"user_id": "u1", "kind": "grant", "amount": 40, "action": None, "job_id": None, "created_at": ago(40)},
                   {"user_id": "u1", "kind": "charge", "amount": 1, "action": "garment", "job_id": None, "created_at": ago(39)},
                   {"user_id": "u2", "kind": "grant", "amount": 40, "action": None, "job_id": None, "created_at": ago(3)},
                   {"user_id": "u2", "kind": "charge", "amount": 2, "action": "garment", "job_id": None, "created_at": ago(2)}],
        "events": [event("u1", "app_opened", ago(39), cold=True), event("u2", "app_opened", ago(2), cold=True),
                   event("u2", "screen_viewed", ago(2), screen="closet"),
                   event("u2", "client_error", ago(1), kind="http_5xx", status=502)],
        "ai_calls": [call("u1", "garment", "gemini-2.5-flash-image", 0.04, ago(39)),
                     call("u2", "outfit_generate", "gemini-2.5-flash-image", 0.05, ago(2)),
                     call("u2", "outfit_scan", "gemini-3.1-flash-lite", 0.001, ago(2), status="error")],
    }


ACCOUNTS = [{"id": "u1", "email": "first.tester@example.com", "display_name": "Dana", "created_at": ago(40),
             "balance": 39, "held": 0},
            {"id": "u2", "email": "second@example.com", "display_name": None, "created_at": ago(3), "balance": 38, "held": 1}]


def accounts_for(rows):
    return [dict(a) for a in ACCOUNTS]


def test_mask_email_keeps_two_letters_and_the_domain():
    assert mask_email("first.tester@example.com") == "fi•••@example.com"
    assert mask_email(None) is None and mask_email("no-at-sign") is None


def test_period_numbers_match_the_usage_report(rows):
    data = build(rows, accounts_for(rows), days=7)
    period = window(rows, NOW - timedelta(days=7))
    assert data["metrics"] == metrics(period)
    k = data["kpis"]
    assert k["accounts"] == 2 and k["new_accounts"] == 1
    assert k["jobs"] == 3 and k["success_rate"] == 0.5  # the queued job is not done yet
    assert k["pieces"] == 1  # the pending outfit result is not in the closet
    assert k["ai_usd"] == pytest.approx(0.051)
    assert k["credits_charged"] == 2 and k["credits_outstanding"] == 77 and k["credits_held"] == 1
    assert k["app_errors"] == 1 and k["jobs_live"] == 1
    assert len(data["daily"]) == 8 and sum(d["jobs_failed"] for d in data["daily"]) == 1


def test_all_time_starts_at_the_first_row_and_covers_everything(rows):
    data = build(rows, accounts_for(rows), days=0)
    assert data["daily"][0]["day"] == ago(40).date().isoformat()
    assert data["kpis"]["jobs"] == 4 and data["kpis"]["ai_usd"] == pytest.approx(0.091)


def test_breakdowns_and_accounts(rows):
    data = build(rows, accounts_for(rows), days=30)
    image = data["ai"]["by_model"]["gemini-2.5-flash-image"]
    assert image["calls"] == 1 and image["usd"] == pytest.approx(0.05)
    assert data["ai"]["by_model"]["gemini-3.1-flash-lite"]["failed"] == 1
    assert data["events"]["screens"] == {"closet": 1}
    assert sum(map(sum, data["events"]["heatmap"])) == 3
    by_id = {a["id"]: a for a in data["accounts"]}
    assert by_id["u1"]["email"] == "fi•••@example.com" and by_id["u1"]["pieces"] == 1
    assert by_id["u2"]["failed_jobs"] == 1 and by_id["u2"]["charged"] == 2 and by_id["u2"]["app_errors"] == 1
    assert [j["kind"] for j in data["live_jobs"]] == ["garment"]


def test_nothing_personal_leaves_the_server(rows):
    body = json.dumps(build(rows, accounts_for(rows), days=0), default=str)
    assert "first.tester@example.com" not in body and "second@example.com" not in body


def test_feed_is_newest_first_and_labels_accounts(rows):
    feed = build(rows, accounts_for(rows), days=30)["feed"]
    assert feed == sorted(feed, key=lambda e: e["at"], reverse=True)
    assert {e["who"] for e in feed} == {"se•••@example.com"}  # u2 has no name; u1 did nothing in the period
    assert any(e["kind"] == "error" and e["what"] == "outfit_generate failed" for e in feed)


def test_memory_store_accounts_overview():
    store = MemoryStore()
    store.signups["u1"] = ago(1)
    store.emails["a@example.com"] = "u1"
    store.names["u1"] = "Ann"
    store.wallets["u1"] = {"balance": 5, "held": 2}
    assert store.accounts_overview() == [{"id": "u1", "email": "a@example.com", "display_name": "Ann",
                                          "created_at": ago(1), "balance": 5, "held": 2}]


class FakeStore:
    def __init__(self, rows):
        self.rows, self.reads = rows, 0

    def usage_rows(self, since):
        self.reads += 1
        return self.rows

    def accounts_overview(self):
        return accounts_for(self.rows)


@pytest.fixture
def served(rows):
    from http.server import ThreadingHTTPServer
    store = FakeStore(rows)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(Source(store, None)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}", store
    server.shutdown()
    server.server_close()


def test_server_serves_the_page_and_the_data(served):
    base, store = served
    page = urllib.request.urlopen(base + "/").read().decode()
    assert "<title>KIPS Metrics</title>" in page
    data = json.loads(urllib.request.urlopen(base + "/api/dashboard?days=7").read())
    assert data["kpis"]["accounts"] == 2 and data["health"] is None
    urllib.request.urlopen(base + "/api/dashboard?days=30").read()
    assert store.reads == 1  # cached between period switches
    urllib.request.urlopen(base + "/api/dashboard?days=30&fresh=1").read()
    assert store.reads == 2


@pytest.mark.parametrize("path", ["/api/dashboard?days=5", "/api/dashboard?days=x", "/../.env", "/nope"])
def test_server_refuses_other_requests(served, path):
    base, _ = served
    with pytest.raises(urllib.error.HTTPError) as e:
        urllib.request.urlopen(base + path)
    assert e.value.code in (400, 404)


def test_main_binds_loopback_only(monkeypatch):
    import scripts.dashboard as dash
    seen = {}

    class Server:
        def __init__(self, address, handler):
            seen["address"] = address

        def serve_forever(self):
            raise KeyboardInterrupt

        def server_close(self):
            pass
    monkeypatch.setattr(dash, "ThreadingHTTPServer", Server)
    dash.main(["--port", "8099", "--health-url", ""], store=FakeStore({}))
    assert seen["address"] == ("127.0.0.1", 8099)
