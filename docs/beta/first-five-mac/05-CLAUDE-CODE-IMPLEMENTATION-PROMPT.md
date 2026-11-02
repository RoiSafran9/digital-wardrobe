# Claude Code — Implement KIPS First-Five TestFlight Observability on the Mac

**START IMPLEMENTING NOW. This is a coding task, not a new planning-only exercise.**

## Authoritative pilot decision

- The first **five** external iOS testers will install KIPS via **TestFlight**.
- **FastAPI + the AI worker will run on the founder's existing Mac**, reached via the existing **Cloudflare Tunnel** at `https://api.kipscloset.com`.
- Supabase Auth/Postgres/private Storage continue as-is in their hosted environment.
- **Do NOT move the API/worker to Render, Railway, AWS, Docker cloud, another Mac, or any managed hosting provider.** Do not add a cloud-deployment project, Terraform, CI provisioning, paid monitoring backend or new long-lived infrastructure.
- You may prepare code/docs/tests locally and open a PR. **Do not modify live `.env.server`, launchd configuration, Mac power settings, Cloudflare settings, App Store Connect, hosted Supabase, billing flags or production telemetry vendors without explicit owner approval.**

## Read first — actual repository

1. Open `RoiSafran9/digital-wardrobe`, sync current `main`, read `AGENTS.md` and `CLAUDE.md`.
2. Read **all documents** in `docs/beta/first-five-mac/`, especially:
   - `README-START-HERE.md`
   - `03-OWNER-LAUNCH-CHECKLIST-HE.md`
   - `04-OBSERVABILITY-ARCHITECTURE.md`
   - `06-MAC-OPERATIONS-RUNBOOK.md`
   - `07-OBSERVABILITY-QA-ACCEPTANCE.md`
3. Review `docs/DEPLOY.md`, `docs/APP_STORE_CONNECT.md`, `docs/ROADMAP.md`, `mobile/eas.json`, `mobile/app.json`.
4. Audit current code **before changing anything**: `mobile/src/activity/`, `mobile/src/api/v1.ts`, `api/logs.py`, `api/activity.py`, `api/worker.py`, `api/routes/health.py`, `scripts/usage_report.py`, Supabase migrations, tests.
5. Account for open PRs, particularly Expo SDK updates. Do not assume the repo has already been deployed or TestFlight approved just because documents mention it.

## M1 — End-to-end operation correlation (IMPLEMENT)

- In the existing mobile API layer, attach a correctly formatted random `X-Request-ID` (32 lowercase hex) to authenticated API requests; keep request identifiers safe across retries and expose a sanitized `request_id`/operation/status to diagnostics without changing friendly UI errors.
- Reuse the server's `X-Request-ID` middleware. Ensure a request that queues AI work has a documented correlation from client action -> API request -> persisted `job_id` -> worker attempt -> `ai_calls` and final `job_finished`. **Do not fake parent-child traces across async worker restart**; use job ID/span link where appropriate.
- Ensure structured log entries for operation start/finish/failure/latency where missing, with bounded fields and severity, and consistent error codes. Exclude authentication secrets, photographs, garment metadata, free text, request bodies, signed URLs, email, IP and raw Gemini prompts/responses.
- Preserve all existing idempotency keys, retry behavior, RLS/account isolation, credit ledger and worker recovery; introduce no duplicate job or charge on retry.
- Add automated tests proving request ID validation/echo, useful failure correlation and privacy-safe logging.

## M2 — POC analytics/report correctness (IMPLEMENT)

- Reuse `activity_events`, the mobile batch queue, existing server events and `scripts/usage_report.py`. **Do not install Mixpanel/Amplitude or rebuild analytics.**
- Extend the report with (a) **second import on a different UTC calendar day within 7 days**, and (b) **meaningful return on another day within 7 days** based on a truly useful action (opened own item, successfully saved item, valid outfit suggestions viewed); define denominators and eligible cohorts explicitly. A mere app open or background poll is NOT meaningful return.
- Keep the existing '>30 min repeat import' and D6–D8 window metrics, but label them accurately; do not silently redefine or rename a historical metric. If required action events are absent, add only allowlisted, bounded, non-sensitive events in the established mobile/server schema and tests.
- Add unit/integration tests: same-day vs next-day, UTC boundary, user never activated, duplicate events, deleted items, mixed account data, zero eligible cohort, 7-day eligibility, no phantom result.
- Provide a privacy-safe operational report for exactly five consented pilot test accounts **without putting their emails or IDs in repository files**. A command-line report is sufficient; no dashboard UI is needed for the first pilot.

## M3 — Mac-based health, worker diagnostics and alerts (IMPLEMENT safe local parts)

- Use existing Mac-bound FastAPI `/healthz`, JSON log rotation, durable jobs and usage reporting; keep all monitoring configuration in local/private env or documentation.
- Add a **read-only** health evaluator / CLI or script (no secrets) that inspects the health JSON and reports API reachable/unreachable, worker heartbeat stale, queued job age and failures separately. HTTP 200 alone is NOT healthy if the worker is stalled.
- Define explicit thresholds; unit-test healthy, stale worker, queued jobs, invalid JSON, timeouts and server errors.
- Provide a script/runbook that an owner can execute from the Mac and a separate **off-Mac** availability check approach; a local-only monitor cannot alert when the Mac is off. Prepare alert integration points but do not create vendor accounts or contact external services without owner authorization.
- Inspect (read only) the actual Mac launchd labels/config if accessible; don't assume Cloudflare Tunnel launchd label. Don't restart or edit running services automatically. Provide exact owner-verified commands for startup/recovery only.
- Log retention, disk space, Mac sleep/power, Wi-Fi and uptime checks must appear on the owner checklist. Don't auto-change OS power policies.
- No Docker/cloud-host migration; stop if an architecture proposal assumes that.

## M4 — Mobile crash reporting and server tracing (SAFE PREPARATION FIRST)

- Inspect compatibility with current Expo SDK 57 and open SDK 58 PR; if Sentry is used, integrate SDK/config in disabled-by-default mode with privacy scrubbing and EAS Source Map instructions. Don't enable any external telemetry export or use a real DSN without owner approval.
- IMPORTANT: existing Apple privacy draft says Crash Data = No; prepare disclosure changes for the owner to review **before** enabling third-party crash reports.
- For server-side traces, prefer privacy-safe correlation + measured stage durations stored in existing restricted Mac logs. Add minimal OpenTelemetry spans **only where they demonstrably improve diagnosis** and the exporter is disabled/no-op until approved. Do not create a separate tracing backend for five testers.
- Telemetry failures must be nonblocking and must never double-charge or mutate jobs.

## M5 — Verify/TestFlight handoff (IMPLEMENT DOCS + CHECKS)

- Update owner launch checklist, five-testers guide and operator runbook to match actual code/available scripts.
- Run relevant `pytest`, mobile Jest, TypeScript checks and scripts in safe local/test environments; list what did and didn't run. Do not claim physical-device, App Store Connect, hosted Supabase or Mac production checks without evidence.
- Validate flows: first sign-in/OTP, First 3 Pieces, generation, error path, worker restart/recovery, credit idempotency, cross-account isolation, outfit builder basic use, offline/online retry, privacy scrub, correlation and readable per-user timeline.
- Create `docs/beta/first-five-mac/09-CLAUDE-EXECUTION-REPORT.md` with changes, test results, known limits, owner-only steps and explicit go/no-go launch gates.
- Prepare TestFlight invite placeholders. **Never invent a unique `testflight.apple.com/join` link or invite a real friend.**

## Delivery and safety

- Create a focused feature branch and **start writing code now**. Use small commits and create a PR to `main`. **Do not merge without owner approval**.
- Do not deploy to the Mac or Supabase, start paid services, enable billing, change Cloudflare configuration, change privacy disclosures in live systems, or submit a TestFlight build without the owner's explicit action/authorization.
- P0 first: M1 correlation, M2 KPI correctness, M3 health-evaluator/checks. M4 is optional if needed; never let an unapproved telemetry vendor block shipping P0.
- Report exactly what code is ready versus which owner actions (Mac uptime, flags, Apple review and invitation URL) remain necessary.
- Where user consent or collection/disclosure is relevant, never turn on new collection without review.

**START CODING M1 NOW. CONTINUE M2 AND M3. DO NOT STOP AFTER AN AUDIT OR PLAN.**