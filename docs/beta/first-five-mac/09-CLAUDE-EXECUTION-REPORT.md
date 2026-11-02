# First Five — Observability Execution Report (Claude Code)

**Date:** 2026-11-02 · **Branch:** `claude/kips-testflight-observability-02b53f` (from `main` at `e0f0f7b`) · **Status:** merged to `main` (PR #31, `5242ba1`) and deployed to the Mac on the owner's approval — see "Deployment" below. Nothing on Cloudflare, Supabase or any vendor was changed; no tester was invited.

Hosting stays as decided: FastAPI + in-process worker on the founder's Mac behind Cloudflare Tunnel (`https://api.kipscloset.com`). No cloud host, container, tracing backend, analytics vendor or crash vendor was added.

## What was built

### M1 — correlation (iPhone → API → job → model calls)
- `mobile/src/api/v1.ts`: every signed-in call sends a random 32-hex `X-Request-ID`; a job start's single network resend keeps the same id (and the same `Idempotency-Key`). Failed calls throw `ApiError` — the same friendly message as before, plus `requestId`, `operation` (`"PATCH /v1/items/{id}"`, ids and query removed) and `status` (0 = no answer). No body, token or URL is kept.
- `client_error` events (`network`, `http_5xx`, and `unhandled` when the error is an `ApiError`) carry `request_id`; the server allow-list accepts only 32 lowercase hex for it (`api/activity.py`).
- `api/routes/v1.py`: the request that queues AI work logs `job queued` (or `job reused` for a repeated key) with `request_id`, `job_id`, `user_id`, kind and status.
- `api/worker.py`: each job runs inside `job_context` (log lines carry `job_id` and `user_id`) and logs `job claimed` (attempt, seconds since created), `job will retry` and `job finished` (outcome, failure code, ms, number of model calls, estimated USD, pieces made). The worker is **not** presented as a child of the HTTP request: the link is the job id.
- `api/logs.py`: every line is redacted before it is written — bearer tokens, JWTs, signed-URL `token=`/`key=`/`sig=` values, Supabase/Gemini key shapes and email addresses (also inside tracebacks).
- `GET /healthz` adds `jobs_running`, so a long job is not mistaken for a stalled worker.

### M2 — launch KPIs (`scripts/usage_report.py`)
- New **Launch** section, each KPI as *reached of eligible* plus *still in window*, counts before rates:
  - `first_piece_24h` — a closet piece within 24 h of sign-up.
  - `three_pieces_7d` — three closet pieces within 7 days of sign-up.
  - `second_import_other_day_7d` — among accounts with a first piece: another piece on a **different UTC calendar day**, 1–7 days after the first piece's day.
  - `meaningful_return_7d` — among all sign-ups: a meaningful action on a **later UTC day**, 1–7 days after the sign-up day. Meaningful = a closet piece saved, an own piece opened (`item_opened`), outfit suggestions shown (`look_generation_requested` with results > 0) or a look opened (`look_opened`). Not: `app_opened`, `screen_viewed`, `signed_in`, job polling.
  - time to first saved piece (median, p75, n).
- Rules: UTC days; a piece later removed still counts as saved; pending outfit results, pieces moved from `runs/` and pieces dated before sign-up never count; duplicate events count once; an open window is "still in window", never a failure; an empty cohort shows `0 of 0` with no rate.
- Legacy measures are unchanged and labelled: funnel `came_back_with_a_piece (≥30 min later, same day counts)`; retention `d1/d7 (days 6–8)/w2` as *any activity, app opens included*.
- `--cohort FILE`: a private file **outside the repository** (the command refuses one inside it) with `<alias> <email or id>` lines; output names aliases only (T1…T5) with per-tester sign-in, first piece minutes, pieces, each KPI (yes/no/open/n-a), failed jobs, app errors, estimated AI USD and last active day. `--json` too.
- `--user` timeline: job lines carry `[job <id>]`, app errors show `request_id=…`, to search the server log.
- No migration: the SQL `reports.*` views are unchanged; the new KPIs are in the CLI only.

### M3 — Mac health (read-only)
- `scripts/health_check.py`: judges `/healthz` part by part with explicit thresholds (table in `06`), exit 0/1/2, `--json`, and an `--on-alert '<command>'` hook (JSON on stdin) as the integration point — no vendor is contacted. With a local and a public URL it separates a tunnel/network outage from an API one.
- `scripts/mac_preflight.sh`: launchd state of `com.kipscloset.api` (state/pid/runs/last exit only — never its environment), Cloudflare launchd jobs and a `cloudflared` process count (never its arguments), both health URLs, AC power and sleep (`pmset`, read only), default route, free disk, log size/location/permissions and today's ERROR, failed-job and 5xx counts.

### M4 — crash reporting and server traces: **not implemented (by design)**
No Sentry SDK and no OpenTelemetry were added: both need an owner-approved vendor/exporter, and Sentry needs an Expo SDK 57 compatibility check, a device build and a privacy disclosure change (`docs/APP_STORE_CONNECT.md` says **Crash Data = No**). The request/job/ai_calls correlation plus structured worker timings cover the first-five diagnosis needs listed in `04` §6 ("can wait until after first five"). Residual gap: native crashes and JS stack traces are not captured; `client_error` records only the kind (and request id).

### Docs
`03` (owner checklist, Hebrew: commands, cohort report), `06` (tools, thresholds, failure-tracing recipe, alert hook, off-Mac approach, the read-only audit below), `07` (automated coverage map; statuses stay NOT RUN), this report; `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`; the privacy page now says an error record includes a random number matching it to the server log (repo text only — the live site is not redeployed).

## Verification

| Check | Result |
|---|---|
| `PYTHONPATH=$PWD .venv/bin/pytest -q` | **647 passed, 30 skipped** (skips: integration tests needing `SUPABASE_TEST_*`) |
| `cd mobile && npx jest` | **485 passed** (55 suites) |
| `cd mobile && npx tsc --noEmit` | clean |
| New tests | `tests/api/test_correlation.py` (13), `tests/test_launch_metrics.py` (22), `tests/test_health_check.py` (26), new cases in `mobile/__tests__/v1client.test.ts` and `activity.events.test.tsx` |
| `npx supabase test db` | **not run** — no schema change; local stack not started |
| `pytest tests/integration` | **not run** — needs `SUPABASE_TEST_*` |
| `scripts/mac_preflight.sh` on this Mac (read-only) | ran; result WARNING (on battery), details below |
| Phone / TestFlight / hosted Supabase / off-Mac probe | **not run** — owner actions |

**Read-only audit of this Mac, 2026-11-02 13:51 UTC:** `com.kipscloset.api` running (started 4 times); one listener on :8000; user launchd job `com.cloudflare.cloudflared`, one `cloudflared` process; local and public `/healthz` healthy (beat 1 s, queue empty, no failures); **running on battery, 46 %**; idle sleep held off by an assertion while `pmset sleep` is 1 min; 604 GB free; logs 1.3 MB in 4 files, mode 644. Today's log: 21 ERROR lines, all worker calls to Supabase (`httpx.RemoteProtocolError` "Server disconnected", `ReadTimeout`) in the worker loop (15), credit reconcile (4) and storage sweep (2); the loop recovered each time.

## Known limits
- Correlation lives in the Mac's local log (14 days). During a Mac/network outage those logs are unreachable; the phone's `client_error` with a `request_id` absent from the log is the signal that a call never reached the Mac.
- `jobs_running` and the new log lines exist only after the Mac runs this branch. Until then `health_check` judges by heartbeat alone (`worker_stalled` may fire during a job longer than 180 s while another is queued).
- Thresholds are proposals for five testers, not tuned on traffic.
- The heartbeat is the main worker loop; with `WARDROBE_WORKER_CONCURRENCY > 1` the extra loops don't beat.
- Meaningful return cannot tell voluntary use from a use you asked for — ask the tester (`08`).
- `request_id` is new data in `activity_events.props` for `client_error`; it is random and not tied to the device, and the privacy page text was updated in the repo — review it and the App Privacy answers ("Other Diagnostic Data" is already declared) before release.

## Deployment (2026-11-02, approved by the owner)

| Step | Result |
|---|---|
| Merge PR #31 | `main` at `5242ba1` |
| Mac: `git pull --ff-only` in `~/Projects/digital-wardrobe` | at `5242ba1` |
| `.env.server`: added `WARDROBE_OUTFIT_BUILDER=on` (backup `.env.server.bak-20261102`, untracked — never commit it) | Build My Look on; `WARDROBE_OUTFIT_BUILDER_AI` left off (no extra Gemini calls) |
| `launchctl kickstart -k gui/$(id -u)/com.kipscloset.api` with the queue empty | restarted (pid changed); `/healthz` now has `jobs_running` |
| `scripts/mac_preflight.sh` | WARNING only for battery power; API, tunnel, local + public health OK |
| `POST https://api.kipscloset.com/v1/outfit-suggestions` without a token | 401 (route on; off answers 404); our `X-Request-ID` came back and is in `logs/server.jsonl` |
| EAS `production` iOS build 10 from `5242ba1` (SDK 57), `--auto-submit` to App Store Connect | build `38285e3a-7ec6-4184-892b-55a1ed8bccb3` FINISHED 14:15 UTC; EAS submission `b3647a56-…` FINISHED (uploaded to App Store Connect; Apple processing, internal testing, external group and Beta App Review remain owner steps) |
| Owner phone test on build 10 (cellular) | sign-in, a new piece, Closet and Build My Look worked; request → job → `ai_calls` chain visible in the log. Found: Generate Again repeated the same looks |
| Fix `1d41c3f` (Generate Again sends the looks on screen; engine skips/penalizes them) deployed to the Mac (restart with an empty queue; `/openapi.json` shows `shown`) | on the owner's closet (28 pieces) every press gave 3 new looks, 8 presses in a row |
| EAS build 11 from `1d41c3f`, auto-submitted | build `3c95acf9-1092-4318-a66f-23184dc20275` FINISHED 18:17 UTC; submission FINISHED 19:01 UTC (the EAS submit queue took ~45 min) |

| EAS `production` iOS build 12 from `2f687de` (Build My Look icon tiles), `--auto-submit` | build `7010f3dd-ea61-4e08-a0cb-3b6b91ad3c63` FINISHED 18:46 UTC; EAS submission `e29415ec-…` waited ~40 min in the EAS queue, FINISHED 19:27 UTC (uploaded; Apple processing and tester groups remain owner steps) |
Build 9 (`36cb7b6`) already had the Build My Look screens; they were hidden because the server flag was off. Build 10 adds the app's request ids. Builds 9 and earlier keep working against the new server.

## Owner-only steps (1 and the flag part of the server change are done; the rest remain)
1. Review and merge the PR; then `git pull` on the Mac and restart the API agent in a quiet window (`launchctl kickstart -k gui/$(id -u)/com.kipscloset.api`), then `scripts/mac_preflight.sh`.
2. **Plug the Mac into power** and decide the sleep policy for the pilot window (no setting changed here).
3. Confirm `com.cloudflare.cloudflared` is the tunnel for `api.kipscloset.com`.
4. Decide the off-Mac probe: manual cellular checks per pilot window, or approve an uptime service (account, alert channel).
5. Create the private cohort file outside the repo (e.g. `~/kips-private/first-five.txt`) once testers sign up; run `--cohort` daily.
6. Ship a TestFlight build containing the app change (request ids) — older builds keep working, without request ids.
7. Run the `07` matrix on the real system; Apple review; real invitation link; send invitations.
8. Decide on crash reporting (vendor, disclosure) — optional for the first five.

## Go / no-go gates
- **GO** when: this branch is running on the Mac (or knowingly not); preflight exits 0 (on AC power, tunnel and worker healthy); the public URL is checked from cellular; `07` O01–O12, H01–H03, H05–H08 pass on the real system; a QA account's failure can be followed request → job → `ai_calls` in the log; the cohort report shows the QA account correctly; daily AI cap and kill switch known.
- **NO-GO** when: the Mac can't stay powered/awake/online for the window; the worker's Supabase errors keep recurring; a request id from the phone can't be found when it should be; any cross-account leak, double charge or unexplained credit movement.
