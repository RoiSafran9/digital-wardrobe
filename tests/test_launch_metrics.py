"""First-five launch KPIs in scripts/usage_report.py (docs/beta/first-five-mac/04 §3, 05 M2): different-day
second import, meaningful return, 24 h / 7 day activation, and the private cohort report."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from scripts.usage_report import _launch, _launch_people, cohort_report, cohort_rows, main, metrics, read_cohort, report, timeline

# Sign-up 2026-10-20 23:00 UTC: an hour before a UTC day boundary.
T0 = datetime(2026, 10, 20, 23, 0, tzinfo=timezone.utc)
LATE = datetime(2026, 11, 2, 12, 0, tzinfo=timezone.utc)   # every 7-day window is over
EARLY = datetime(2026, 10, 23, 12, 0, tzinfo=timezone.utc)  # day 3: windows still open


def at(hours=0.0):
    return T0 + timedelta(hours=hours)


def item(user, hours, **extra):
    return {"id": f"i-{user}-{hours}", "user_id": user, "job_id": None, "created_at": at(hours), "deleted_at": None,
            "origin": "garment_photo", "review_state": None, "has_back": False, "has_turn": False, "migrated": False,
            **extra}


def event(user, name, hours, source="app", **props):
    return {"user_id": user, "event": name, "props": props, "source": source, "created_at": at(hours), "job_id": None,
            "item_id": None, "session_id": None, "app_version": None}


def rows_for(users, items=(), events=(), now=LATE, jobs=(), ai_calls=()):
    return {"now": now, "signups": [{"user_id": u, "created_at": T0} for u in users], "items": list(items),
            "removed": [], "jobs": list(jobs), "ledger": [], "events": list(events), "ai_calls": list(ai_calls)}


def person(rows, user):
    return _launch_people(rows)[user]


def test_a_second_piece_the_same_day_is_not_a_different_day_import():
    rows = rows_for(["u"], [item("u", 0.2), item("u", 0.6)])  # 23:12 and 23:36 the same UTC day
    p = person(rows, "u")
    assert p["second_import_other_day_7d"] is False
    assert metrics(rows)["funnel"]["came_back_with_a_piece"] == 0  # legacy measure unchanged: under 30 min
    rows = rows_for(["u"], [item("u", 0.2), item("u", 0.95)])  # 45 min later, still the same UTC day
    assert metrics(rows)["funnel"]["came_back_with_a_piece"] == 1  # legacy says yes …
    assert person(rows, "u")["second_import_other_day_7d"] is False  # … the different-day KPI says no


def test_the_utc_day_boundary_makes_a_different_day():
    rows = rows_for(["u"], [item("u", 0.5), item("u", 1.2)])  # 23:30, then 00:12 the next UTC day
    assert person(rows, "u")["second_import_other_day_7d"] is True


def test_a_second_import_after_seven_days_does_not_count():
    rows = rows_for(["u"], [item("u", 0.5), item("u", 0.5 + 24 * 8)])
    assert person(rows, "u")["second_import_other_day_7d"] is False
    rows = rows_for(["u"], [item("u", 0.5), item("u", 24 * 7)])  # day 7 after the first piece's UTC day
    assert person(rows, "u")["second_import_other_day_7d"] is True


def test_an_account_that_never_saved_a_piece_is_outside_the_second_import_cohort():
    rows = rows_for(["u", "v"], [item("u", 1), item("u", 30)])
    launch = _launch(rows)
    assert launch["second_import_other_day_7d"] == {"eligible": 1, "reached": 1, "rate": 1.0, "still_in_window": 0}
    assert launch["first_piece_24h"]["eligible"] == 2 and launch["first_piece_24h"]["reached"] == 1
    assert person(rows, "v")["second_import_other_day_7d"] is None


def test_an_app_open_or_screen_view_is_not_a_meaningful_return():
    rows = rows_for(["u"], [item("u", 0.5)], [event("u", "app_opened", 2, cold=True),
                                              event("u", "screen_viewed", 30, screen="closet"),
                                              event("u", "signed_in", 30, source="server", first=False),
                                              event("u", "look_generation_requested", 31, source="server", results=0)])
    assert person(rows, "u")["meaningful_return_7d"] is False
    assert metrics(rows)["retention"]["d1"]["returned"] == 1  # the legacy any-activity retention still counts it


@pytest.mark.parametrize("act, label", [
    (event("u", "item_opened", 30, has_back=False, has_turn=False), "opened_piece"),
    (event("u", "look_opened", 30, position=0), "opened_look"),
    (event("u", "look_generation_requested", 30, source="server", results=3), "got_looks"),
    (item("u", 30), "saved_piece"),
])
def test_each_meaningful_action_counts_once_on_a_later_day(act, label):
    events, items = ([act], []) if "event" in act else ([], [act])
    rows = rows_for(["u"], items, events + [dict(e) for e in events])  # a duplicate event changes nothing
    p = person(rows, "u")
    assert p["meaningful_return_7d"] is True and p["return_actions"] == [label]
    assert _launch(rows)["meaningful_return_7d"]["reached"] == 1


def test_the_same_sign_up_day_is_not_a_return():
    rows = rows_for(["u"], [], [event("u", "item_opened", 0.5, has_back=False, has_turn=False)])  # 23:30, day 0
    assert person(rows, "u")["meaningful_return_7d"] is False


def test_pending_outfit_results_and_moved_pieces_are_not_saved_pieces():
    rows = rows_for(["u"], [item("u", 1, origin="outfit_photo", review_state="pending"),
                            item("u", 2, migrated=True), item("u", -48)])  # before sign-up: never counts
    p = person(rows, "u")
    assert p["pieces"] == 0 and p["minutes_to_first_piece"] is None and p["meaningful_return_7d"] is False


def test_a_piece_removed_later_still_counts_as_saved():
    rows = rows_for(["u"], [item("u", 1, deleted_at=at(40)), item("u", 30)])
    p = person(rows, "u")
    assert p["pieces"] == 2 and p["second_import_other_day_7d"] is True


def test_open_windows_are_counted_apart_never_as_failures():
    rows = rows_for(["u", "v"], [item("u", 0.5)], now=EARLY)
    launch = _launch(rows)
    assert launch["meaningful_return_7d"] == {"eligible": 0, "reached": 0, "rate": None, "still_in_window": 2}
    assert launch["second_import_other_day_7d"]["still_in_window"] == 1
    assert launch["first_piece_24h"] == {"eligible": 2, "reached": 1, "rate": 0.5, "still_in_window": 0}
    rows = rows_for(["u"], [item("u", 0.5), item("u", 30)], now=EARLY)  # reached early: counts already
    assert _launch(rows)["second_import_other_day_7d"]["reached"] == 1


def test_accounts_never_mix():
    rows = rows_for(["u", "v"], [item("u", 0.5), item("v", 30)],
                    [event("v", "item_opened", 30, has_back=False, has_turn=False)])
    assert person(rows, "u")["second_import_other_day_7d"] is False and person(rows, "u")["meaningful_return_7d"] is False
    assert person(rows, "v")["pieces"] == 1 and person(rows, "v")["meaningful_return_7d"] is True


def test_events_of_accounts_outside_the_cohort_are_ignored():
    rows = rows_for(["u"], [item("x", 30)], [event("x", "item_opened", 30, has_back=False, has_turn=False)])
    assert _launch(rows)["meaningful_return_7d"] == {"eligible": 1, "reached": 0, "rate": 0.0, "still_in_window": 0}


def test_an_empty_cohort_has_no_rates():
    launch = _launch(rows_for([]))
    assert launch["cohort"] == 0
    for name in ("first_piece_24h", "three_pieces_7d", "second_import_other_day_7d", "meaningful_return_7d"):
        assert launch[name] == {"eligible": 0, "reached": 0, "rate": None, "still_in_window": 0}
    assert launch["minutes_to_first_piece"]["median"] is None
    launch_text = report(metrics(rows_for([]))).split("Launch KPIs")[1].split("Retention")[0]
    assert "0 of 0 —" in launch_text and "%" not in launch_text  # no rate made up from nothing


def test_three_pieces_must_be_within_seven_days():
    rows = rows_for(["u", "v"], [item("u", 1), item("u", 2), item("u", 24 * 6),
                                 item("v", 1), item("v", 2), item("v", 24 * 8)])
    assert person(rows, "u")["three_pieces_7d"] is True and person(rows, "v")["three_pieces_7d"] is False


def test_the_report_names_legacy_measures_for_what_they_are():
    text = report(metrics(rows_for(["u"], [item("u", 0.5)])))
    assert "same day counts" in text and "any activity, days 6–8" in text
    assert "second import on a different UTC day" in text and "never a bare app open" in text


def test_timeline_lines_carry_ids_for_the_server_log():
    rows = rows_for(["u"], [], [event("u", "client_error", 1, where="global", kind="http_5xx", request_id="ab" * 16)],
                    jobs=[{"id": "job-1", "user_id": "u", "kind": "garment", "status": "failed", "failure_code": "model_timeout",
                           "attempts": 3, "cost_credits": 1, "created_at": at(1), "finished_at": at(1.1)}])
    text = timeline(rows)
    assert "request_id=" + "ab" * 16 in text and "[job job-1]" in text


# --- the private cohort report -------------------------------------------------------------------------

def _store():
    from api.store import MemoryStore
    store = MemoryStore()
    now = datetime.now(timezone.utc)
    store.emails.update({"t1@example.com": "u1", "t2@example.com": "u2"})
    store.signups = {"u1": now - timedelta(days=10), "u2": now - timedelta(days=1), "u9": now - timedelta(days=3)}
    store.insert_events([{"user_id": "u1", "event": "signed_in", "props": {"first": True}, "source": "server"}])
    return store


def test_cohort_file_must_live_outside_the_repo(tmp_path):
    inside = Path(__file__).resolve().parent / "cohort.txt"
    with pytest.raises(SystemExit, match="outside the repository"):
        read_cohort(str(inside))
    bad = tmp_path / "c.txt"
    bad.write_text("T1\n")
    with pytest.raises(SystemExit, match="expected"):
        read_cohort(str(bad))
    dup = tmp_path / "d.txt"
    dup.write_text("T1 a@example.com\nT1 b@example.com\n")
    with pytest.raises(SystemExit, match="unique"):
        read_cohort(str(dup))


def test_cohort_report_names_aliases_only(tmp_path):
    store = _store()
    file = tmp_path / "first-five.txt"
    file.write_text("# private\nT1 t1@example.com\nT2 t2@example.com  # friend\nT3 missing@example.com\n")
    text = main(["--cohort", str(file)], store=store)
    assert "2 of 3 testers found (not found: T3)" in text
    assert "T1" in text and "T2" in text
    assert "example.com" not in text and not any(f"u{n}" in text for n in (1, 2, 9))
    data = json.loads(main(["--cohort", str(file), "--json"], store=store))
    assert set(data["people"]) == {"T1", "T2"} and data["not_found"] == ["T3"]
    assert data["launch"]["cohort"] == 2  # u9 is not a tester
    assert data["people"]["T1"]["signed_in"] is True and data["people"]["T2"]["signed_in"] is False
    assert "example.com" not in json.dumps(data) and "u1" not in json.dumps(data)


def test_cohort_rows_merge_only_the_testers():
    store = _store()
    rows, aliases, missing = cohort_rows(store, [("T1", "t1@example.com"), ("T2", "u2")])
    assert aliases == {"u1": "T1", "u2": "T2"} and missing == []
    assert {s["user_id"] for s in rows["signups"]} == {"u1", "u2"}
    assert "T1" in cohort_report(rows, aliases, missing)
