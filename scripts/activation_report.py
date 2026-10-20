"""First 3 Pieces activation report. Admin only, read-only: runs on the server with its secret key.

Times come from the database, not the phone: sign-up = profiles.created_at, a piece = a closet item
(wardrobe_items, review_state null or kept; later removal still counts). Onboarding steps come from
activation_events (api/events.py).

  Time to First Item        first closet item − sign-up (median, p75)
  Time to First 3 Items     third closet item − sign-up
  First-session activation  sign-ups with a closet item within FIRST_SESSION_MINUTES of signing up
  Second import rate        accounts with an item that started paid AI work again more than
                            SECOND_IMPORT_GAP_MINUTES after their first
  Drop-off by step          accounts reaching each onboarding step, and where they left

Usage (from the repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set, e.g. in .env):
  python -m scripts.activation_report              # sign-ups in the last 30 days
  python -m scripts.activation_report --days 7
"""
import argparse
from datetime import datetime, timedelta, timezone
from statistics import median

FIRST_SESSION_MINUTES = 60
SECOND_IMPORT_GAP_MINUTES = 30
FUNNEL = ("onboarding_started", "path_selected", "photos_collected", "detection_completed", "generation_started",
          "first_garment_saved", "first_3_saved", "popup_shown", "popup_add_more")


def _p75(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(0.75 * len(ordered)))]


def _minutes(values: list[float]) -> dict | None:
    if not values:
        return None
    return {"n": len(values), "median": round(median(values), 1), "p75": round(_p75(values), 1)}


def metrics(rows: dict) -> dict:
    """rows: {signups, items, events, paid_jobs} as returned by store.activation_rows."""
    signed = {s["user_id"]: s["created_at"] for s in rows["signups"]}
    items: dict[str, list[datetime]] = {}
    for item in rows["items"]:
        items.setdefault(item["user_id"], []).append(item["created_at"])
    jobs: dict[str, list[datetime]] = {}
    for job in rows["paid_jobs"]:
        jobs.setdefault(job["user_id"], []).append(job["created_at"])

    to_first, to_three, first_session, second_import = [], [], 0, 0
    for user, joined in signed.items():
        times = sorted(items.get(user, []))
        if not times:
            continue
        to_first.append((times[0] - joined).total_seconds() / 60)
        if len(times) >= 3:
            to_three.append((times[2] - joined).total_seconds() / 60)
        if times[0] - joined <= timedelta(minutes=FIRST_SESSION_MINUTES):
            first_session += 1
        started = sorted(jobs.get(user, []))
        if started and any(t - started[0] > timedelta(minutes=SECOND_IMPORT_GAP_MINUTES) for t in started[1:]):
            second_import += 1

    reached = {step: set() for step in FUNNEL}
    left: dict[str, int] = {}
    for event in rows["events"]:
        if event["event"] in reached:
            reached[event["event"]].add(event["user_id"])
        elif event["event"] == "onboarding_abandoned":
            step = (event.get("props") or {}).get("step", "unknown")
            left[step] = left.get(step, 0) + 1

    activated = len(to_first)
    return {
        "signups": len(signed),
        "activated": activated,
        "time_to_first_item_min": _minutes(to_first),
        "time_to_first_3_min": _minutes(to_three),
        "first_session_activation_rate": round(first_session / len(signed), 3) if signed else None,
        "second_import_rate": round(second_import / activated, 3) if activated else None,
        "funnel": {step: len(users) for step, users in reached.items()},
        "abandoned_by_step": left,
    }


def report(m: dict) -> str:
    def mins(v):
        return "—" if v is None else f"median {v['median']} min · p75 {v['p75']} min (n={v['n']})"

    def rate(v):
        return "—" if v is None else f"{v:.0%}"

    lines = [
        f"Sign-ups: {m['signups']} · with a first piece: {m['activated']}",
        f"Time to First Item: {mins(m['time_to_first_item_min'])}",
        f"Time to First 3 Items: {mins(m['time_to_first_3_min'])}",
        f"First-session activation: {rate(m['first_session_activation_rate'])}",
        f"Second import rate: {rate(m['second_import_rate'])}",
        "Onboarding funnel (accounts reaching each step):",
        *[f"  {step:<22} {count}" for step, count in m["funnel"].items()],
        "Left onboarding at:",
        *([f"  {step:<22} {count}" for step, count in sorted(m["abandoned_by_step"].items())] or ["  —"]),
    ]
    return "\n".join(lines)


def _default_store():
    import os
    from dotenv import load_dotenv
    from api.auth import load_settings
    from api.store import SupabaseStore
    load_dotenv()
    return SupabaseStore(load_settings({**os.environ, "WARDROBE_AUTH": "on"}))


def main(argv=None, store=None, now: datetime | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=30, help="sign-ups in the last N days (default 30)")
    args = parser.parse_args(argv)
    since = (now or datetime.now(timezone.utc)) - timedelta(days=max(1, args.days))
    text = report(metrics((store or _default_store()).activation_rows(since)))
    print(text)
    return text


if __name__ == "__main__":
    main()
