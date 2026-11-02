# KIPS First-Five Observability — Mac + Cloudflare Tunnel Design

**Date:** 2026-11-02  
**Repo audited:** `RoiSafran9/digital-wardrobe`, `main` at `36cb7b6626650bcf04255f3d2a3392f86c61abd1`.  
**Status:** Engineering proposal. This document is **not** deployed instrumentation and must be reconciled with the next branch head before changing code.

**Pilot hosting decision (approved):** Five external TestFlight users connect to `https://api.kipscloset.com` through **Cloudflare Tunnel running on the founder's Mac**. The **FastAPI API and in-process AI worker run on that Mac**; Supabase Auth/Postgres/Storage remain hosted. **No Render, Railway, Docker-cloud migration, remote worker deployment, or infrastructure purchase is in scope.** The existing Dockerfile is not a task for this pilot.

## 0. Objective, and the boundary of "everything"

For five early iOS users, the founder needs to answer five questions without asking the user to reproduce every bug:

1. **Product:** Which meaningful steps did the user reach, leave or repeat? Did they add and recognize their first real garment? Did they come back on another day?
2. **App:** Which screen/action failed, on what release and session, with what error class and request ID?
3. **System/AI:** Which authenticated backend request led to which async job, worker attempt, pipeline/model stage and outcome? Where was the delay and what did it cost?
4. **Operations:** Is the Mac awake/reachable, is the Cloudflare Tunnel functioning, are the API/worker healthy, are queued jobs aging, are costs/errors above guardrails, and was there an account/privacy problem?
5. **Downtime:** Can the founder reliably detect and communicate an outage *even when the Mac itself is offline*?

**Do not log every touch, image, text field, full HTTP request/response, photo, OCR result, unredacted model prompt or session replay.** Observe *meaningful operations* only. The purpose is diagnosis and launch insight, not surveillance or personally identifiable usage capture.

## 1. Already in main — REUSE, do not rebuild

| Concern | Current implementation | Limit |
|---|---|---|
| Product analytics | `mobile/src/activity/track.ts`, `queue.ts` → `POST /v1/events/batch`, server validation in `api/activity.py`, private `activity_events` table | Good structured event stream; lacks end-to-end operation correlation and some install/funnel details |
| Session | Client-generated `session_id`, `app_version`, idempotent client event ID, per-account async queue with retry | Session is a lifecycle marker, not a distributed trace |
| Request logging | `api/logs.py` structured JSON (stderr + daily server log with 14 backups), route templates, status, latency, `X-Request-ID` response header | Mobile `mobile/src/api/v1.ts` does **not** inject X-Request-ID or expose it to error reporting in current main |
| Async jobs | `api/worker.py`, durable `generation_jobs`, job ID, attempts, progress, outcome events, queue/heartbeat | No unified distributed tracing across request→queue→worker→provider |
| Model calls/cost | `ai_calls` persisted from pipeline logs; estimated provider cost, stage, status, model, retries | Cost metric already exists; avoid duplicate logging and charging |
| Health | `GET /healthz` in `api/routes/health.py` | No verified external alerting or uptime pager |
| Reporting | `scripts/usage_report.py` including per-user timeline (`--user`), `scripts/activation_report.py`, `reports` SQL views | Existing 'second import' uses >30 min, not a separate day. Retention d7 is window days 6–8, not exact D7 |
| Client crash indication | `mobile/src/ui/ErrorBoundary.tsx` emits `client_error` category | Does not send useful symbolicated stack/line info; no verified native crash reporting |

**Be careful:** The repository documents `api.kipscloset.com` served by the owner's Mac over Cloudflare Tunnel. **This is the explicitly chosen pilot deployment**, not a suggestion to migrate to cloud. This is not independently verified live uptime. The beta's App Store Connect status and deployed server flags were not accessible here.

## 2. Proposed architecture — minimal, layered

```
 iPhone / Expo React Native
   ├── Product events  ────────────> existing batch /v1/events/batch ──> Supabase activity_events
   ├── Crash/errors (opt-in provider) -> Sentry React Native project, symbols from EAS builds
   └── API request X-Request-ID ─────> FastAPI structured request logs / OTel server span
                                      └── generation_jobs(job_id)
                                           └── worker attempt spans
                                                ├── scan/vision
                                                ├── image generation / validation / rembg
                                                ├── Supabase write
                                                └── credit settle + ai_calls cost record

 Read-only admin reports: existing usage_report + launch cohort additions
 Ops alerts: **off-Mac** HTTPS uptime for Tunnel/API, Mac power/network/service liveness, queue age, heartbeat, errors and estimated cost thresholds
```

**Recommended tool choice for this stage:** Retain Supabase events and JSON server logs. Add **Sentry React Native** for actionable mobile crash/exception diagnostics (consider limited performance traces only if needed), plus **OpenTelemetry Python** server spans around critical execution stages once provider/export target is confirmed. Do not introduce a second product analytics system or an entire ELK/Grafana stack for five users.

Sources: https://docs.expo.dev/guides/using-sentry/ ; https://opentelemetry.io/docs/languages/python/instrumentation/ ; https://opentelemetry.io/docs/languages/python/libraries/

### 2.1 P0 — first-five correlation WITHOUT a new logging platform

- In the central authenticated mobile HTTP layer (`mobile/src/api/v1.ts`), assign a fresh **32-lowercase-hex** `X-Request-ID` on every request, including start/retry/poll, with original ID reused for the same network retry when appropriate. Read the server's returned header when possible. Do not use this as a security token.
- Wrap errors into a typed, sanitized internal diagnostic object (operation name, HTTP status group, `request_id`, current app version, operation correlation ID if present); keep existing user-friendly message. No request body, signed URL or auth header in diagnostics.
- Server already validates/echoes `X-Request-ID`; preserve its behavior and structured route template logging. Strengthen test coverage that errors have a request id and sensitive content is never logged.
- A generation start should correlate its returned **job_id** to the original request; polling and worker outcome use job ID. A background worker resumed later is **not automatically the same trace** as the HTTP request; correlate by job ID and optionally use an OTel span *link* or persisted trace context if engineered safely.
- Add typed *milestone* events for critical user journeys only where genuinely absent, such as `first_capture_started`, `scan_failed`, `first_item_visible`, `look_result_seen` if required. Validate against existing event names and real DB rows first; don't duplicate `photos_collected`, `generation_started`, `job_finished`, etc.
- For privacy-safe debug timeline, prefer user's existing `scripts.usage_report --user` rather than building an admin panel initially. Admin access stays server-side only.

### 2.2 P0 — useful errors on mobile

- Add Sentry SDK using officially supported Expo/React Native integration **only after confirming compatibility with the repo's Expo SDK 57 and any open SDK 58 upgrade**. Do not merge a native SDK change into a release build without simulator + device tests.
- Configure release/environment tags and verified EAS sourcemap upload; explicit allowed tags: route *template*, operation name, build number, randomized session and request ID (where available), sanitized error code.
- **Privacy first:** do not send email, garment names, photos, body-image URLs, OCR text, auth tokens, request/response bodies or raw provider prompts. Disable session replay, user interaction screenshots, attachments, network bodies and PII collection by default. Scrub exceptions and breadcrumbs in `beforeSend`; ensure any `user.id` use is restricted to approved pseudonymous/test-account mapping and reset on logout. Error stacks may still contain strings: validate filters.
- Integrate with, do not replace, the existing ErrorBoundary and `client_error` events; avoid duplicate reporting and infinite error loops.
- Before enabling external collection, review the existing Privacy Policy and App Store Connect App Privacy answers: current `docs/APP_STORE_CONNECT.md` says **Crash Data = No**. This must be updated to reflect actual data processing and providers before sending a build with Sentry.
- A third-party vendor account/DSN/token requires owner approval and private storage, not a Git commit. Do not enable vendor SDK or send telemetry until owner approves vendor, data/privacy disclosure and spend.

### 2.3 P1 — true backend traces

- Use OTel Python SDK with FastAPI instrumentation and **manually defined spans** around real business stages: `request`, `scan.create`, `scan.detect`, `generation.start`, `worker.claim`, `job.run`, `gemini.vision`, `gemini.image`, `quality_check`, `background_remove`, `storage.write`, `wallet.settle`, `outfit_builder.rank`.
- Use stable **operation/span names**, route templates, job kind, attempt number, outcome, duration and coarse error codes only; avoid high-cardinality user IDs as metric *labels* and avoid clothing details in spans.
- Propagate `traceparent` where feasible for synchronous request flow; worker's queue execution needs an explicit causal link via `job_id`/trace link (not blind parent-child continuity across long-lived background jobs).
- Do not create a heavyweight tracing backend unless one is chosen and costs assessed. Small beta can use protected **on-Mac** JSON logs with correlation IDs until OTel exporter is configured. If logs remain only on the Mac, they will not be accessible during a Mac/network outage; external uptime monitoring and incident notes address that gap. If a remote collector is selected, sample responsibly, prefer errors and key workflows; avoid every 2-second polling request and HTTP health check.
- Exporter must not delay garment jobs, retry indefinitely or make beta unavailable if telemetry is down.

### 2.4 P0 — founder operations alerting

Add lightweight **off-Mac** uptime monitoring on `GET /healthz`: a self-check that runs only on the Mac cannot detect power, sleep, or internet outage. Health check HTTP 200 by itself does not prove the worker is healthy. Any paid/external alert vendor needs owner approval. If no third-party monitor is approved yet, use explicit scheduled manual off-network checks and document the reduced reliability as a launch risk. Alerts, with an absolute event threshold suitable for tiny beta:

| Signal | Initial suggested trigger | Intended action |
|---|---|---|
| Endpoint unavailable | 2–3 consecutive failures | Check Mac power/sleep/Wi-Fi, Cloudflare Tunnel and local API launchd agent |
| Worker stuck | heartbeat missing/stale > 2–3 min while queue non-empty | Restart/recover worker, inspect queue |
| Job stalled | oldest queued > 10 min | Check worker/provider and backlog |
| Job failures | 3 failed consecutive attempts/jobs, or 5 in 30 min | Inspect failure codes/model availability |
| AI cost | Owner-defined daily USD cap / 80% warning | Investigate, use **generation kill switch** if needed |
| OTP delivery | Test signup OTP not received | Diagnose SMTP before more invitations |
| Server errors | repeated 5xx on key endpoints | Inspect request IDs and backend logs |

Thresholds are **proposed**, not configured or validated. Never log health probe addresses or sensitive headers. Alert channel (email/Telegram/etc.) must be owner-approved and tested; no background promises by ChatGPT.

## 3. Event/metric model for the launch

### Core launch funnel — evaluate by user/cohort, not raw action volume

1. **Invited** — tracked in a private manual tester sheet / App Store Connect (not observable inside the app).
2. **Invitation accepted / Installed** — App Store Connect TestFlight test group status, may lag. Not tracked by backend.
3. **Signed in / welcome granted** — backend `signed_in`, `welcome_granted`.
4. **First 3 Pieces started / photos collected / found / generation started** — existing onboarding app events.
5. **First usable item saved** — authoritative wardrobe row plus event, no image metadata captured.
6. **Three items saved** — authoritative wardrobe rows (ensure not just an analytics event without a real item).
7. **First look requested / opened / swapped** — existing backend and client events, only when feature enabled and wardrobe can make a valid outfit.
8. **Next-day meaningful action** — must compare user actions on **different calendar dates** within 7 days, not >30 min gap, and distinguish voluntary use from requested QA task.

### Metrics

- Invitation→Install, Install→Signup: pair TestFlight test group status with consented/private tester tracker; app analytics cannot measure the whole pre-install funnel.
- `first_item_24h`: fraction of new testers with a real successful owned garment in 24 h.
- `three_items_7d`: fraction with >=3 actual owned active pieces in 7 d.
- `time_to_first_saved_item`: median and p75 among successful activations, show denominator.
- `second_import_on_different_day_7d`: among first-item activated, distinct day with additional new piece within seven days; note timezone convention (UTC vs user's locale) explicitly.
- `meaningful_return_7d`: among all cohort users, a real closet-item opened, a new item saved, or meaningful outfit-builder result on a later day; do not count mere `app_opened`.
- `error_rate`, `ai_job_success_rate`, `p50/p95_generation_time`, `queue_oldest_age`, `est_ai_cost_usd/user`, `credit_ledger_consistency`, `data_isolation_incidents`.
- Five users are **qualitative pilot**: report counts (3/5) with exact narratives; do not declare statistical proof based on percentages.

### Journey example: user says "it spun and nothing happened"

1. Get approximate time + user consent for targeted troubleshooting, identify test account securely.
2. Use `scripts.usage_report --user` to see most recent step/time/job result.
3. Search sanitized API logs by user_id and `X-Request-ID`; follow job ID to `generation_jobs` and worker log.
4. Correlate with `ai_calls` by `job_id` to see provider/model error and estimated charge; inspect current `/healthz` and queue status.
5. Inspect sanitized Sentry error, if enabled, by release/session/request ID; file a bug with result and screenshot only with permission.
6. If no telemetry appears, mark `telemetry_missing` and follow normal manual reproduction; do not assume a user didn't attempt it.

## 4. Guardrails and cost/privacy

- **Consent/disclosure:** Update policy and Apple App Privacy metadata whenever actual logging/crash vendor changes. Explicitly tell F&F testers that product usage events and errors are collected to improve the beta. Respect deletion/retention; review vendor deletion capabilities.
- No full session recording, screenshots, original photos, images, filenames, garment names, OCR text, user-provided free text, passwords, auth/refresh tokens, signed Supabase URLs, AI prompt/response text or IP addresses in events/logs/traces.
- If an exception/stack contains sensitive values, classify and sanitize before transmission; do not assume vendor defaults are sufficient.
- Keep no unique hardware ID. User-linked product events are access-controlled to admins and removed with the account under existing database lifecycle; external crash provider retention/erasure must be separately documented.
- Keep business and financial truth in existing Postgres rows; no two systems should issue credits or double-count provider costs.
- Keep telemetry low-volume, bounded, non-blocking; network failure should never prevent login, garment creation or app navigation.
- No unreviewed production DB changes or enabling paid services. Roll out in stages with dry-run and local tests.

## 5. Implementation milestones and tests

### M0 — Baseline audit & data flow verification
- Confirm current main HEAD, deployed flags and environments separately.
- Produce existing event matrix and gaps; instrument only missing signals.
- Validate real analytics delivery with a staging account and `scripts.usage_report --user`.

### M1 — P0 correlation + reliable launch dashboard (first)
- Add sanitized X-Request-ID to central iOS API client and map it to error context.
- Ensure job lifecycle correlation and non-sensitive worker outcome logs.
- Add accurate next-day second-import and meaningful-retention metrics to report, with pure unit tests and no production migration if possible.
- Create administrator first-five runbook; no tester names/passwords in repo.

### M2 — Crash diagnostics + ops alerts
- Implement Sentry compatibility proof, SDK setup and sourcemaps behind explicit enable flag/config, while preserving privacy and current ErrorBoundary.
- Prepare uptime and worker/queue threshold alerts; do not provision vendor account or enable production without approval.
- Test crash in a **controlled staging build** and verify correct symbolicated report; no real-user sensitive data.

### M3 — Server spans if needed for performance diagnosis
- Instrument FastAPI/worker with OTel for top critical operations, sample/limit high-frequency polling.
- Configure owner-approved exporter, privacy filter, retention and verification of trace/job continuity.

### M4 — Dry run and readiness evidence
- Test 2 accounts, failed upload, Gemini timeout, wrong-user item, background/resume job, worker restart, OTP failure, offline→online, app crash, sign out.
- Assert every monitored outcome has usable trace/correlation or documented reason; verify no secret/photo leak.
- Produce one screenshot-free, privacy-safe example diagnostic timeline and a sample weekly KPI report.

## 6. Definition of done BEFORE five invitations

**Must have:** Mac awake/powered for the agreed pilot window, working Cloudflare Tunnel and local launchd API/worker, documented outage communications, working signed TestFlight beta; real sign-in + first item on a separate phone/network; existing activity event report validated; useful request/job correlation; reliable host/worker alert path; known daily AI spend and kill switch; privacy statements match collection. **Strongly desirable:** symbolicated React Native crashes. **Can wait until after first five:** full OTel distributed backend and polished Grafana-style dashboard if existing logs suffice to diagnose failures.

Verification must be from actual runtime/tests, not just the presence of files in GitHub.

## 7. Mac-hosted operations and observability: non-negotiable pilot boundary

### End-to-end dependency map

```
TestFlight KIPS iPhone
   ├─ app activity (per-user queue) -> Mac FastAPI `/v1/events/batch` -> hosted Supabase
   └─ authenticated API calls -> https://api.kipscloset.com
         -> Cloudflare Tunnel **on Mac** -> FastAPI middleware + JSON log / X-Request-ID
         -> Supabase durable `generation_jobs` -> in-process worker **on same Mac**
         -> Gemini API -> results in private hosted Supabase storage
         -> status/credit/events -> iPhone

Off-Mac uptime probe -> https://api.kipscloset.com/healthz -> alert to founder (if approved/configured)
Mac local logs + launchd diagnostics -> founder runbook; retain secrets on Mac only
```

### Operational P0 (before 5 friends)

- Inspect actual `~/Library/LaunchAgents/com.kipscloset.api.plist` and confirm process command, `--env-file .env.server`, logs and account mode; **do not auto-edit a user's LaunchAgents or `.env.server` without explicit approval**.
- Discover (don't invent) the actual Cloudflare Tunnel launchd service label and verify that the tunnel recovers when its process dies; preserve the existing ingress hostname and auth configuration.
- Confirm power/sleep settings and a maintenance/pilot window. Keep Mac charging, awake and connected. Do not change macOS power settings automatically; provide safe owner checklist.
- Run the external `curl --fail --max-time 15 https://api.kipscloset.com/healthz` check **from an off-Mac network**, and inspect heartbeat/queue/worker metrics. A 200 with a dead worker must trigger a separate unhealthy evaluation.
- Track log retention/disk use and avoid log paths in iCloud/Dropbox/public folders. Existing `api/logs.py` has 14 daily backups; inspect the actual volume of logged errors and rotation.
- Avoid high-cardinality raw-user-ID metric **labels**; restricted user-linked support timeline is acceptable and already exists in the authenticated database. Do not upload raw JSON logs to GitHub or public bug trackers.
- Test graceful process restart **only in a controlled test window**, with idempotent job-resume verification. Never kill a live test user's generation job just to demonstrate monitoring.
- If full server traces are delayed, prioritize reliable `X-Request-ID`, a job correlation mapping, outcome logs and the existing `ai_calls` table. Remote trace collection is not P0 for just five users.
- Incident communication: if the Mac/tunnel is down, send a simple beta status message to invitees; don't instruct users to spam Retry or re-pay. See `06-MAC-OPERATIONS-RUNBOOK.md`.

### MAC-specific alert matrix

| Condition | Minimum detection | Pilot action |
|---|---|---|
| Mac sleeps or loses power/network | External HTTPS monitor reports consecutive probes unavailable | Restore Mac/power/network, check tunnel and API; notify testers |
| Tunnel fails but local API is healthy | Local API check succeeds, external HTTPS check fails | Inspect cloudflared launchd service/credentials privately; do not leak its tokens |
| API dies but tunnel alive | localhost API probe fails; external probe fails/5xx | Inspect `com.kipscloset.api` launchd; restart only as controlled action |
| API answers but worker dead | `/healthz` heartbeat stale or queued jobs aging | Inspect worker process/exception and durable queue, run idempotency check |
| Gemini outage/provider errors | Error code spike or `job_finished` failures in existing logs/events | Pause new generation with **approved** generation kill switch; communicate |
| AI spend spikes | Existing `ai_calls` cost estimates and configured job cap | Pause new generation/triage; do **not** turn billing off as a kill switch |
| Disk/logs fill the Mac | Disk free, logging errors/rotation check | Rotate using existing approved mechanism; preserve evidence safely |

### Explicitly out of scope for first five

No cloud migration, moving API/worker off Mac, full high-availability deployment, Kubernetes, paid observability stack, automatic screenshot/session replay, new product-analytics vendor, or broad instrumentation of every UI touch. Those are later scale/production decisions.

**Related:** `03-OWNER-LAUNCH-CHECKLIST-HE.md`, `06-MAC-OPERATIONS-RUNBOOK.md`, `07-OBSERVABILITY-QA-ACCEPTANCE.md`.