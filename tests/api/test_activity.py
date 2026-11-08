"""api/activity.py: the allow-list of activity events and the never-failing server recorder."""
import logging
import pytest
from api import activity
from api.store import MemoryStore
from tests.api.v1_helpers import A


def test_app_cannot_send_server_events():
    with pytest.raises(ValueError, match="unknown event"):
        activity.validate("signed_in", {"first": True}, source="app")
    assert activity.validate("signed_in", {"first": True}, source="server") == {"first": True}


def test_bools_are_real_booleans():
    assert activity.validate("app_opened", {"cold": True}) == {"cold": True}
    with pytest.raises(ValueError):
        activity.validate("app_opened", {"cold": 1})
    with pytest.raises(ValueError):
        activity.validate("photos_collected", {"count": True})  # a bool is not a count


def test_choices_must_be_listed_strings():
    assert activity.validate("screen_viewed", {"screen": "closet"}) == {"screen": "closet"}
    for bad in ("my secret closet", ["closet"], 3):
        with pytest.raises(ValueError):
            activity.validate("screen_viewed", {"screen": bad})


def test_record_writes_a_server_row_with_ids():
    store = MemoryStore()
    activity.record(store, A, "item_deleted", {"review": "pending"}, item_id="i1")
    [row] = store.events
    assert row["source"] == "server" and row["item_id"] == "i1" and row["props"] == {"review": "pending"}


def test_event_write_failure_never_breaks_the_caller(caplog):
    store = MemoryStore()

    def broken(rows):
        raise RuntimeError("Supabase down")
    store.insert_events = broken
    with caplog.at_level(logging.WARNING):
        assert activity.record(store, A, "item_kept") is None
    assert any("not recorded" in r.getMessage() for r in caplog.records)


def test_an_invalid_server_event_is_only_logged(caplog):
    store = MemoryStore()
    with caplog.at_level(logging.WARNING):
        activity.record(store, A, "item_deleted", {"review": "free text here"})
    assert store.events == []


def test_every_event_is_named_in_the_privacy_categories():
    assert set(activity.PRIVACY_CATEGORIES) == set(activity.EVENTS)


def test_resent_app_event_ids_and_milestones_are_written_once():
    store = MemoryStore()
    rows = [{"user_id": A, "event": "app_opened", "props": {}, "client_event_id": "e1"},
            {"user_id": A, "event": "popup_shown", "props": {"saved": 1}, "client_event_id": "e2"}]
    assert store.insert_events(rows) == 2
    assert store.insert_events(rows + [{"user_id": A, "event": "popup_shown", "props": {}, "client_event_id": "e3"}]) == 0


def test_photo_type_correction_takes_only_the_listed_types_and_stages():
    props = {"from": "laid_out", "to": "worn", "stage": "garment_preview"}
    assert activity.validate("add_photo_type_corrected", props) == props
    for bad in ({"from": "file:///photo.jpg"}, {"to": "outfit"}, {"stage": "camera"}, {"uri": "file:///photo.jpg"}):
        with pytest.raises(ValueError):
            activity.validate("add_photo_type_corrected", {**props, **bad})


def test_morning_reminder_events_take_only_fixed_choices():
    """The one-time morning reminder (mobile/src/morningReminder): closed vocabularies, no ids, times or text."""
    assert activity.validate("onboarding_nudge_choice", {"choice": "accepted"}) == {"choice": "accepted"}
    assert activity.validate("onboarding_nudge_choice", {"choice": "declined"}) == {"choice": "declined"}
    assert activity.validate("onboarding_nudge_scheduled", {"slot": "morning"}) == {"slot": "morning"}
    for reason in ("three_saved", "opt_out", "sign_out", "permission_off", "outfit_off"):
        assert activity.validate("onboarding_nudge_cancelled", {"reason": reason}) == {"reason": reason}
    assert activity.validate("onboarding_nudge_tapped", {"entry": "notification"}) == {"entry": "notification"}
    assert activity.validate("onboarding_started", {"entry": "reminder"}) == {"entry": "reminder"}
    for event, props in [
        ("onboarding_nudge_choice", {"choice": "maybe"}),
        ("onboarding_nudge_scheduled", {"slot": "08:45"}),                    # never the time
        ("onboarding_nudge_scheduled", {"slot": "morning", "at": 1731055500}),
        ("onboarding_nudge_cancelled", {"reason": "user typed text"}),
        ("onboarding_nudge_tapped", {"entry": "notification", "notification_id": "local-1"}),
        ("onboarding_nudge_tapped", {"entry": "push"}),
    ]:
        with pytest.raises(ValueError):
            activity.validate(event, props)
    assert {activity.PRIVACY_CATEGORIES[e] for e in ("onboarding_nudge_choice", "onboarding_nudge_scheduled",
                                                     "onboarding_nudge_cancelled", "onboarding_nudge_tapped")} == {"onboarding"}
