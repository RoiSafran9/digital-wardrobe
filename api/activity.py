"""Activity events: the record of meaningful actions in KIPS (spec 2026-10-22-activity-logging-design.md).

Server events (source 'server') are recorded by the backend from the verified token after the action
succeeded; app events (source 'app') come from POST /v1/events and /v1/events/batch. The real tables stay the
truth for credits (credit_ledger), jobs (generation_jobs) and pieces (wardrobe_items); events add what no table
records.

Privacy: only the account id (already the owner of every row), the event name, allow-listed counts, booleans
and fixed choices, the account's own job/item ids, the app version and a per-session random id. No photos,
free text, garment details, emails, device ids or IP addresses. The server stamps the time. Rows go with the
account and are purged after RETENTION_DAYS. Keep the privacy page's "Usage records" in step with this list.
"""
import logging

log = logging.getLogger("wardrobe.activity")

COUNT = "count"  # a whole number 0..MAX_COUNT
BOOL = "bool"
MAX_COUNT = 1000

PATH = {"near", "not_near"}
SCREENS = {"home", "closet", "add", "account", "camera", "preview", "processing", "results", "outfit_detect",
           "outfit_pick", "outfit_review", "item", "price_list", "credits_activity", "help", "global"}
ACTIONS = {"garment", "back", "turn", "outfit", "regenerate"}
JOB_KINDS = {"garment", "back", "turn", "outfit_scan", "outfit_generate", "outfit_regenerate", "garment_scan"}
FAILURE_CODES = {"photo_quality", "no_garment", "item_gone", "scan_expired", "model_timeout", "model_refused",
                 "model_error", "all_pieces_failed", "internal"}
EDIT_FIELDS = {"name", "category", "colors", "pattern", "trims", "visible_text"}  # api/schemas.ItemPatch
REFUSAL_ROUTES = {
    "/v1/jobs": "job",
    "/v1/garment-scans": "garment_scan",
    "/v1/garment-scans/{scan_id}/generate": "garment_generate",
    "/v1/items/{item_id}/back": "back",
    "/v1/items/{item_id}/turn": "turn",
    "/v1/outfit-scans": "outfit_scan",
    "/v1/outfit-scans/{scan_id}/generate": "outfit_generate",
    "/v1/items/{item_id}/regenerate": "regenerate",
}
REFUSAL_REASONS = {402: "no_credits", 409: "conflict", 429: "rate_limited", 503: "unavailable"}

# event -> {prop: COUNT, BOOL or the set of allowed values}
APP_EVENTS: dict[str, dict[str, object]] = {
    # First 3 Pieces onboarding (unchanged from api/events.py)
    "onboarding_started": {"entry": {"auto", "starter", "home"}},
    "path_selected": {"path": PATH},
    "photos_collected": {"count": COUNT, "camera": COUNT, "library": COUNT},
    "detection_completed": {"photos": COUNT, "found": COUNT, "unusable": COUNT, "limited": COUNT},
    "generation_started": {"pieces": COUNT, "photos": COUNT, "round": COUNT, "path": PATH},
    "first_garment_saved": {"path": PATH},
    "first_3_saved": {"path": PATH},
    "popup_shown": {"saved": COUNT},
    "popup_add_more": {},
    "onboarding_abandoned": {"step": {"start", "photos", "pick", "processing", "outfit"}},
    # App use
    "app_opened": {"cold": BOOL},
    "screen_viewed": {"screen": SCREENS},
    "cost_sheet": {"action": ACTIONS, "choice": {"confirmed", "cancelled"}, "pieces": COUNT},
    "out_of_credits_shown": {"action": ACTIONS},
    "permission": {"kind": {"camera", "photos", "notifications"}, "granted": BOOL},
    "capture_source": {"flow": {"garment", "outfit"}, "from": {"camera", "library"}},
    "item_opened": {"has_back": BOOL, "has_turn": BOOL},
    "client_error": {"where": SCREENS, "kind": {"render", "unhandled", "network", "http_5xx"}},
}
SERVER_EVENTS: dict[str, dict[str, object]] = {
    "signed_in": {"first": BOOL},
    "welcome_granted": {"credits": COUNT},
    "refused": {"route": set(REFUSAL_ROUTES.values()), "reason": set(REFUSAL_REASONS.values())},
    "item_edited": {"field": EDIT_FIELDS, "first": BOOL},
    "item_deleted": {"review": {"pending", "kept", "none"}},
    "item_kept": {},
    "region_added": {},
    "job_finished": {"kind": JOB_KINDS, "status": {"succeeded", "failed"}, "failure": FAILURE_CODES,
                     "seconds": COUNT, "pieces_made": COUNT, "pieces_failed": COUNT, "attempts": COUNT},
    "push_enabled": {},
    "push_disabled": {},
}
EVENTS = {**APP_EVENTS, **SERVER_EVENTS}

# What the privacy page's "Usage records" calls each event (test: every event has a category).
PRIVACY_CATEGORIES = {
    **{e: "onboarding" for e in ("onboarding_started", "path_selected", "photos_collected", "detection_completed",
                                 "generation_started", "first_garment_saved", "first_3_saved", "popup_shown",
                                 "popup_add_more", "onboarding_abandoned")},
    **{e: "app use" for e in ("app_opened", "screen_viewed", "cost_sheet", "out_of_credits_shown", "permission",
                              "capture_source", "item_opened", "push_enabled", "push_disabled")},
    "client_error": "errors", "refused": "errors",
    "signed_in": "signing in", "welcome_granted": "signing in",
    "item_edited": "editing", "item_deleted": "removing", "item_kept": "creating", "region_added": "scanning",
    "job_finished": "AI jobs",
}

# Recorded at most once per account (a unique index in the database); repeats are ignored.
ONCE = ("first_garment_saved", "first_3_saved", "popup_shown")
EVENTS_PER_HOUR = 600
RETENTION_DAYS = 180


def validate(event: str, props: dict | None, source: str = "app") -> dict:
    """The props to store for this event, or ValueError with a message for the client."""
    allowed = (APP_EVENTS if source == "app" else EVENTS).get(event)
    if allowed is None:
        raise ValueError("unknown event")
    clean = {}
    for name, value in (props or {}).items():
        rule = allowed.get(name)
        if rule is None:
            raise ValueError(f"unknown property {name!r} for {event}")
        if rule == COUNT:
            if type(value) is not int or not 0 <= value <= MAX_COUNT:
                raise ValueError(f"{name} must be a whole number from 0 to {MAX_COUNT}")
        elif rule == BOOL:
            if type(value) is not bool:
                raise ValueError(f"{name} must be true or false")
        elif not isinstance(value, str) or value not in rule:
            raise ValueError(f"{name} must be one of {', '.join(sorted(rule))}")
        clean[name] = value
    return clean


def record(store, user_id: str, event: str, props: dict | None = None, *, job_id: str | None = None,
           item_id: str | None = None) -> None:
    """A server event. Never raises: a failure is one warning line, and the action it describes stands."""
    try:
        row = {"user_id": user_id, "event": event, "props": validate(event, props, source="server"), "source": "server"}
        if job_id:
            row["job_id"] = job_id
        if item_id:
            row["item_id"] = item_id
        store.insert_events([row])
    except Exception:
        log.warning("activity event %s not recorded", event, exc_info=True)


def refusal_recorder(store):
    """For api/logs.add_request_log: a refused AI request (402/409/429/503) becomes a `refused` event."""
    def on_response(request, status: int) -> None:
        reason = REFUSAL_REASONS.get(status)
        user = getattr(request.state, "user_id", None)
        route = REFUSAL_ROUTES.get(getattr(request.scope.get("route"), "path", None))
        if reason and user and route and request.method == "POST":
            record(store, user, "refused", {"route": route, "reason": reason})
    return on_response
