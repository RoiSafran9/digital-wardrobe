"""scripts/health_check.py: a 200 is not healthy by itself; each part is judged apart (first-five M3)."""
import json
import pytest
from scripts.health_check import Thresholds, check, evaluate, fetch, level_of, main

HEALTHY = {"status": "ok", "generation": True, "queued": 0, "oldest_queued_seconds": None,
           "worker_seconds_since_beat": 1.2, "jobs_running": 0, "ai_jobs_today": 4, "daily_ai_jobs_cap": 100,
           "failed_jobs_last_hour": 0, "image_model": "gemini-x"}


def answer(**changes):
    return 200, json.dumps({**HEALTHY, **changes}), None


def codes(*args):
    return [f.code for f in evaluate(*args)]


def test_healthy():
    [f] = evaluate(*answer())
    assert (f.level, f.code) == ("ok", "healthy") and "1s ago" in f.message


def test_a_200_with_a_stalled_worker_is_critical():
    findings = evaluate(*answer(worker_seconds_since_beat=400, queued=2, oldest_queued_seconds=700))
    assert level_of(findings) == "critical"
    assert [f.code for f in findings][:2] == ["worker_stalled", "queue_stalled"]


def test_a_worker_busy_with_a_long_job_is_not_stalled_until_it_is_stuck():
    assert codes(*answer(worker_seconds_since_beat=400, jobs_running=1)) == ["healthy"]
    assert codes(*answer(worker_seconds_since_beat=1000, jobs_running=1)) == ["worker_stuck"]


def test_a_worker_that_never_started():
    assert codes(*answer(worker_seconds_since_beat=None)) == ["worker_not_started"]


def test_an_older_server_without_jobs_running_is_judged_by_the_heartbeat():
    body = {k: v for k, v in HEALTHY.items() if k != "jobs_running"}
    assert codes(200, json.dumps({**body, "worker_seconds_since_beat": 500}), None) == ["worker_stalled"]


@pytest.mark.parametrize("oldest, code, level", [(60, "healthy", "ok"), (200, "queue_slow", "warn"),
                                                 (700, "queue_stalled", "critical")])
def test_queue_age(oldest, code, level):
    findings = evaluate(*answer(queued=1, oldest_queued_seconds=oldest))
    assert (findings[0].code, level_of(findings)) == (code, level)


@pytest.mark.parametrize("failed, level", [(2, "ok"), (3, "warn"), (5, "critical")])
def test_failures_in_the_last_hour(failed, level):
    assert level_of(evaluate(*answer(failed_jobs_last_hour=failed))) == level


def test_budget_and_kill_switch():
    assert codes(*answer(ai_jobs_today=85)) == ["budget_near"]
    assert codes(*answer(ai_jobs_today=100)) == ["budget_used"]
    assert codes(*answer(daily_ai_jobs_cap=None, ai_jobs_today=10_000)) == ["healthy"]
    assert codes(*answer(generation=False)) == ["generation_off"]


@pytest.mark.parametrize("args, code", [
    ((None, None, "timeout"), "api_unreachable"),
    ((None, None, "ConnectionRefusedError"), "api_unreachable"),
    ((502, None, None), "api_http_error"),
    ((200, "<html>Cloudflare error</html>", None), "api_bad_json"),
    ((200, "[1, 2]", None), "api_bad_json"),
    ((200, json.dumps({"status": "starting"}), None), "api_not_ok"),
])
def test_unreachable_errors_and_garbage_are_critical(args, code):
    findings = evaluate(*args)
    assert [f.code for f in findings] == [code] and level_of(findings) == "critical"


def test_local_mode_is_a_warning():
    assert codes(200, json.dumps({"status": "ok", "mode": "local"}), None) == ["local_mode"]


def test_thresholds_can_be_tightened():
    assert codes(*answer(worker_seconds_since_beat=40), Thresholds(stale_beat=30)) == ["worker_stalled"]


def _fetcher(answers):
    return lambda url, timeout: answers[url]


LOCAL, PUBLIC = "http://127.0.0.1:8000/healthz", "https://api.kipscloset.com/healthz"


def test_local_up_public_down_points_at_the_tunnel():
    result = check([LOCAL, PUBLIC], 5, Thresholds(), _fetcher({LOCAL: answer(), PUBLIC: (None, None, "timeout")}))
    assert result["level"] == "critical" and "Tunnel" in result["diagnosis"]


def test_both_down_points_at_the_api_or_the_mac():
    down = (None, None, "ConnectionRefusedError")
    result = check([LOCAL, PUBLIC], 5, Thresholds(), _fetcher({LOCAL: down, PUBLIC: (530, None, None)}))
    assert "launchd" in result["diagnosis"]


def test_main_exit_codes_json_and_the_alert_hook(capsys):
    ran = []
    runner = lambda cmd, **kw: ran.append((cmd, json.loads(kw["input"])["level"]))  # noqa: E731
    assert main(["--url", LOCAL], fetcher=_fetcher({LOCAL: answer()}), runner=runner) == 0
    assert ran == []
    assert main(["--url", LOCAL, "--json", "--on-alert", "notify-me"],
                fetcher=_fetcher({LOCAL: answer(failed_jobs_last_hour=3)}), runner=runner) == 1
    assert ran == [("notify-me", "warn")]
    out = capsys.readouterr().out
    assert '"code": "job_failures"' in out
    assert main(["--url", LOCAL, "--stale-beat", "0.5"], fetcher=_fetcher({LOCAL: answer()}), runner=runner) == 2


def test_a_broken_alert_hook_never_hides_the_result(capsys):
    def runner(cmd, **kw):
        raise OSError("no such command")
    assert main(["--url", LOCAL], fetcher=_fetcher({LOCAL: (None, None, "timeout")}), runner=runner) == 2  # no hook given
    assert main(["--url", LOCAL, "--on-alert", "x"], fetcher=_fetcher({LOCAL: (None, None, "timeout")}), runner=runner) == 2
    assert "on-alert command failed" in capsys.readouterr().err


def test_fetch_reports_a_refused_connection_without_raising():
    status, body, error = fetch("http://127.0.0.1:9/healthz", 1)  # the discard port: nothing listens
    assert status is None and body is None and error


def test_fetch_reads_a_real_health_answer():
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            data = json.dumps(HEALTHY).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *args):
            pass
    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.handle_request, daemon=True).start()
    try:
        status, body, error = fetch(f"http://127.0.0.1:{server.server_port}/healthz", 5)
    finally:
        server.server_close()
    assert (status, error) == (200, None) and json.loads(body)["status"] == "ok"
