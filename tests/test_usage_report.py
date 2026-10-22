"""scripts/usage_report.py: the owner's beta report and one account's timeline (activity logging spec §6)."""
import json
from datetime import datetime, timedelta, timezone
import pytest
from scripts.usage_report import main, metrics, timeline

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)
T0 = datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc)


def at(minutes=0, days=0):
    return T0 + timedelta(days=days, minutes=minutes)


def job(user, kind, minutes, status="succeeded", failure=None, seconds=30, cost=None, days=0, jid=None):
    created = at(minutes, days)
    return {"id": jid or f"{user}-{kind}-{days}-{minutes}", "user_id": user, "kind": kind, "status": status,
            "failure_code": failure, "attempts": 1, "cost_credits": cost, "created_at": created,
            "finished_at": created + timedelta(seconds=seconds)}


def event(user, name, minutes=0, days=0, source="app", **props):
    return {"user_id": user, "event": name, "props": props, "source": source, "created_at": at(minutes, days),
            "job_id": None, "item_id": None, "session_id": None, "app_version": None}


def item(user, minutes, days=0, **extra):
    return {"id": f"i-{user}-{days}-{minutes}", "user_id": user, "job_id": None, "created_at": at(minutes, days),
            "deleted_at": None, "origin": "garment_photo", "review_state": None, "has_back": False, "has_turn": False,
            "migrated": False, **extra}


def call(user, kind, model, usd, attempt=1, fallback=False, status="ok", job_id=None):
    return {"user_id": user, "job_id": job_id, "job_kind": kind, "stage": "s", "model": model, "status": status,
            "attempt": attempt, "fallback": fallback, "latency_ms": 1000, "est_cost_usd": usd, "created_at": at(5)}


@pytest.fixture
def rows():
    return {
        "now": NOW,
        "signups": [{"user_id": u, "created_at": T0} for u in ("u1", "u2", "u3")],
        "items": [item("u1", 4), item("u1", 4), item("u1", 6), item("u1", 0, days=7, has_back=True),
                  item("u2", 90, origin="outfit_photo", review_state="kept"),
                  item("u2", 91, origin="outfit_photo", review_state="pending")],
        "removed": [],
        "jobs": [job("u1", "garment_scan", 2, seconds=5), job("u1", "garment", 3, cost=2), job("u1", "garment", 5, cost=1),
                 job("u1", "back", 0, days=7, cost=1, seconds=40),
                 job("u2", "outfit_scan", 85), job("u2", "outfit_generate", 89, cost=2, seconds=60),
                 job("u3", "garment_scan", 3, status="failed", failure="photo_quality", seconds=2)],
        "ledger": [{"user_id": u, "kind": "grant", "amount": 40, "action": None, "job_id": None, "created_at": T0}
                   for u in ("u1", "u2", "u3")]
                  + [{"user_id": "u1", "kind": "charge", "amount": 3, "action": "garment", "job_id": None, "created_at": at(6)},
                     {"user_id": "u1", "kind": "charge", "amount": 1, "action": "back", "job_id": None, "created_at": at(0, 7)},
                     {"user_id": "u2", "kind": "charge", "amount": 1, "action": "garment", "job_id": None, "created_at": at(90)},
                     {"user_id": "u2", "kind": "release", "amount": 1, "action": "garment", "job_id": None, "created_at": at(90)}],
        "events": [event(u, "signed_in", source="server", first=True) for u in ("u1", "u2", "u3")]
                  + [event("u1", "onboarding_started", 1, entry="auto"), event("u2", "onboarding_started", 1, entry="auto")]
                  + [event("u1", "app_opened", 0, days=1, cold=True), event("u2", "app_opened", 0, days=1, cold=True)]
                  + [event("u1", "item_edited", 30, source="server", field="name", first=True)]
                  + [event("u2", "region_added", 86, source="server")]
                  + [event("u1", "cost_sheet", 2, action="garment", choice="confirmed", pieces=2),
                     event("u3", "cost_sheet", 3, action="garment", choice="cancelled", pieces=1)]
                  + [event("u3", "refused", 4, source="server", route="job", reason="no_credits")]
                  + [event("u3", "client_error", 4, where="global", kind="network")],
        "ai_calls": [call("u1", "garment_scan", "gemini-3.1-flash-lite", 0.0005),
                     call("u1", "garment", "gemini-2.5-flash-image", 0.04),
                     call("u1", "garment", "gemini-3.1-flash-image", 0.07, attempt=2, fallback=True),
                     call("u2", "outfit_generate", "gemini-2.5-flash-image", 0.04),
                     call(None, "garment", "gemini-2.5-flash-image", 0.04)],  # a deleted account's cost stays
    }


def test_funnel_in_order(rows):
    f = metrics(rows)["funnel"]
    assert list(f) == ["signed_up", "signed_in", "onboarding_started", "first_scan", "first_generate", "first_piece",
                       "three_pieces", "came_back_with_a_piece"]
    assert [f[k] for k in f] == [3, 3, 2, 3, 2, 2, 1, 1]


def test_activation_numbers_match_the_first_pieces_report(rows):
    a = metrics(rows)["activation"]
    assert (a["signups"], a["activated"]) == (3, 2)
    assert a["time_to_first_item_min"]["median"] == pytest.approx((4 + 90) / 2)


def test_retention_d1_d7(rows):
    r = metrics(rows)["retention"]
    assert r["d1"] == {"eligible": 3, "returned": 2, "rate": round(2 / 3, 3)}
    assert r["d7"] == {"eligible": 3, "returned": 1, "rate": round(1 / 3, 3)}


def test_feature_use(rows):
    f = metrics(rows)["features"]
    assert f["garment_photo"] == {"accounts": 1, "count": 2}
    assert f["outfit_photo"] == {"accounts": 1, "count": 1}
    assert f["back"] == {"accounts": 1, "count": 1} and f["turn"] == {"accounts": 0, "count": 0}
    assert f["edits"] == {"accounts": 1, "count": 1} and f["missed_garments_marked"] == {"accounts": 1, "count": 1}
    assert f["cost_sheet_cancel_rate"] == {"garment": 0.5}


def test_reliability(rows):
    r = metrics(rows)["reliability"]
    assert r["jobs"]["garment_scan"]["failed"] == 1 and r["jobs"]["garment_scan"]["failures"] == {"photo_quality": 1}
    assert r["jobs"]["outfit_generate"]["p50_seconds"] == 60
    assert r["refusals"] == {"no_credits": 1} and r["client_errors"] == {"network": 1}


def test_ai_cost(rows):
    c = metrics(rows)["ai_cost"]
    assert c["total_usd"] == pytest.approx(0.1905)
    assert c["by_kind"]["garment"] == pytest.approx(0.15)
    assert c["per_account"]["max"] == pytest.approx(0.1105)
    assert c["fallback_share"] == pytest.approx(1 / 4)          # image calls only
    assert c["retry_share"] == round(0.07 / 0.1905, 3)
    assert c["per_credit_charged"] == pytest.approx(0.1905 / 5)


def test_credits_from_the_ledger(rows):
    assert metrics(rows)["credits"] == {"granted": 120, "charged": 5, "released": 1}


def test_timeline_in_order_without_personal_content():
    rows = {"now": NOW, "signups": [{"user_id": "u1", "created_at": T0}],
            "items": [item("u1", 4)], "removed": [], "ledger": [],
            "jobs": [job("u1", "garment", 3)], "ai_calls": [],
            "events": [event("u1", "signed_in", 0, source="server", first=True)]}
    text = timeline(rows)
    lines = text.splitlines()
    assert "signed up" in lines[0] and "signed_in" in lines[1] and "garment job started" in lines[2]
    assert "SECRET" not in text


def test_main_on_a_store(capsys):
    from api.store import MemoryStore
    store = MemoryStore()
    now = datetime.now(timezone.utc)
    store.signups = {"u1": now - timedelta(days=2)}
    store.insert_event("u1", "onboarding_started", {"entry": "auto"})
    text = main(["--days", "30"], store=store)
    assert "Funnel" in text and "onboarding_started" in text
    data = json.loads(main(["--days", "30", "--json"], store=store))
    assert data["funnel"]["onboarding_started"] == 1


def test_user_timeline_by_email_or_id(capsys):
    from api.store import MemoryStore
    store = MemoryStore()
    store.emails["tester@example.com"] = "u1"
    store.signups = {"u1": datetime.now(timezone.utc)}
    store.insert_event("u1", "onboarding_started", {"entry": "auto"})
    assert "onboarding_started" in main(["--user", "tester@example.com"], store=store)
    assert "No account" in main(["--user", "nobody@example.com"], store=store)


def test_pieces_moved_from_runs_never_count_as_made_after_sign_up(rows):
    # The owner's closet was moved in by scripts/migrate_runs.py: those items keep their old file times,
    # days before the account existed. They are not pieces made in the app.
    rows["items"] += [item("u3", -4000, migrated=True), item("u3", -3900, migrated=True), item("u3", -3800, migrated=True)]
    m = metrics(rows)
    a = m["activation"]
    assert a["activated"] == 2 and a["time_to_first_item_min"]["median"] >= 0
    assert m["funnel"]["first_piece"] == 2 and m["funnel"]["three_pieces"] == 1


def test_a_piece_dated_before_sign_up_is_never_a_negative_time(rows):
    rows["items"].append(item("u3", -60))  # not marked as moved, but older than the account (clock or data slip)
    a = metrics(rows)["activation"]
    assert a["time_to_first_item_min"]["median"] >= 0 and a["activated"] == 2


def test_timeline_marks_moved_pieces():
    rows = {"now": NOW, "signups": [{"user_id": "u1", "created_at": T0}], "removed": [], "ledger": [], "jobs": [],
            "ai_calls": [], "events": [], "items": [item("u1", -4000, migrated=True)]}
    assert "moved from the old closet" in timeline(rows)
