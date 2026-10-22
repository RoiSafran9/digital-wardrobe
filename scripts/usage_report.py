"""KIPS usage report: how the beta is going, and what one account did. Admin only, read-only, on the server.

Reads the real tables (profiles, generation_jobs, credit_ledger, wardrobe_items) plus activity_events and
ai_calls — ids, kinds, numbers and times only; never photos, piece details or text. The same numbers are
in the reports.* views for the Supabase SQL editor.

  Funnel        sign-ups → signed in → onboarding → first scan → first paid image → first piece → 3 pieces
                → came back with a piece (an item SECOND_IMPORT_GAP_MINUTES after the first)
  Activation    the First 3 Pieces numbers (scripts/activation_report.py)
  Retention     accounts active (an event, a job or a credit hold/charge) on day 1, on days 6–8 and 8–14
                after their sign-up day (UTC), among those old enough; weekly active accounts
  Features      accounts and counts per feature; cost-sheet cancel rate per action
  Reliability   jobs per kind: success, failure codes, p50/p95 queued→finished seconds; refusals; app errors
  AI cost       estimated USD (pipeline/costs.py): total, per job kind, per account, per credit charged,
                share on the fallback image model, share spent on retries
  Credits       granted, charged and released (credit_ledger)

Usage (repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set, e.g. in .env):
  python -m scripts.usage_report                 # the last 30 days
  python -m scripts.usage_report --days 7 --json
  python -m scripts.usage_report --user tester@example.com   # one account's timeline (email or id)
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
from statistics import median
from scripts.activation_report import SECOND_IMPORT_GAP_MINUTES, metrics as activation_metrics

SCAN_KINDS = {"garment_scan", "outfit_scan"}
PAID_KINDS = {"garment", "back", "turn", "outfit_generate", "outfit_regenerate"}
FEATURES = {"garment_photo": "garment", "outfit_photo": "outfit_generate", "outfit_regenerate": "outfit_regenerate",
            "back": "back", "turn": "turn"}
EVENT_FEATURES = {"edits": "item_edited", "outfit_kept": "item_kept", "missed_garments_marked": "region_added"}


def _in_closet(item: dict) -> bool:
    return item.get("review_state") in (None, "kept")


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
    for i in rows["items"]:
        if i["user_id"] in users and _in_closet(i):
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
    lines = ["Funnel (sign-ups in the period):", *[f"  {k:<24} {v}" for k, v in m["funnel"].items()],
             "", "Activation (First 3 Pieces):", *["  " + line for line in activation_report(m["activation"]).splitlines()],
             "", "Retention:",
             *[f"  {name:<4} {rate(r[name]['rate'])} ({r[name]['returned']} of {r[name]['eligible']})" for name in ("d1", "d7", "w2")],
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


def timeline(rows: dict) -> str:
    """One account's history, oldest first: sign-up, events, jobs, credits, pieces. No piece details."""
    entries = [(s["created_at"], 0, "signed up") for s in rows["signups"]]
    for e in rows["events"]:
        props = " ".join(f"{k}={v}" for k, v in sorted((e.get("props") or {}).items()))
        entries.append((e["created_at"], 1, f"{e['source']:<6} {e['event']} {props}".rstrip()))
    for j in rows["jobs"]:
        entries.append((j["created_at"], 1, f"server {j['kind']} job started" + (f" · {j['cost_credits']} credits" if j.get("cost_credits") else "")))
        if j.get("finished_at"):
            secs = round((j["finished_at"] - j["created_at"]).total_seconds())
            why = f" ({j['failure_code']})" if j.get("failure_code") else ""
            entries.append((j["finished_at"], 1, f"server {j['kind']} job {j['status']}{why} after {secs}s"))
    for e in rows["ledger"]:
        entries.append((e["created_at"], 1, f"credits {e['kind']} {e['amount']}" + (f" ({e['action']})" if e.get("action") else "")))
    for i in rows["items"]:
        entries.append((i["created_at"], 1, f"server piece created ({i.get('origin') or 'garment_photo'}"
                                            + (f", {i['review_state']}" if i.get("review_state") else "") + ")"))
    for i in rows.get("removed", []):
        entries.append((i["deleted_at"], 1, "server piece removed"))
    spent = sum(float(c["est_cost_usd"] or 0) for c in rows.get("ai_calls", []))
    lines = [f"{at:%Y-%m-%d %H:%M:%S}  {text}" for at, _, text in sorted(entries, key=lambda e: (e[0], e[1]))]
    lines.append(f"AI cost for this account (estimated): ${spent:.4f} over {len(rows.get('ai_calls', []))} calls")
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
    parser.add_argument("--json", action="store_true", help="the numbers as JSON")
    args = parser.parse_args(argv)
    store = store or _default_store()
    if args.user:
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
