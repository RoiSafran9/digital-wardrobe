"""Is the KIPS server healthy — not just answering? Read-only: one GET /healthz per URL, nothing else.

HTTP 200 alone is not healthy: the in-process worker can be stalled while the API answers. This reads the
health JSON (api/routes/health.py) and judges each part apart (docs/beta/first-five-mac/04 §2.4, 06):

  api           unreachable, timed out, non-200, not JSON, or status != ok           → critical
  worker        never started (no heartbeat); heartbeat older than --stale-beat with no job running
                (stalled); a job running longer than --stuck-job (stuck)              → critical
  queue         oldest queued job older than --queue-warn → warn, --queue-critical → critical
  failures      failed jobs in the last hour ≥ --failures-warn → warn, ≥ --failures-critical → critical
  budget        AI jobs today at 80 % of the daily cap → warn, at the cap → critical (new AI work refused)
  generation    the WARDROBE_GENERATION kill switch is off → warn (intended during an incident)

With a local and a public URL, "local ok, public down" is reported as the tunnel/network, not the API.
It never restarts, edits or signs in to anything, and it sends nothing anywhere unless you pass --on-alert
(your own command; it gets the JSON result on stdin). A check that runs only on the Mac cannot see the Mac
asleep or offline — run the public check from another network too (06-MAC-OPERATIONS-RUNBOOK.md).

Usage (repo root):
  python -m scripts.health_check                                   # http://127.0.0.1:8000/healthz
  python -m scripts.health_check --url http://127.0.0.1:8000/healthz --url https://api.kipscloset.com/healthz
  python -m scripts.health_check --json                            # for a script or a monitor
Exit code: 0 ok, 1 warning, 2 critical.
"""
import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass

LOCAL_URL = "http://127.0.0.1:8000/healthz"
LEVELS = {"ok": 0, "warn": 1, "critical": 2}


@dataclass
class Thresholds:
    stale_beat: float = 180.0     # s without a worker loop turn, no job running: stalled
    stuck_job: float = 900.0      # s without a turn while a job runs (past the 600 s lease): stuck
    queue_warn: float = 120.0     # s the oldest queued job has waited
    queue_critical: float = 600.0
    failures_warn: int = 3        # failed jobs in the last hour
    failures_critical: int = 5
    budget_warn: float = 0.8      # share of the daily AI job cap used


@dataclass
class Finding:
    level: str
    code: str
    message: str


def fetch(url: str, timeout: float) -> tuple[int | None, str | None, str | None]:
    """(HTTP status, body, error) — error is a short class name, never a header or a body."""
    request = urllib.request.Request(url, headers={"User-Agent": "kips-health-check", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(65536).decode("utf-8", "replace"), None
    except urllib.error.HTTPError as e:
        return e.code, None, None
    except (TimeoutError, urllib.error.URLError, OSError) as e:
        reason = getattr(e, "reason", e)
        return None, None, "timeout" if "timed out" in str(reason) else type(reason).__name__


def evaluate(status: int | None, body: str | None, error: str | None, t: Thresholds = Thresholds()) -> list[Finding]:
    """The findings for one /healthz answer, worst first. [] never: a healthy answer gives one 'ok'."""
    if error:
        return [Finding("critical", "api_unreachable", f"no answer ({error})")]
    if status != 200:
        return [Finding("critical", "api_http_error", f"HTTP {status}")]
    try:
        h = json.loads(body or "")
        if not isinstance(h, dict):
            raise ValueError
    except ValueError:
        return [Finding("critical", "api_bad_json", "the answer is not health JSON")]
    if h.get("status") != "ok":
        return [Finding("critical", "api_not_ok", f"status {h.get('status')!r}")]
    if h.get("mode") == "local":
        return [Finding("warn", "local_mode", "the server is in local mode (no accounts, no worker)")]

    found: list[Finding] = []
    beat, running = h.get("worker_seconds_since_beat"), h.get("jobs_running") or 0
    if beat is None:
        found.append(Finding("critical", "worker_not_started", "the worker has no heartbeat"))
    elif running and beat > t.stuck_job:
        found.append(Finding("critical", "worker_stuck", f"a job has run {beat:.0f}s without the worker loop turning"))
    elif not running and beat > t.stale_beat:
        found.append(Finding("critical", "worker_stalled", f"heartbeat {beat:.0f}s old with no job running"))

    queued, oldest = h.get("queued") or 0, h.get("oldest_queued_seconds")
    if queued and oldest is not None:
        if oldest >= t.queue_critical:
            found.append(Finding("critical", "queue_stalled", f"{queued} queued, oldest {oldest:.0f}s"))
        elif oldest >= t.queue_warn:
            found.append(Finding("warn", "queue_slow", f"{queued} queued, oldest {oldest:.0f}s"))

    failed = h.get("failed_jobs_last_hour") or 0
    if failed >= t.failures_critical:
        found.append(Finding("critical", "job_failures", f"{failed} failed jobs in the last hour"))
    elif failed >= t.failures_warn:
        found.append(Finding("warn", "job_failures", f"{failed} failed jobs in the last hour"))

    cap, today = h.get("daily_ai_jobs_cap"), h.get("ai_jobs_today") or 0
    if cap:
        if today >= cap:
            found.append(Finding("critical", "budget_used", f"daily AI job cap reached ({today} of {cap})"))
        elif today >= t.budget_warn * cap:
            found.append(Finding("warn", "budget_near", f"{today} of {cap} daily AI jobs used"))

    if h.get("generation") is False:
        found.append(Finding("warn", "generation_off", "new AI generation is switched off (WARDROBE_GENERATION)"))

    if not found:
        detail = f"worker beat {beat:.0f}s ago, {running} running, {queued} queued, {failed} failed in the last hour"
        found.append(Finding("ok", "healthy", detail))
    return sorted(found, key=lambda f: -LEVELS[f.level])


def level_of(findings: list[Finding]) -> str:
    return max((f.level for f in findings), key=LEVELS.__getitem__, default="ok")


def check(urls: list[str], timeout: float, t: Thresholds, fetcher=fetch) -> dict:
    targets = []
    for url in urls:
        findings = evaluate(*fetcher(url, timeout), t)
        targets.append({"url": url, "level": level_of(findings), "findings": [asdict(f) for f in findings]})
    diagnosis = None
    local = [x for x in targets if "127.0.0.1" in x["url"] or "localhost" in x["url"]]
    public = [x for x in targets if x not in local]
    down = lambda x: any(f["code"] in ("api_unreachable", "api_http_error") for f in x["findings"])  # noqa: E731
    if local and public and not down(local[0]) and down(public[0]):
        diagnosis = "local API answers but the public URL does not: Cloudflare Tunnel, DNS or the Mac's network"
    elif local and public and down(local[0]) and down(public[0]):
        diagnosis = "neither answers: the API process (launchd) or the Mac itself"
    return {"level": max((x["level"] for x in targets), key=LEVELS.__getitem__, default="ok"),
            "diagnosis": diagnosis, "targets": targets}


def report(result: dict) -> str:
    lines = []
    for x in result["targets"]:
        lines.append(f"{x['level'].upper():<8} {x['url']}")
        lines += [f"  {f['level']:<8} {f['code']}: {f['message']}" for f in x["findings"]]
    if result["diagnosis"]:
        lines.append(f"→ {result['diagnosis']}")
    return "\n".join(lines)


def main(argv=None, fetcher=fetch, runner=subprocess.run) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", action="append", help=f"a /healthz URL; repeat for local and public (default {LOCAL_URL})")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--on-alert", help="a command to run when the result is not ok (JSON result on stdin)")
    for name, value in asdict(Thresholds()).items():
        parser.add_argument(f"--{name.replace('_', '-')}", type=type(value), default=value)
    args = parser.parse_args(argv)
    t = Thresholds(**{name: getattr(args, name) for name in asdict(Thresholds())})
    result = check(args.url or [LOCAL_URL], args.timeout, t, fetcher)
    print(json.dumps(result, indent=2) if args.json else report(result))
    if args.on_alert and result["level"] != "ok":
        try:
            runner(args.on_alert, shell=True, input=json.dumps(result), text=True, timeout=30, check=False)
        except Exception as e:  # an alert hook that fails must not hide the result
            print(f"on-alert command failed: {type(e).__name__}", file=sys.stderr)
    return LEVELS[result["level"]]


if __name__ == "__main__":
    sys.exit(main())
