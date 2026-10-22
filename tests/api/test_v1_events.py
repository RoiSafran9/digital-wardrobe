"""POST /v1/events: First 3 Pieces activation steps, allow-listed and private; the activation report."""
import json
from datetime import datetime, timedelta, timezone
import pytest
from api.activity import EVENTS_PER_HOUR, RETENTION_DAYS
from api.store import MemoryStore
from api.worker import _sweep_now
from scripts.activation_report import main, metrics
from tests.api.v1_helpers import A, B, as_user, v1_client


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def client(store):
    return v1_client(store)


def send(client, user, event, props=None):
    return client.post("/v1/events", json={"event": event, **({"props": props} if props is not None else {})},
                       headers=as_user(user))


def test_a_step_is_recorded_for_the_signed_in_account_with_the_servers_time(client, store):
    before = datetime.now(timezone.utc)
    assert send(client, A, "photos_collected", {"count": 4, "camera": 3, "library": 1}).status_code == 204
    assert send(client, B, "popup_add_more").status_code == 204
    [a, b] = store.events
    assert (a["user_id"], a["event"], a["props"]) == (A, "photos_collected", {"count": 4, "camera": 3, "library": 1})
    assert a["created_at"] >= before and (b["user_id"], b["props"]) == (B, {})


def test_signing_in_is_required(client):
    assert client.post("/v1/events", json={"event": "popup_add_more"}).status_code == 401


@pytest.mark.parametrize("event, props", [
    ("photo_uploaded", None),                               # not a listed step
    ("photos_collected", {"email": 3}),                     # not a listed prop
    ("photos_collected", {"count": "four"}),                # counts are whole numbers
    ("photos_collected", {"count": True}),
    ("photos_collected", {"count": -1}),
    ("photos_collected", {"count": 100_000}),
    ("path_selected", {"path": "kitchen"}),                 # choices come from a fixed list
    ("onboarding_abandoned", {"step": "a long free text the app should never send"}),
])
def test_anything_off_the_list_is_refused_and_nothing_is_stored(client, store, event, props):
    response = send(client, A, event, props)
    assert response.status_code == 400 and store.events == []


def test_milestones_are_recorded_once_per_account(client, store):
    for _ in range(3):
        assert send(client, A, "first_garment_saved", {"path": "near"}).status_code == 204
    assert send(client, B, "first_garment_saved", {"path": "not_near"}).status_code == 204
    assert [(e["user_id"], e["event"]) for e in store.events] == [(A, "first_garment_saved"), (B, "first_garment_saved")]


def test_too_many_events_in_an_hour_are_refused(client, store):
    for _ in range(EVENTS_PER_HOUR):
        store.insert_event(A, "popup_add_more", {})
    assert send(client, A, "popup_add_more").status_code == 429
    assert send(client, B, "popup_add_more").status_code == 204


def test_events_go_with_the_account(store):
    store.insert_event(A, "popup_add_more", {})
    store.insert_event(B, "popup_add_more", {})
    store.delete_account(A)
    assert [e["user_id"] for e in store.events] == [B]


def test_the_storage_sweep_also_purges_old_events(store):
    store.insert_event(A, "popup_add_more", {})
    store.insert_event(A, "onboarding_started", {"entry": "auto"})
    store.events[0]["created_at"] -= timedelta(days=RETENTION_DAYS + 1)
    _sweep_now(store)
    assert [e["event"] for e in store.events] == ["onboarding_started"]


T0 = datetime(2026, 10, 20, 9, 0, tzinfo=timezone.utc)


def at(minutes):
    return T0 + timedelta(minutes=minutes)


def test_the_report_measures_first_pieces_from_the_database():
    rows = {
        "signups": [{"user_id": u, "created_at": T0} for u in ("u1", "u2", "u3", "u4")],
        "items": [{"user_id": "u1", "created_at": at(m)} for m in (4, 4, 6)]
                 + [{"user_id": "u2", "created_at": at(90)}]
                 + [{"user_id": "u3", "created_at": at(10)}],
        "paid_jobs": [{"user_id": "u1", "created_at": at(m)} for m in (3, 5, 200)]
                     + [{"user_id": "u2", "created_at": at(89)}, {"user_id": "u3", "created_at": at(9)}],
        "events": [{"user_id": u, "event": "onboarding_started", "props": {"entry": "auto"}} for u in ("u1", "u2", "u3", "u4")]
                  + [{"user_id": u, "event": "path_selected", "props": {"path": "near"}} for u in ("u1", "u3")]
                  + [{"user_id": "u4", "event": "onboarding_abandoned", "props": {"step": "start"}}],
    }
    m = metrics(rows)
    assert (m["signups"], m["activated"]) == (4, 3)
    assert m["time_to_first_item_min"] == {"n": 3, "median": 10.0, "p75": 90.0}
    assert m["time_to_first_3_min"] == {"n": 1, "median": 6.0, "p75": 6.0}
    assert m["first_session_activation_rate"] == 0.5          # u1 and u3 within an hour
    assert m["second_import_rate"] == round(1 / 3, 3)         # only u1 came back for more
    assert m["funnel"]["onboarding_started"] == 4 and m["funnel"]["path_selected"] == 2
    assert m["abandoned_by_step"] == {"start": 1}


def test_the_report_runs_on_a_store_and_counts_only_recent_sign_ups(store, capsys):
    now = datetime.now(timezone.utc)
    store.signups = {A: now - timedelta(days=2), B: now - timedelta(days=40)}
    store.insert_event(A, "onboarding_started", {"entry": "auto"})
    text = main(["--days", "30"], store=store, now=now)
    assert "Sign-ups: 1 · with a first piece: 0" in text and "Time to First Item: —" in text
    assert "onboarding_started" in capsys.readouterr().out


def supabase(handler):
    import httpx
    from api.auth import Settings
    from api.store import SupabaseStore
    client = httpx.Client(base_url="https://sb.test", transport=httpx.MockTransport(handler))
    return SupabaseStore(Settings(auth_on=True, supabase_url="https://sb.test", secret_key="k"), client=client)


def test_supabase_store_treats_a_repeated_milestone_as_already_recorded():
    import httpx
    statuses = iter([201, 409])
    store = supabase(lambda request: httpx.Response(next(statuses), json=[{"id": 1}]))
    assert store.insert_event(A, "first_3_saved", {"path": "near"}) is True
    assert store.insert_event(A, "first_3_saved", {"path": "near"}) is False


def test_supabase_store_reads_activation_rows_for_recent_sign_ups_only():
    import httpx
    tables = {
        "profiles": [{"id": "u1", "created_at": "2026-10-20T09:00:00+00:00"}],
        "wardrobe_items": [{"user_id": "u1", "created_at": "2026-10-20T09:04:00Z", "review_state": None},
                           {"user_id": "u1", "created_at": "2026-10-20T09:05:00Z", "review_state": "pending"},
                           {"user_id": "old", "created_at": "2026-10-20T09:06:00Z", "review_state": None}],
        "activity_events": [{"user_id": "u1", "event": "popup_shown", "props": {"saved": 1}, "created_at": "2026-10-20T09:07:00Z"}],
        "generation_jobs": [{"user_id": "u1", "created_at": "2026-10-20T09:03:00Z"}],
    }
    store = supabase(lambda request: httpx.Response(200, json=tables[request.url.path.rsplit("/", 1)[1]]))
    rows = store.activation_rows(T0 - timedelta(days=1))
    assert [r["user_id"] for r in rows["items"]] == ["u1"] and rows["items"][0]["created_at"] == at(4)
    assert rows["events"][0]["event"] == "popup_shown" and rows["paid_jobs"][0]["created_at"] == at(3)
    assert rows["signups"] == [{"user_id": "u1", "created_at": T0}]


# --- batches from the app (activity logging L4) ----------------------------------------------------------

import uuid  # noqa: E402


def item(event, props=None, **extra):
    return {"event": event, "props": props or {}, "client_event_id": str(uuid.uuid4()),
            "client_at": datetime.now(timezone.utc).isoformat(), "session_id": str(uuid.uuid4()), **extra}


def batch(client, user, events, version="1.0.3 (7)"):
    return client.post("/v1/events/batch", json={"app_version": version, "events": events}, headers=as_user(user))


def test_batch_stores_valid_events_and_skips_invalid_ones(client, store):
    events = [item("app_opened", {"cold": True}), item("screen_viewed", {"screen": "closet"}),
              item("permission", {"kind": "camera", "granted": False}),
              item("photo_uploaded"), item("signed_in", {"first": True})]
    r = batch(client, A, events)
    assert r.status_code == 200 and r.json() == {"stored": 3, "skipped": 2}
    rows = [e for e in store.events if e["user_id"] == A]
    assert [e["event"] for e in rows] == ["app_opened", "screen_viewed", "permission"]
    assert all(e["source"] == "app" and e["app_version"] == "1.0.3 (7)" and e["session_id"] for e in rows)


def test_a_resent_batch_is_a_no_op(client, store):
    events = [item("app_opened", {"cold": False}), item("screen_viewed", {"screen": "home"})]
    assert batch(client, A, events).json() == {"stored": 2, "skipped": 0}
    assert batch(client, A, events).json() == {"stored": 0, "skipped": 2}
    assert len(store.events) == 2


def test_batch_rows_belong_to_the_token_account(client, store):
    r = batch(client, A, [item("app_opened", {"cold": True}, user_id=B), item("item_opened", {"user_id": B})])
    assert r.json()["stored"] == 1
    [row] = store.events
    assert row["user_id"] == A and "item_id" not in row and "job_id" not in row


def test_batch_rate_limit(client, store):
    for _ in range(EVENTS_PER_HOUR):
        store.insert_event(A, "popup_add_more", {})
    assert batch(client, A, [item("app_opened", {"cold": True})]).status_code == 429


def test_client_time_is_kept_within_a_week(client, store):
    old = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    batch(client, A, [item("app_opened", {"cold": True}, client_at=old), item("app_opened", {"cold": False}, client_at=future)])
    now = datetime.now(timezone.utc)
    for row in store.events:
        assert now - timedelta(days=7, minutes=1) <= row["client_at"] <= now + timedelta(minutes=1)


@pytest.mark.parametrize("body", [
    {"app_version": "1.0", "events": []},
    {"app_version": "1.0", "events": [item("app_opened")] * 51},
    {"app_version": "<script>", "events": [item("app_opened")]},
    {"app_version": "1" * 21, "events": [item("app_opened")]},
])
def test_bad_batches_are_refused(client, body):
    assert client.post("/v1/events/batch", json=body, headers=as_user(A)).status_code == 422


def test_supabase_store_falls_back_to_one_by_one_when_a_batch_repeats_an_event():
    import httpx
    calls = []

    def handler(request):
        body = json.loads(request.content)
        calls.append(body)
        if isinstance(body, list):
            return httpx.Response(409, json={"code": "23505"})
        return httpx.Response(409 if body["client_event_id"] == "dup" else 201, json=[{"id": 1}])
    store = supabase(handler)
    rows = [{"user_id": A, "event": "app_opened", "props": {}, "client_event_id": cid} for cid in ("dup", "new")]
    assert store.insert_events(rows) == 1
    assert len(calls) == 3 and all(c is not None for c in calls)
