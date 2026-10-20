"""Activation analytics for First 3 Pieces: a short, fixed list of steps the app reports (POST /v1/events).

Privacy: only the account id (already the owner of every row), the step name and a few allow-listed
counts or choices. No photos, free text, garment details, device ids or IP addresses. The server stamps
the time. Rows go with the account and are purged after RETENTION_DAYS. Times to first pieces are measured
from wardrobe_items, not from these events (scripts/activation_report.py).
"""

COUNT = "count"  # a whole number 0..MAX_COUNT
MAX_COUNT = 1000

# event -> {prop: COUNT or the set of allowed values}
EVENTS: dict[str, dict[str, object]] = {
    "onboarding_started": {"entry": {"auto", "starter", "home"}},
    "path_selected": {"path": {"near", "not_near"}},
    "photos_collected": {"count": COUNT, "camera": COUNT, "library": COUNT},
    "detection_completed": {"photos": COUNT, "found": COUNT, "unusable": COUNT, "limited": COUNT},
    "generation_started": {"pieces": COUNT, "photos": COUNT, "round": COUNT, "path": {"near", "not_near"}},
    "first_garment_saved": {"path": {"near", "not_near"}},
    "first_3_saved": {"path": {"near", "not_near"}},
    "popup_shown": {"saved": COUNT},
    "popup_add_more": {},
    "onboarding_abandoned": {"step": {"start", "photos", "pick", "processing", "outfit"}},
}
# Recorded at most once per account (a unique index in the database); repeats are ignored.
ONCE = ("first_garment_saved", "first_3_saved", "popup_shown")
EVENTS_PER_HOUR = 120
RETENTION_DAYS = 180


def validate(event: str, props: dict | None) -> dict:
    """The props to store for this event, or ValueError with a message for the client."""
    allowed = EVENTS.get(event)
    if allowed is None:
        raise ValueError("unknown event")
    props = props or {}
    clean = {}
    for name, value in props.items():
        rule = allowed.get(name)
        if rule is None:
            raise ValueError(f"unknown property {name!r} for {event}")
        if rule == COUNT:
            if type(value) is not int or not 0 <= value <= MAX_COUNT:
                raise ValueError(f"{name} must be a whole number from 0 to {MAX_COUNT}")
        elif value not in rule:
            raise ValueError(f"{name} must be one of {', '.join(sorted(rule))}")
        clean[name] = value
    return clean
