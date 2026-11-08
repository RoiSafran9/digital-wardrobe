# Mac Operations Runbook — KIPS first five testers

**Pilot architecture:** TestFlight iPhones → `https://api.kipscloset.com` → Cloudflare Tunnel **on Mac** → FastAPI & in-process AI Worker **on Mac** → Supabase Auth/Postgres/private Storage + Gemini API. No cloud backend migration.

**For owner only.** No credentials, secrets, personal user data or private tunnel tokens belong in GitHub. All commands below are suggestions to verify *on your Mac*; this document is not evidence they were executed. Run potentially disruptive commands only during an agreed maintenance window. Test with a consenting QA account, not a stranger's personal garments.

## Before every pilot session: 5-minute preflight

1. Plug Mac into power; check that it stays awake while idle and remains online. macOS power-saving behavior must be verified in the actual host configuration. Keep local screen lock enabled.
2. Confirm FastAPI launch agent is loaded/running; the README documents label `com.kipscloset.api`. The tunnel's launchd label is **not established by the docs**: discover it instead of guessing.
3. Validate local API and external tunnel separately and inspect worker state.
4. Confirm available disk space, log rotation, AI cost/rate guard and the launch's feature flags.
5. Execute one authorized QA test: OTP → create item → see Closet from a **different network**. Check the report gets its user/action events.
6. Confirm a way for testers to contact you if the Mac is offline; keep notes of planned availability windows.

### Tools in the repo (read-only; added for the first five)

```bash
# Everything below in one pass: launchd state of the API agent (never its environment), the Cloudflare
# launchd job and a cloudflared process count (never its arguments), local + public health, AC power and
# sleep, default route, free disk, log size and today's ERROR / failed-job / 5xx counts. Exit 0/1/2.
scripts/mac_preflight.sh
```

```bash
# Health judged part by part; exit 0 ok, 1 warning, 2 critical.
python -m scripts.health_check --url http://127.0.0.1:8000/healthz --url https://api.kipscloset.com/healthz
```

| health_check code | Meaning | Default threshold |
|---|---|---|
| `api_unreachable` / `api_http_error` / `api_bad_json` / `api_not_ok` | The URL did not give healthy JSON (a Cloudflare error page is `api_bad_json` or `api_http_error`) | — |
| `worker_not_started` | No heartbeat yet | — |
| `worker_stalled` | Heartbeat older than `--stale-beat` with no job running | 180 s |
| `worker_stuck` | A job running and no heartbeat for `--stuck-job` (past the 600 s lease) | 900 s |
| `queue_slow` / `queue_stalled` | Oldest queued job older than `--queue-warn` / `--queue-critical` | 120 s / 600 s |
| `job_failures` | Failed jobs in the last hour ≥ `--failures-warn` / `--failures-critical` | 3 / 5 |
| `budget_near` / `budget_used` | `WARDROBE_DAILY_AI_JOBS` 80 % used / reached (new AI work refused) | 80 % |
| `generation_off` | `WARDROBE_GENERATION=off` (expected during an incident) | — |

With both URLs, "local ok, public down" prints `→ … Cloudflare Tunnel, DNS or the Mac's network`; both down prints `→ … the API process (launchd) or the Mac itself`. Thresholds are proposals for five testers, not tuned on real traffic; `jobs_running` exists only once the server runs this branch (an older server is judged by the heartbeat alone).

**Read-only audit on 2026-11-02 (this Mac):** API agent `com.kipscloset.api` running; one listener on :8000; a user launchd job `com.cloudflare.cloudflared` with one `cloudflared` process (confirm it is the `api.kipscloset.com` tunnel); local and public `/healthz` healthy; **on battery (46 %)**; idle sleep held off by an assertion while `pmset sleep` is 1 min; 604 GB free; logs 1.3 MB. Today's log had 21 ERROR lines, all the worker's Supabase calls (`httpx.RemoteProtocolError` / `ReadTimeout` in the worker loop, credit reconcile and storage sweep) — the loop recovered, but watch for it recurring.

**Alerts without a vendor:** `--on-alert '<your command>'` runs only when the result is not ok and gets the JSON result on stdin; e.g. a local notification while you are at the Mac: `--on-alert "osascript -e 'display notification \"KIPS health\" with title \"KIPS\"'"`. To run it every 5 minutes you could add your own launchd agent (owner action; nothing is installed by the repo). A check on the Mac cannot report the Mac asleep, offline or without power: until an off-Mac uptime monitor is approved, open `https://api.kipscloset.com/healthz` from a phone on cellular at the start of each pilot window and once mid-day, and treat 24/7 detection as **not available**.

### Following one failure (request → job → model calls)

1. From the tester (with consent): approximate time. From `python -m scripts.usage_report --user <email or id>`: the `client_error … request_id=<32 hex>` line and/or the `[job <id>]` on the job lines.
2. Server log for the request: `grep <request_id> logs/server.jsonl*` → the `request` line (route template, status, ms) and, if it queued work, `job queued` / `job reused` with `job_id`. A `request_id` from the phone that is **not** in the log means the call never reached the Mac (network, tunnel or Mac down) — record it as such. Its `status` tells which: 502/530 (and the usage report's `http_5xx by status` line) mean Cloudflare answered because the Mac was asleep or the tunnel was reconnecting; a 500 the server log doesn't have is unexpected.
3. Worker for the job: `grep <job_id> logs/server.jsonl*` → `job claimed` (attempt, seconds since created), `job will retry` (failure code, ms), `job finished` (outcome, failure code, ms, `ai_calls`, `est_cost_usd`), plus any traceback (redacted).
4. Cost per model call: the `ai_calls` rows with that `job_id` (Supabase SQL editor, or the timeline's AI cost line).
5. Never paste raw log lines into a public issue: they carry the account id. Summarise operation, build, failure code, timings and redacted ids.

### Safe example commands on the Mac

```bash
# Local agent metadata; no secrets expected, but inspect output before sharing.
launchctl print "gui/$(id -u)/com.kipscloset.api"

# Discover actual tunnel/Cloudflare agent label; DO NOT assume a label.
launchctl list | grep -i cloudflare

# Local API (assumes existing documented port 8000; verify actual binding).
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8000/healthz

# Public URL — also run from a separate off-Mac network/device.
curl --fail --silent --show-error --max-time 15 https://api.kipscloset.com/healthz

# Free disk space and current local time.
df -h .
date

# Existing read-only usage summary; run only on your authorized configured server environment.
python -m scripts.usage_report --days 7

# The same numbers as a live visual page on this Mac only (loopback): open http://127.0.0.1:8050
python -m scripts.dashboard
```

**Interpretation:** `status: ok` alone is insufficient. Inspect `generation`, `queued`, `oldest_queued_seconds`, `worker_seconds_since_beat`, `failed_jobs_last_hour` and `daily_ai_jobs_cap` if present. If worker heartbeat is null, check whether worker has started; if queue >0 and heartbeat stale, classify unhealthy even when HTTP endpoint responds.

Never paste raw `.env.server`, secret keys, bearer tokens, tunnel credentials or personally identifying logs into an issue or chat. The app is user-linked; query the timeline only with appropriate consent and access.

## Failure decision guide

| Observation | Likely domain | First safe action |
|---|---|---|
| Public URL down, localhost up | Tunnel / public DNS / Mac network | Inspect tunnel agent and network without changing its credentials |
| Public and localhost down | API/launchd/Mac | Check launchd and process state; inspect errors in private Mac logs |
| HTTP 200, no progress, queued work aging | Worker/background processing | Inspect worker heartbeat, queue, job errors; do not ask user to repay or spam Retry |
| AI failures across users | Gemini/provider/cost guard | Inspect `job_finished`, `ai_calls`, error categories, budget and supported fallback |
| One user stuck on OTP | Auth/SMTP | Verify OTP delivery path without accessing the user's actual code |
| Error only on iPhone | Mobile/network/session | Correlate safe `request_id`, app release/session and server request logs |
| New users see others' items or incorrect credits | Security / financial integrity | Stop new invites, investigate ownership/RLS and wallet before resuming |
| Mac sleeps / internet down | Single-host availability | Restore power/connectivity; tell users the beta is temporarily unavailable |

## Safe restart and kill switch notes

- The repo README documents `launchctl kickstart -k gui/$(id -u)/com.kipscloset.api` as a way to restart the API. **This interrupts active connections and may affect current work**; only run after confirming the documented label/launchd state and planning the restart. Verify in-flight jobs resume by idempotency after it returns. Do not start a second uvicorn instance on the same port.
- **Never** restart production services automatically in response to a single timeout during the pilot without appropriate recovery controls.
- The repo documents `WARDROBE_GENERATION=off` as the emergency switch to prevent **new AI generation**. Changing a live env and restarting is an owner action. It does not erase saved wardrobe items. `WARDROBE_BILLING=off` is **NOT** the emergency stop; it would remove charges and can increase spend.
- A process liveness check or launchd auto-restart does not protect against a sleeping Mac or home internet failure. External off-Mac uptime monitoring is ideal; seek owner approval for any provider/signup/credentials. Until configured, use off-network manual probes and treat 24/7 uptime as **not guaranteed**.

## Logging / privacy / local data lifecycle

- Existing `api/logs.py` writes JSON to stderr and to `logs/server.jsonl` with daily rotation and 14 backups. Inspect its configured actual path on Mac. Ensure file permissions and disk capacity are appropriate; never upload raw logs to public GitHub.
- The privacy-safe correlation chain is built: `client event` → `request_id` → `job_id` (if queued) → `attempt/stage` → `ai_calls` (estimated spend) → `job_finished` (see "Following one failure"). Missing correlation should be reported as a diagnosis gap, not silently guessed. Log lines are redacted for bearer tokens, JWTs, signed-URL tokens, keys and email addresses before they are written.
- Existing `scripts.usage_report --user` can show an authorized account timeline. It is sensitive because it links activity to an account: restrict to authorized operator and never commit output containing tester identifiers.
- Raw pictures, names, auth codes, addresses, user text, AI prompts/completions and private signed image URLs must not be in logs or crash traces.

## Incident response / tester message

If service is unavailable, tell affected testers without disclosing private infrastructure details:

> היי, כרגע יש תקלה זמנית בגרסת הבטא של KIPS, ולכן ייתכן שלא ניתן להוסיף בגדים חדשים. הפריטים שכבר נשמרו אמורים להישאר בארון. אעדכן כשהשירות ייבדק ויחזור לעבוד. אין צורך ללחוץ שוב ושוב על יצירה כרגע. תודה על הסבלנות 🙏

Do not promise stored items are safe if there is an actual storage/ownership incident; investigate before asserting facts. For a credential/privacy incident, pause new invites and handle urgently.

## Owner go/no-go

- **GO** only after external signed build, real off-network first-item flow, worker/queue checks, known owner coverage, beta credit policy, private telemetry validation and contact/support path are verified.
- **NO-GO** if Mac availability cannot be maintained for the agreed testing window, tunnel is unstable, worker can't recover jobs, user account isolation fails, cost limits are unknown or you can't explain critical failures.
- The decision to host the first five on Mac is accepted. A cloud migration is **not a prerequisite for this pilot**.