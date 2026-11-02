"""KIPS usage report: how the beta is going, and what one account did. Admin only, read-only, on the server.

Reads the real tables (profiles, generation_jobs, credit_ledger, wardrobe_items) plus activity_events and
ai_calls — ids, kinds, numbers and times only; never photos, piece details or text. The same numbers are
in the reports.* views for the Supabase SQL editor.

  Funnel        sign-ups → signed in → onboarding → first scan → first paid image → first piece → 3 pieces
                → came back with a piece (legacy: an item SECOND_IMPORT_GAP_MINUTES after the first, same day
                counts — see Launch for the different-day measure)
  Activation    the First 3 Pieces numbers (scripts/activation_report.py)
  Launch        first-five beta KPIs (docs/beta/first-five-mac/04 §3), each with its eligible denominator:
                first piece within 24 h; 3 pieces within 7 days; second import on a different UTC day within
                7 days of the first piece; meaningful return on a later UTC day within 7 days of sign-up
                (a piece saved, an own piece opened, or outfit suggestions shown/opened — never a bare app open)
  Retention     accounts active (any event, a job or a credit hold/charge — app opens count) on day 1, on
                days 6–8 and 8–14 after their sign-up day (UTC), among those old enough; weekly active accounts
  Features      accounts and counts per feature; cost-sheet cancel rate per action
  Reliability   jobs per kind: success, failure codes, p50/p95 queued→finished seconds; refusals; app errors
  AI cost       estimated USD (pipeline/costs.py): total, per job kind, per account, per credit charged,
                share on the fallback image model, share spent on retries
  Credits       granted, charged and released (credit_ledger)

Usage (repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set, e.g. in .env):
  python -m scripts.usage_report                 # the last 30 days
  python -m scripts.usage_report --days 7 --json
  python -m scripts.usage_report --user tester@example.com   # one account's timeline (email or id)
  python -m scripts.usage_report --cohort ~/kips-private/first-five.txt   # the pilot testers, by alias only

The cohort file lives OUTSIDE the repository (the command refuses one inside it): one tester per line,
"<alias> <email or account id>", e.g. "T1 someone@example.com"; # starts a comment. The output names
aliases only — never an email or account id — so it can go into the private pilot tracker.
"""
import argparse
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import median
from scripts.activation_report import SECOND_IMPORT_GAP_MINUTES, metrics as activation_metrics

SCAN_KINDS = {"garment_scan", "outfit_scan"}
PAID_KINDS = {"garment", "back", "turn", "outfit_generate", "outfit_regenerate"}
FEATURES = {"garment_photo": "garment", "outfit_photo": "outfit_generate", "outfit_regenerate": "outfit_regenerate",
            "back": "back", "turn": "turn"}
EVENT_FEATURES = {"edits": "item_edited", "outfit_kept": "item_kept", "missed_garments_marked": "region_added"}


def _in_closet(item: dict) -> bool:
    """A piece made in the app that reached the closet. Pieces moved in from runs/ (migrated) keep their old
    file times, from before the account existed: they never count as made."""
    return item.get("review_state") in (None, "kept") and not item.get("migrated")


def _pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(q * len(ordered)))]


def _rate(part: int, whole: int) -> float | None:
    return round(part / whole, 3) if whole else None


def _active_days(rows: dict) -> dict[str, set]:
    days: dict[str, set] = {}
    for r in rows["events"] + rows["jobs"] + [e for e in rows["ledger"] if e["kind"] in ("hold", "charge")]:
        if r.get("user_id"):
            days.setdefault(r["user_id"], set()).add(r["created_at"].date())
    return days


def _funnel(rows: dict) -> dict:
    users = {s["user_id"] for s in rows["signups"]}

    def having(rs, test=lambda r: True):
        return {r["user_id"] for r in rs if r.get("user_id") in users and test(r)}
    items: dict[str, list] = {}
    joined = {s["user_id"]: s["created_at"] for s in rows["signups"]}
    for i in rows["items"]:
        if i["user_id"] in users and _in_closet(i) and i["created_at"] >= joined[i["user_id"]]:
            items.setdefault(i["user_id"], []).append(i["created_at"])
    gap = timedelta(minutes=SECOND_IMPORT_GAP_MINUTES)
    return {
        "signed_up": len(users),
        "signed_in": len(having(rows["events"], lambda e: e["event"] == "signed_in")),
        "onboarding_started": len(having(rows["events"], lambda e: e["event"] == "onboarding_started")),
        "first_scan": len(having(rows["jobs"], lambda j: j["kind"] in SCAN_KINDS)),
        "first_generate": len(having(rows["jobs"], lambda j: j["kind"] in PAID_KINDS)),
        "first_piece": len(items),
        "three_pieces": sum(1 for t in items.values() if len(t) >= 3),
        "came_back_with_a_piece": sum(1 for t in items.values() if any(x - min(t) >= gap for x in t)),
    }


def _retention(rows: dict) -> dict:
    now, active = rows["now"], _active_days(rows)

    def window(first: int, last: int) -> dict:
        eligible = [s for s in rows["signups"] if s["created_at"].date() + timedelta(days=last + 1) <= now.date()]
        back = [s for s in eligible if any(s["created_at"].date() + timedelta(days=d) in active.get(s["user_id"], set())
                                           for d in range(first, last + 1))]
        return {"eligible": len(eligible), "returned": len(back), "rate": _rate(len(back), len(eligible))}
    week = {d for d in (now.date() - timedelta(days=i) for i in range(7))}
    return {"d1": window(1, 1), "d7": window(6, 8), "w2": window(8, 14),
            "weekly_active": sum(1 for days in active.values() if days & week)}


def _features(rows: dict) -> dict:
    out = {}
    for name, kind in FEATURES.items():
        jobs = [j for j in rows["jobs"] if j["kind"] == kind]
        out[name] = {"accounts": len({j["user_id"] for j in jobs}), "count": len(jobs)}
    for name, event in EVENT_FEATURES.items():
        events = [e for e in rows["events"] if e["event"] == event]
        out[name] = {"accounts": len({e["user_id"] for e in events}), "count": len(events)}
    discards = [e for e in rows["events"] if e["event"] == "item_deleted" and (e["props"] or {}).get("review") == "pending"]
    removals = [e for e in rows["events"] if e["event"] == "item_deleted" and (e["props"] or {}).get("review") != "pending"]
    out["outfit_discarded"] = {"accounts": len({e["user_id"] for e in discards}), "count": len(discards)}
    out["removed_from_closet"] = {"accounts": len({e["user_id"] for e in removals}), "count": len(removals)}
    sheets: dict[str, list] = {}
    for e in rows["events"]:
        if e["event"] == "cost_sheet":
            sheets.setdefault(e["props"].get("action"), []).append(e["props"].get("choice") == "cancelled")
    out["cost_sheet_cancel_rate"] = {a: _rate(sum(c), len(c)) for a, c in sorted(sheets.items()) if a}
    return out


def _reliability(rows: dict) -> dict:
    jobs: dict[str, dict] = {}
    for kind in sorted({j["kind"] for j in rows["jobs"]}):
        mine = [j for j in rows["jobs"] if j["kind"] == kind]
        secs = [(j["finished_at"] - j["created_at"]).total_seconds() for j in mine if j.get("finished_at")]
        failures: dict[str, int] = {}
        for j in mine:
            if j["status"] == "failed":
                failures[j.get("failure_code") or "unknown"] = failures.get(j.get("failure_code") or "unknown", 0) + 1
        done = [j for j in mine if j["status"] in ("succeeded", "failed")]
        jobs[kind] = {"jobs": len(mine), "succeeded": sum(1 for j in mine if j["status"] == "succeeded"),
                      "failed": sum(1 for j in mine if j["status"] == "failed"),
                      "success_rate": _rate(sum(1 for j in done if j["status"] == "succeeded"), len(done)),
                      "failures": failures, "p50_seconds": median(secs) if secs else None, "p95_seconds": _pct(secs, 0.95)}

    def count(event: str, prop: str) -> dict:
        out: dict[str, int] = {}
        for e in rows["events"]:
            if e["event"] == event:
                key = (e["props"] or {}).get(prop, "unknown")
                out[key] = out.get(key, 0) + 1
        return out
    return {"jobs": jobs, "refusals": count("refused", "reason"), "client_errors": count("client_error", "kind")}


def _ai_cost(rows: dict) -> dict:
    calls = rows["ai_calls"]
    usd = lambda cs: round(sum(float(c["est_cost_usd"] or 0) for c in cs), 6)  # noqa: E731
    total = usd(calls)
    by_kind: dict[str, float] = {}
    by_user: dict[str, float] = {}
    for c in calls:
        by_kind[c.get("job_kind") or "unknown"] = round(by_kind.get(c.get("job_kind") or "unknown", 0) + float(c["est_cost_usd"] or 0), 6)
        if c.get("user_id"):
            by_user[c["user_id"]] = round(by_user.get(c["user_id"], 0) + float(c["est_cost_usd"] or 0), 6)
    image = [c for c in calls if "image" in (c.get("model") or "")]
    charged = sum(e["amount"] for e in rows["ledger"] if e["kind"] == "charge")
    return {
        "total_usd": total, "by_kind": by_kind,
        "per_account": {"accounts": len(by_user), "median": median(by_user.values()) if by_user else None,
                        "max": max(by_user.values()) if by_user else None},
        "per_credit_charged": round(total / charged, 6) if charged else None,
        "fallback_share": _rate(sum(1 for c in image if c.get("fallback")), len(image)),
        "retry_share": round(usd([c for c in calls if (c.get("attempt") or 1) > 1]) / total, 3) if total else None,
        "calls": len(calls), "failed_calls": sum(1 for c in calls if c.get("status") == "error"),
    }


WINDOW_DAYS = 7


def _meaningful(rows: dict) -> dict[str, list[tuple[datetime, str]]]:
    """Per account: (when, what) for actions that show real use. A bare app open, a screen view, a sign-in or a
    job poll is not one; a piece later removed still counts (it was saved)."""
    joined = {s["user_id"]: s["created_at"] for s in rows["signups"]}
    acts: dict[str, list] = {}
    for i in rows["items"]:
        if i["user_id"] in joined and _in_closet(i) and i["created_at"] >= joined[i["user_id"]]:
            acts.setdefault(i["user_id"], []).append((i["created_at"], "saved_piece"))
    for e in rows["events"]:
        if e.get("user_id") not in joined:
            continue
        props = e.get("props") or {}
        what = {"item_opened": "opened_piece", "look_opened": "opened_look"}.get(e["event"])
        if e["event"] == "look_generation_requested" and (props.get("results") or 0) > 0:
            what = "got_looks"
        if what:
            acts.setdefault(e["user_id"], []).append((e["created_at"], what))
    return acts


def _day_end(day, days: int = 0) -> datetime:
    """Midnight UTC after `day` + days: when a window of whole UTC days is over."""
    return datetime.combine(day + timedelta(days=days + 1), datetime.min.time(), tzinfo=timezone.utc)


def _launch_people(rows: dict) -> dict[str, dict]:
    """Per account in the cohort: each launch KPI is True (reached), False (window over, not reached) or None
    (still in its window, or — for the second import — no first piece, so not in that KPI's cohort)."""
    now, acts = rows["now"], _meaningful(rows)

    def kpi(reached: bool, closes: datetime) -> bool | None:
        return True if reached else (False if closes <= now else None)

    def within(start, times) -> list:  # UTC days after `start`, up to WINDOW_DAYS later
        return sorted({t.date() for t in times if start < t.date() <= start + timedelta(days=WINDOW_DAYS)})
    out = {}
    for s in rows["signups"]:
        user, joined = s["user_id"], s["created_at"]
        pieces = sorted(t for t, what in acts.get(user, []) if what == "saved_piece")
        first = pieces[0] if pieces else None
        return_days = within(joined.date(), [t for t, _ in acts.get(user, [])])
        out[user] = {
            "minutes_to_first_piece": round((first - joined).total_seconds() / 60, 1) if first else None,
            "pieces": len(pieces),
            "first_piece_24h": kpi(bool(first) and first - joined <= timedelta(hours=24), joined + timedelta(hours=24)),
            "three_pieces_7d": kpi(len(pieces) >= 3 and pieces[2] - joined <= timedelta(days=WINDOW_DAYS),
                                   joined + timedelta(days=WINDOW_DAYS)),
            "second_import_other_day_7d": kpi(bool(within(first.date(), pieces)), _day_end(first.date(), WINDOW_DAYS))
                                          if first else None,
            "meaningful_return_7d": kpi(bool(return_days), _day_end(joined.date(), WINDOW_DAYS)),
            "return_actions": sorted({what for t, what in acts.get(user, []) if t.date() in return_days}),
        }
    return out


def _launch(rows: dict) -> dict:
    """The launch KPIs over the cohort: reached of eligible (window closed), plus accounts still in their window."""
    people = _launch_people(rows)

    def kpi(name: str, cohort) -> dict:
        members = [p for p in people.values() if cohort(p)]
        closed = [p for p in members if p[name] is not None]
        reached = sum(1 for p in closed if p[name])
        return {"eligible": len(closed), "reached": reached, "rate": _rate(reached, len(closed)),
                "still_in_window": len(members) - len(closed)}
    firsts = [p["minutes_to_first_piece"] for p in people.values() if p["minutes_to_first_piece"] is not None]
    return {
        "cohort": len(people),
        "first_piece_24h": kpi("first_piece_24h", lambda p: True),
        "three_pieces_7d": kpi("three_pieces_7d", lambda p: True),
        "second_import_other_day_7d": kpi("second_import_other_day_7d", lambda p: p["minutes_to_first_piece"] is not None),
        "meaningful_return_7d": kpi("meaningful_return_7d", lambda p: True),
        "minutes_to_first_piece": {"n": len(firsts), "median": median(firsts) if firsts else None,
                                   "p75": _pct(firsts, 0.75)},
    }


def metrics(rows: dict) -> dict:
    """rows: as returned by store.usage_rows (signups, items, removed, jobs, ledger, events, ai_calls, now)."""
    users = {s["user_id"] for s in rows["signups"]}
    activation_rows = {
        "signups": rows["signups"],
        "items": [{"user_id": i["user_id"], "created_at": i["created_at"]} for i in rows["items"]
                  if i["user_id"] in users and _in_closet(i)],
        "events": [e for e in rows["events"] if e["user_id"] in users],
        "paid_jobs": [{"user_id": j["user_id"], "created_at": j["created_at"]} for j in rows["jobs"]
                      if j["user_id"] in users and j["kind"] in PAID_KINDS],
    }
    return {
        "funnel": _funnel(rows),
        "activation": activation_metrics(activation_rows),
        "launch": _launch(rows),
        "retention": _retention(rows),
        "features": _features(rows),
        "reliability": _reliability(rows),
        "ai_cost": _ai_cost(rows),
        "credits": {k: sum(e["amount"] for e in rows["ledger"] if e["kind"] == kind)
                    for k, kind in (("granted", "grant"), ("charged", "charge"), ("released", "release"))},
    }


def report(m: dict) -> str:
    from scripts.activation_report import report as activation_report

    def rate(v):
        return "—" if v is None else f"{v:.0%}"

    def usd(v):
        return "—" if v is None else f"${v:.4f}"
    r, c = m["retention"], m["ai_cost"]
    funnel_labels = {"came_back_with_a_piece": f"came_back_with_a_piece (≥{SECOND_IMPORT_GAP_MINUTES} min later, same day counts)"}
    retention_labels = {"d1": "d1 (any activity on day 1)", "d7": "d7 (any activity, days 6–8)",
                        "w2": "w2 (any activity, days 8–14)"}
    lines = ["Funnel (sign-ups in the period):", *[f"  {funnel_labels.get(k, k):<24} {v}" for k, v in m["funnel"].items()],
             "", "Activation (First 3 Pieces):", *["  " + line for line in activation_report(m["activation"]).splitlines()],
             "", *launch_report(m["launch"]),
             "", "Retention (legacy: any activity counts, app opens included):",
             *[f"  {retention_labels[name]:<30} {rate(r[name]['rate'])} ({r[name]['returned']} of {r[name]['eligible']})"
               for name in ("d1", "d7", "w2")],
             f"  weekly active accounts: {r['weekly_active']}",
             "", "Features (accounts · times):",
             *[f"  {k:<24} {v['accounts']} · {v['count']}" for k, v in m["features"].items() if isinstance(v, dict) and "count" in v],
             "  cost sheet cancelled: " + (", ".join(f"{a} {rate(v)}" for a, v in m["features"]["cost_sheet_cancel_rate"].items()) or "—"),
             "", "Reliability:"]
    for kind, j in m["reliability"]["jobs"].items():
        fails = ", ".join(f"{k} {n}" for k, n in sorted(j["failures"].items())) or "no failures"
        p50 = "—" if j["p50_seconds"] is None else f"{j['p50_seconds']:.0f}s"
        p95 = "—" if j["p95_seconds"] is None else f"{j['p95_seconds']:.0f}s"
        lines.append(f"  {kind:<18} {j['jobs']} jobs · {rate(j['success_rate'])} ok · p50 {p50} · p95 {p95} · {fails}")
    lines += [f"  refused: " + (", ".join(f"{k} {n}" for k, n in sorted(m["reliability"]["refusals"].items())) or "—"),
              f"  app errors: " + (", ".join(f"{k} {n}" for k, n in sorted(m["reliability"]["client_errors"].items())) or "—"),
              "", "AI cost (estimated):",
              f"  total {usd(c['total_usd'])} over {c['calls']} calls ({c['failed_calls']} failed)",
              *[f"  {k:<18} {usd(v)}" for k, v in sorted(c["by_kind"].items())],
              f"  per account: median {usd(c['per_account']['median'])} · max {usd(c['per_account']['max'])}",
              f"  per credit charged: {usd(c['per_credit_charged'])} · fallback model {rate(c['fallback_share'])} of image calls"
              f" · retries {rate(c['retry_share'])} of cost",
              "", "Credits: " + " · ".join(f"{k} {v}" for k, v in m["credits"].items())]
    return "\n".join(lines)


LAUNCH_LABELS = {
    "first_piece_24h": "first piece within 24 h of sign-up",
    "three_pieces_7d": "3 pieces within 7 days of sign-up",
    "second_import_other_day_7d": "second import on a different UTC day ≤7 days after the first piece (of those with one)",
    "meaningful_return_7d": "meaningful return on a later UTC day ≤7 days after sign-up",
}


def launch_report(launch: dict) -> list[str]:
    """Counts first ("2 of 5"); the rate only beside them. Accounts still inside a window are listed apart."""
    def line(name: str) -> str:
        k = launch[name]
        pending = f" · {k['still_in_window']} still in window" if k["still_in_window"] else ""
        pct = "" if k["rate"] is None else f" ({k['rate']:.0%})"
        return f"  {k['reached']} of {k['eligible']}{pct}{pending} — {LAUNCH_LABELS[name]}"
    t = launch["minutes_to_first_piece"]
    first = "—" if t["median"] is None else f"median {t['median']:.0f} min · p75 {t['p75']:.0f} min (n={t['n']})"
    return [f"Launch KPIs (cohort {launch['cohort']}; meaningful = piece saved, own piece opened, outfit suggestions"
            " shown or opened; never a bare app open):",
            *[line(name) for name in LAUNCH_LABELS], f"  time to first saved piece: {first}"]


PER_PIECE_KINDS = {"garment", "outfit_generate"}  # cost_credits is the price of one front; the hold is × pieces


def _price(job: dict) -> str:
    credits = job.get("cost_credits")
    if not credits:
        return ""
    unit = "credit" if credits == 1 else "credits"
    return f" · {credits} {unit} per piece" if job["kind"] in PER_PIECE_KINDS else f" · {credits} {unit}"


def timeline(rows: dict) -> str:
    """One account's history, oldest first: sign-up, events, jobs, credits, pieces. No piece details. Job lines
    carry the job id and app errors their request_id, to find them in the server log."""
    entries = [(s["created_at"], 0, "signed up") for s in rows["signups"]]
    for e in rows["events"]:
        props = " ".join(f"{k}={v}" for k, v in sorted((e.get("props") or {}).items()))
        entries.append((e["created_at"], 1, f"{e['source']:<6} {e['event']} {props}".rstrip()))
    for j in rows["jobs"]:
        ref = f" [job {j['id']}]" if j.get("id") else ""  # grep the server log (job_id) and ai_calls with it
        entries.append((j["created_at"], 1, f"server {j['kind']} job started" + _price(j) + ref))
        if j.get("finished_at"):
            secs = round((j["finished_at"] - j["created_at"]).total_seconds())
            why = f" ({j['failure_code']})" if j.get("failure_code") else ""
            entries.append((j["finished_at"], 1, f"server {j['kind']} job {j['status']}{why} after {secs}s{ref}"))
    for e in rows["ledger"]:
        entries.append((e["created_at"], 1, f"credits {e['kind']} {e['amount']}" + (f" ({e['action']})" if e.get("action") else "")))
    moved = sorted(i["created_at"] for i in rows["items"] if i.get("migrated"))
    if moved:  # one line: they were moved in by scripts/migrate_runs.py, not made in the app
        entries.append((moved[0], 1, f"server {len(moved)} pieces moved from the old closet (runs/), "
                                     f"dated by their files {moved[0]:%Y-%m-%d} to {moved[-1]:%Y-%m-%d}"))
    for i in rows["items"]:
        if i.get("migrated"):
            continue
        entries.append((i["created_at"], 1, f"server piece created ({i.get('origin') or 'garment_photo'}"
                                            + (f", {i['review_state']}" if i.get("review_state") else "") + ")"))
    for i in rows.get("removed", []):
        entries.append((i["deleted_at"], 1, "server piece removed"))
    spent = sum(float(c["est_cost_usd"] or 0) for c in rows.get("ai_calls", []))
    lines = [f"{at:%Y-%m-%d %H:%M:%S}  {text}" for at, _, text in sorted(entries, key=lambda e: (e[0], e[1]))]
    lines.append(f"AI cost for this account (estimated): ${spent:.4f} over {len(rows.get('ai_calls', []))} calls")
    return "\n".join(lines)


REPO = Path(__file__).resolve().parent.parent
ROW_KINDS = ("signups", "items", "removed", "jobs", "ledger", "events", "ai_calls")


def read_cohort(path: str) -> list[tuple[str, str]]:
    """(alias, email or account id) per tester, from a private file that must live outside the repository."""
    file = Path(path).expanduser().resolve()
    if file == REPO or REPO in file.parents:
        raise SystemExit("Keep the cohort file outside the repository (it names real testers).")
    entries = []
    for n, raw in enumerate(file.read_text().splitlines(), 1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        alias, _, who = line.partition(" ")
        if not who.strip() or not re.fullmatch(r"[A-Za-z0-9_-]{1,16}", alias):
            raise SystemExit(f"cohort line {n}: expected '<alias> <email or account id>'")
        entries.append((alias, who.strip()))
    if len({a for a, _ in entries}) != len(entries):
        raise SystemExit("cohort aliases must be unique")
    return entries


def cohort_rows(store, entries: list[tuple[str, str]]) -> tuple[dict, dict[str, str], list[str]]:
    """The testers' rows merged (each account's whole history), alias by account id, and aliases not found."""
    merged: dict = {k: [] for k in ROW_KINDS}
    aliases, missing, now = {}, [], None
    for alias, who in entries:
        user = store.find_user(who)
        if not user:
            missing.append(alias)
            continue
        aliases[user] = alias
        rows = store.user_rows(user)
        now = rows["now"]
        for k in ROW_KINDS:
            merged[k] += rows.get(k, [])
    merged["now"] = now or datetime.now(timezone.utc)
    return merged, aliases, missing


def cohort_people(rows: dict, aliases: dict[str, str]) -> dict[str, dict]:
    """Per alias: the launch KPIs plus sign-in, failures, app errors, estimated cost and last active day."""
    people = _launch_people(rows)
    out = {}
    for user, alias in aliases.items():
        mine = lambda kind: [r for r in rows[kind] if r.get("user_id") == user]  # noqa: E731
        events, jobs = mine("events"), mine("jobs")
        seen = [r["created_at"] for r in events + jobs]
        out[alias] = {
            **people.get(user, {"pieces": 0}),
            "signed_up": user in people,
            "signed_in": any(e["event"] == "signed_in" for e in events),
            "failed_jobs": sum(1 for j in jobs if j["status"] == "failed"),
            "app_errors": sum(1 for e in events if e["event"] == "client_error"),
            "est_ai_usd": round(sum(float(c["est_cost_usd"] or 0) for c in mine("ai_calls")), 4),
            "last_active": max(seen).date().isoformat() if seen else None,
        }
    return out


def cohort_report(rows: dict, aliases: dict[str, str], missing: list[str]) -> str:
    def mark(v, na: bool = False) -> str:
        return "n/a" if na else {True: "yes", False: "no", None: "open"}[v]
    people = cohort_people(rows, aliases)
    lines = [f"Pilot cohort: {len(aliases)} of {len(aliases) + len(missing)} testers found"
             + (f" (not found: {', '.join(missing)})" if missing else ""),
             "", *launch_report(_launch(rows)), "",
             "alias  in   1st(min) pieces 24h  3/7d 2nd-day return  failed errors  AI$     last active"]
    for alias in sorted(people):
        p = people[alias]
        first = "—" if p.get("minutes_to_first_piece") is None else f"{p['minutes_to_first_piece']:.0f}"
        no_first = p.get("minutes_to_first_piece") is None
        lines.append(f"{alias:<6} {mark(p['signed_in']):<4} {first:>8} {p['pieces']:>6} "
                     f"{mark(p.get('first_piece_24h')):<4} {mark(p.get('three_pieces_7d')):<4} "
                     f"{mark(p.get('second_import_other_day_7d'), na=no_first):<7} {mark(p.get('meaningful_return_7d')):<6} "
                     f"{p['failed_jobs']:>6} {p['app_errors']:>6}  {p['est_ai_usd']:<7.4f} {p['last_active'] or '—'}")
    lines += ["", "open = still inside its window; n/a = no first piece yet. Counts are people, not a statistic."]
    return "\n".join(lines)


def _default_store():
    import os
    from dotenv import load_dotenv
    from api.auth import load_settings
    from api.store import SupabaseStore
    load_dotenv()
    return SupabaseStore(load_settings({**os.environ, "WARDROBE_AUTH": "on"}))


def main(argv=None, store=None) -> str:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--days", type=int, default=30, help="the last N days (default 30)")
    parser.add_argument("--user", help="one account's timeline, by email or account id")
    parser.add_argument("--cohort", help="a private file (outside the repo) of '<alias> <email or id>' lines")
    parser.add_argument("--json", action="store_true", help="the numbers as JSON")
    args = parser.parse_args(argv)
    entries = read_cohort(args.cohort) if args.cohort else None
    store = store or _default_store()
    if entries is not None:
        rows, aliases, missing = cohort_rows(store, entries)
        text = json.dumps({"launch": _launch(rows), "people": cohort_people(rows, aliases), "not_found": missing},
                          indent=2, default=str) if args.json else cohort_report(rows, aliases, missing)
    elif args.user:
        user = store.find_user(args.user)
        text = timeline(store.user_rows(user)) if user else f"No account found for {args.user}"
    else:
        rows = store.usage_rows(datetime.now(timezone.utc) - timedelta(days=max(1, args.days)))
        m = metrics(rows)
        text = json.dumps(m, indent=2, default=str) if args.json else report(m)
    print(text)
    return text


if __name__ == "__main__":
    main()
