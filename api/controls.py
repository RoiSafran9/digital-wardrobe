"""Operator controls for the beta, all from the server's environment (never from the app):

- WARDROBE_GENERATION=off      pause all new AI work (the closet stays usable); on by default.
- WARDROBE_FREE_SCANS_PER_HOUR how many free scans (garment pre-scans, outfit scans) one account may start
                               per hour; they cost the app real AI calls. Default 30.
- WARDROBE_WELCOME_CREDITS     the one-time welcome grant for an invited account; unset/0 = off.
- WARDROBE_BETA_INVITES        who gets it: "*" for everyone, or a comma list of emails and @domains.
- WARDROBE_DAILY_AI_JOBS       a hard cap on paid AI jobs per UTC day across all accounts (cost guard); unset = none.
- WARDROBE_SWEEP_EVERY_HOURS   run the Storage cleanup (scripts/sweep_storage.py) in the worker this often; unset = never.
"""
import os
from fastapi import HTTPException

WELCOME_KEY = "welcome:beta-v1"
PAUSED = "AI generation is paused for now — your closet still works. Try again later"


def generation_on() -> bool:
    return os.environ.get("WARDROBE_GENERATION", "on").strip().lower() not in ("off", "0", "false")


def require_generation():
    """Dependency for every route that starts paid or costly AI work."""
    if not generation_on():
        raise HTTPException(503, PAUSED)


def _int_env(name: str, default: int) -> int:
    try:
        return max(0, int(os.environ.get(name, "").strip() or default))
    except ValueError:
        return default


def free_scans_per_hour() -> int:
    return _int_env("WARDROBE_FREE_SCANS_PER_HOUR", 30)


def welcome_credits() -> int:
    return _int_env("WARDROBE_WELCOME_CREDITS", 0)


def invited(email: str | None) -> bool:
    entries = [e.strip().lower() for e in os.environ.get("WARDROBE_BETA_INVITES", "").split(",") if e.strip()]
    if "*" in entries:
        return True
    email = (email or "").strip().lower()
    if not email:
        return False
    domain = "@" + email.rsplit("@", 1)[-1]
    return email in entries or domain in entries


PAID_KINDS = ("garment", "back", "turn", "outfit_generate", "outfit_regenerate")
BUDGET_USED = "Today's AI budget is used up — try again tomorrow"


def daily_ai_jobs() -> int:
    return _int_env("WARDROBE_DAILY_AI_JOBS", 0)


def sweep_every_hours() -> int:
    return _int_env("WARDROBE_SWEEP_EVERY_HOURS", 0)


def start_of_day():
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)
