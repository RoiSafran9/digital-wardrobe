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
- The privacy-safe correlation chain should be: `client event` → `request_id` → `job_id` (if queued) → `attempt/stage` → `ai_calls` (estimated spend) → `job_finished`. Missing correlation should be reported as a diagnosis gap, not silently guessed.
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