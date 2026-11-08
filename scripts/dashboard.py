"""KIPS metrics dashboard: the usage report as a live visual page, for the owner, on the Mac only.

  python -m scripts.dashboard              # http://127.0.0.1:8050, reads Supabase with the server's .env
  python -m scripts.dashboard --port 8051 --health-url http://127.0.0.1:8000/healthz

Read-only. It serves on the loopback address only (never the tunnel or the Wi-Fi) and reads the same rows as
scripts/usage_report.py (ids, kinds, numbers and times — no photos, piece details or text), plus each account's
email (shown masked), display name and wallet. The numbers in the funnel, launch, retention, reliability, AI cost
and credits sections are usage_report.metrics() over the chosen period, so the page and the report agree.
Daily buckets are UTC days, like the report; the hour-of-week heatmap is in Israel time.
"""
import argparse
import json
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from statistics import median
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

from scripts.usage_report import PAID_KINDS, ROW_KINDS, _in_closet, _pct, metrics

PAGE = Path(__file__).with_name("dashboard.html")
EPOCH = datetime(2000, 1, 1, tzinfo=timezone.utc)
LOCAL = ZoneInfo("Asia/Jerusalem")
PERIODS = {1, 7, 30, 90, 0}  # 0 = all time
FEED_LIMIT = 200
CACHE_SECONDS = 30


def mask_email(email: str | None) -> str | None:
    """ro•••@gmail.com: enough for the owner to tell testers apart, not the address."""
    if not email or "@" not in email:
        return None
    name, _, domain = email.partition("@")
    return f"{name[:2]}•••@{domain}"


def _when(row: dict, field: str = "created_at"):
    return row.get(field)


def window(rows: dict, since: datetime) -> dict:
    """The all-time rows cut to `since` the way store.usage_rows(since) would cut them."""
    out = {k: [r for r in rows[k] if (_when(r) or EPOCH) >= since] for k in ROW_KINDS if k != "removed"}
    out["removed"] = [r for r in rows["removed"] if r.get("deleted_at") and r["deleted_at"] >= since]
    out["now"] = rows["now"]
    return out


def _days(since: datetime, now: datetime) -> list:
    first, last = since.date(), now.date()
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def _active_by_day(rows: dict) -> dict:
    out: dict = {}
    for r in rows["events"] + rows["jobs"] + [e for e in rows["ledger"] if e["kind"] in ("hold", "charge")]:
        if r.get("user_id"):
            out.setdefault(r["created_at"].date(), set()).add(r["user_id"])
    return out


def _usd(rows) -> float:
    return round(sum(float(c.get("est_cost_usd") or 0) for c in rows), 6)


def daily(rows: dict, since: datetime) -> list[dict]:
    """One entry per UTC day from `since` to now (rows already cut to the period)."""
    days = _days(since, rows["now"])
    out = {d: {"day": d.isoformat(), "signups": 0, "active": 0, "events": 0, "app_opens": 0, "pieces": 0,
               "jobs_ok": 0, "jobs_failed": 0, "jobs_by_kind": {}, "ai_usd": 0.0, "ai_usd_by_kind": {},
               "credits_charged": 0, "credits_granted": 0, "app_errors": 0} for d in days}

    def at(r, field="created_at"):
        return out.get(r[field].date()) if r.get(field) else None
    for s in rows["signups"]:
        if (d := at(s)):
            d["signups"] += 1
    for day, users in _active_by_day(rows).items():
        if day in out:
            out[day]["active"] = len(users)
    for e in rows["events"]:
        if (d := at(e)):
            d["events"] += 1
            d["app_opens"] += e["event"] == "app_opened"
            d["app_errors"] += e["event"] == "client_error"
    for i in rows["items"]:
        if _in_closet(i) and (d := at(i)):
            d["pieces"] += 1
    for j in rows["jobs"]:
        if (d := at(j)):
            d["jobs_by_kind"][j["kind"]] = d["jobs_by_kind"].get(j["kind"], 0) + 1
            d["jobs_ok"] += j["status"] == "succeeded"
            d["jobs_failed"] += j["status"] == "failed"
    for c in rows["ai_calls"]:
        if (d := at(c)):
            usd, kind = float(c.get("est_cost_usd") or 0), c.get("job_kind") or "unknown"
            d["ai_usd"] = round(d["ai_usd"] + usd, 6)
            d["ai_usd_by_kind"][kind] = round(d["ai_usd_by_kind"].get(kind, 0) + usd, 6)
    for e in rows["ledger"]:
        if (d := at(e)):
            if e["kind"] == "charge":
                d["credits_charged"] += e["amount"]
            elif e["kind"] == "grant":
                d["credits_granted"] += e["amount"]
    return [out[d] for d in days]


def ai_breakdown(calls: list[dict]) -> dict:
    """Calls, failures, estimated USD and latency per model and per pipeline stage."""
    def group(key):
        out: dict = {}
        for c in calls:
            out.setdefault(c.get(key) or "unknown", []).append(c)
        return {name: {"calls": len(cs), "failed": sum(1 for c in cs if c.get("status") == "error"),
                       "fallback": sum(1 for c in cs if c.get("fallback")), "usd": _usd(cs),
                       "p50_ms": median(ms) if (ms := [c["latency_ms"] for c in cs if c.get("latency_ms") is not None]) else None,
                       "p95_ms": _pct(ms, 0.95)}
                for name, cs in sorted(out.items(), key=lambda kv: -_usd(kv[1]))}
    return {"by_model": group("model"), "by_stage": group("stage")}


def events_breakdown(events: list[dict]) -> dict:
    def tally(values) -> dict:
        out: dict = {}
        for v in values:
            out[v] = out.get(v, 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))
    heat = [[0] * 24 for _ in range(7)]  # Monday first, Israel time
    for e in events:
        local = e["created_at"].astimezone(LOCAL)
        heat[local.weekday()][local.hour] += 1
    latest: dict = {}
    for e in sorted(events, key=lambda e: e["created_at"]):
        if e.get("app_version") and e.get("user_id"):
            latest[e["user_id"]] = e["app_version"]
    return {
        "by_name": tally(e["event"] for e in events),
        "by_source": tally(e.get("source") or "app" for e in events),
        "screens": tally((e.get("props") or {}).get("screen", "unknown") for e in events if e["event"] == "screen_viewed"),
        "sessions": len({e["session_id"] for e in events if e.get("session_id")}),
        "app_versions": tally(latest.values()),
        "heatmap": heat,
    }


def accounts_table(all_rows: dict, period: dict, accounts: list[dict]) -> list[dict]:
    """Per account: all-time closet, credits and cost, plus what it did in the period. Email masked."""
    def mine(rows, kind, user):
        return [r for r in rows[kind] if r.get("user_id") == user]
    active = _active_by_day(all_rows)
    out = []
    for a in accounts:
        user = a["id"]
        jobs, events = mine(all_rows, "jobs", user), mine(all_rows, "events", user)
        ledger = mine(all_rows, "ledger", user)
        seen = [r["created_at"] for r in jobs + events + ledger]
        versions = [e["app_version"] for e in sorted(events, key=lambda e: e["created_at"]) if e.get("app_version")]
        out.append({
            "id": user, "short_id": user[:8], "email": mask_email(a.get("email")), "name": a.get("display_name"),
            "signed_up": a["created_at"].isoformat() if a.get("created_at") else None,
            "last_active": max(seen).isoformat() if seen else None,
            "active_days": sum(1 for users in active.values() if user in users),
            "pieces": sum(1 for i in mine(all_rows, "items", user) if _in_closet(i) and not i.get("deleted_at")),
            "removed": len(mine(all_rows, "removed", user)),
            "jobs": len(jobs), "paid_jobs": sum(1 for j in jobs if j["kind"] in PAID_KINDS),
            "failed_jobs": sum(1 for j in jobs if j["status"] == "failed"),
            "period_jobs": len(mine(period, "jobs", user)), "period_events": len(mine(period, "events", user)),
            "app_errors": sum(1 for e in events if e["event"] == "client_error"),
            "balance": a.get("balance", 0), "held": a.get("held", 0),
            "granted": sum(e["amount"] for e in ledger if e["kind"] == "grant"),
            "charged": sum(e["amount"] for e in ledger if e["kind"] == "charge"),
            "ai_usd": _usd(mine(all_rows, "ai_calls", user)),
            "app_version": versions[-1] if versions else None,
        })
    return sorted(out, key=lambda r: r["last_active"] or "", reverse=True)


def feed(rows: dict, labels: dict[str, str]) -> list[dict]:
    """The period's newest happenings across accounts: events, jobs, credits and pieces. No piece details."""
    entries = []

    def add(at, user, kind, what, detail=None):
        if at:
            entries.append({"at": at.isoformat(), "who": labels.get(user, (user or "—")[:8]), "kind": kind,
                            "what": what, "detail": detail or {}})
    for s in rows["signups"]:
        add(s["created_at"], s["user_id"], "account", "signed_up")
    for e in rows["events"]:
        add(e["created_at"], e["user_id"], "error" if e["event"] == "client_error" else e.get("source") or "app",
            e["event"], e.get("props"))
    for j in rows["jobs"]:
        add(j["created_at"], j["user_id"], "job", f"{j['kind']} started", {"job": (j.get("id") or "")[:8]})
        if j.get("finished_at"):
            secs = round((j["finished_at"] - j["created_at"]).total_seconds())
            add(j["finished_at"], j["user_id"], "error" if j["status"] == "failed" else "job", f"{j['kind']} {j['status']}",
                {"seconds": secs, "job": (j.get("id") or "")[:8], **({"failure": j["failure_code"]} if j.get("failure_code") else {})})
    for e in rows["ledger"]:
        add(e["created_at"], e["user_id"], "credits", f"credits {e['kind']}",
            {"amount": e["amount"], **({"action": e["action"]} if e.get("action") else {})})
    for i in rows["items"]:
        if _in_closet(i):
            add(i["created_at"], i["user_id"], "piece", "piece saved", {"origin": i.get("origin") or "garment_photo"})
    return sorted(entries, key=lambda e: e["at"], reverse=True)[:FEED_LIMIT]


def build(all_rows: dict, accounts: list[dict], days: int, health: dict | None = None) -> dict:
    """Everything the page draws, for the last `days` days (0 = all time)."""
    now = all_rows["now"]
    since = now - timedelta(days=days) if days else min(
        [r["created_at"] for k in ("signups", "events", "jobs") for r in all_rows[k]] or [now])
    since = since.replace(hour=0, minute=0, second=0, microsecond=0) if not days else since
    period = window(all_rows, since)
    m = metrics(period)
    active = _active_by_day(all_rows)

    def active_within(n: int) -> int:
        return len(set().union(*[users for day, users in active.items() if day > now.date() - timedelta(days=n)] or [set()]))
    labels = {a["id"]: a.get("display_name") or mask_email(a.get("email")) or a["id"][:8] for a in accounts}
    jobs = period["jobs"]
    done = [j for j in jobs if j["status"] in ("succeeded", "failed")]
    live = [j for j in all_rows["jobs"] if j["status"] in ("queued", "running")]
    return {
        "generated_at": now.isoformat(), "days": days, "since": since.isoformat(),
        "kpis": {
            "accounts": len(accounts), "new_accounts": len(period["signups"]),
            "active_today": active_within(1), "active_7d": active_within(7), "active_30d": active_within(30),
            "pieces": sum(1 for i in period["items"] if _in_closet(i)),
            "jobs": len(jobs), "paid_jobs": sum(1 for j in jobs if j["kind"] in PAID_KINDS),
            "success_rate": round(sum(1 for j in done if j["status"] == "succeeded") / len(done), 3) if done else None,
            "ai_usd": m["ai_cost"]["total_usd"], "ai_calls": m["ai_cost"]["calls"],
            "credits_charged": m["credits"]["charged"], "credits_granted": m["credits"]["granted"],
            "credits_outstanding": sum(a.get("balance", 0) for a in accounts),
            "credits_held": sum(a.get("held", 0) for a in accounts),
            "app_errors": sum(1 for e in period["events"] if e["event"] == "client_error"),
            "jobs_live": len(live),
        },
        "daily": daily(period, since),
        "metrics": m,
        "ai": ai_breakdown(period["ai_calls"]),
        "events": events_breakdown(period["events"]),
        "accounts": accounts_table(all_rows, period, accounts),
        "feed": feed(period, labels),
        "live_jobs": [{"kind": j["kind"], "status": j["status"], "who": labels.get(j["user_id"], j["user_id"][:8]),
                       "since": j["created_at"].isoformat()} for j in live],
        "health": health,
    }


def fetch_health(url: str | None) -> dict | None:
    if not url:
        return None
    import httpx
    try:
        r = httpx.get(url, timeout=2)
        return {"reachable": True, "http_status": r.status_code, **(r.json() if r.status_code == 200 else {})}
    except Exception as e:  # the API being down is a reading, not a dashboard error
        return {"reachable": False, "error": type(e).__name__}


class Source:
    """All-time rows and accounts from the store, cached briefly so a refresh storm stays one query."""
    def __init__(self, store, health_url: str | None):
        self.store, self.health_url, self.lock = store, health_url, threading.Lock()
        self.cached: tuple[float, dict, list] | None = None

    def data(self, days: int, fresh: bool = False) -> dict:
        with self.lock:
            if fresh or not self.cached or time.monotonic() - self.cached[0] > CACHE_SECONDS:
                self.cached = (time.monotonic(), self.store.usage_rows(EPOCH), self.store.accounts_overview())
            _, rows, accounts = self.cached
        return build(rows, accounts, days, fetch_health(self.health_url))


def handler_for(source: Source):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status: int, body: bytes, kind: str):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):  # noqa: N802
            url = urlparse(self.path)
            if url.path in ("/", "/index.html"):
                return self._send(200, PAGE.read_bytes(), "text/html; charset=utf-8")
            if url.path == "/api/dashboard":
                q = parse_qs(url.query)
                try:
                    days = int(q.get("days", ["30"])[0])
                except ValueError:
                    days = -1
                if days not in PERIODS:
                    return self._send(400, b'{"error": "days must be 1, 7, 30, 90 or 0"}', "application/json")
                try:
                    data = source.data(days, fresh=q.get("fresh") == ["1"])
                except Exception as e:  # show why on the page; never echo the store's headers
                    body = json.dumps({"error": type(e).__name__, "detail": str(e)[:300]}).encode()
                    return self._send(502, body, "application/json")
                return self._send(200, json.dumps(data, default=str).encode(), "application/json")
            self._send(404, b"not found", "text/plain")

        def log_message(self, *args):  # quiet: no request lines in the terminal
            pass
    return Handler


def main(argv=None, store=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8050)
    parser.add_argument("--health-url", default="http://127.0.0.1:8000/healthz",
                        help="the API's /healthz for the live status strip ('' to skip)")
    args = parser.parse_args(argv)
    if store is None:
        from scripts.usage_report import _default_store
        store = _default_store()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(Source(store, args.health_url or None)))
    print(f"KIPS dashboard on http://127.0.0.1:{args.port} (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
