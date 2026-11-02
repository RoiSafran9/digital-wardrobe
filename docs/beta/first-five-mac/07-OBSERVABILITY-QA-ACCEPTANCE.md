# Observability and Mac Beta — Acceptance & QA Matrix

**Status:** Test design. All cases are **NOT RUN** until executed in the actual environment. Code merged is not proof that App Store Connect, live Mac, tunnel or AI costs are working.

## P0 engineering and telemetry tests

| ID | Scenario | Expected evidence | Status |
|---|---|---|---|
| O01 | Authenticated request from iPhone/QA client | Response `X-Request-ID` validated; sanitized client operation links to server request log | PARTIAL — server side PASS live 2026-11-02 (valid id echoed and logged through the tunnel; invalid id replaced); app side needs build 10 on a phone |
| O02 | Job creation then provider success | Client request maps to durable job ID, worker attempt, model stage and finish event | OPEN — no AI job has run since the deploy; run one generation from build 10, then the drill below |
| O03 | Scan/Generate error | Error code/latency/account-scoped job diagnostic, NO raw photo, token, prompt or signed URL | OPEN — needs a real failed scan/generate |
| O04 | Retry same idempotency key after timeout | Same job, no double generation/charge; new request correlation without losing original job link | PARTIAL — idempotency PASS in integration tests on local Supabase; live retry not run |
| O05 | Sign out Account A, sign in B | No A timeline/diagnostics/wardrobe items leak to B; client queue stays keyed by account | PARTIAL — two-user isolation PASS in integration tests on local Supabase; phone sign-out/in not run |
| O06 | Same-day second item vs next-day item | Correct separate-day repeat import KPI; legacy 30-minute metric clearly named | OPEN — logic covered by tests; needs real data on two days |
| O07 | Mere app open or background job poll | Does **not** count as meaningful next-day return | OPEN — logic covered by tests |
| O08 | One new item on later day / opened own item | Meaningful return counts once for the correct account and cohort | OPEN — logic covered by tests |
| O09 | Client diagnostics unavailable | App still works and telemetry failures remain nonblocking | OPEN — needs a phone (airplane mode) |
| O10 | App/worker logs | Never contain auth tokens, email, photo bytes/URLs, raw prompts, OCR, user-entered names | PASS (live logs) 2026-11-02 — 648 lines in 4 files: 0 tokens, JWTs, signed-URL tokens, keys, emails, photo names, IP addresses or ids in routes |
| O11 | Out-of-scope user or fabricated ID | RLS and ownership protection; no leak into report or response | PARTIAL — live: no token, a fabricated JWT and another account's job id all answer 401; cross-account reads PASS in local integration tests |
| O12 | Five-account summary with empty/new cohorts | Counts and denominators correct, no fabricated percentages or hidden unknowns | PARTIAL — live cohort report ran (owner account + one unknown alias): aliases only, not-found listed, refuses a file inside the repo; the five real accounts don't exist yet |

### Automated coverage (branch `claude/kips-testflight-observability-02b53f`)

Automated tests are evidence for the code path only; each row above stays **NOT RUN** until it is executed against the real Mac, a TestFlight build and hosted Supabase.

| ID | Automated test(s) | What they prove locally |
|---|---|---|
| O01 | `mobile/__tests__/v1client.test.ts` (fresh request id per call, echoed id kept), `tests/api/test_logs.py::test_request_id_is_returned_and_logged` | App sends a 32-hex `X-Request-ID`; server validates, echoes and logs it |
| O02 | `tests/api/test_correlation.py::test_a_queued_job_is_linked_…`, `…::test_the_worker_logs_each_job_under_its_id…` | `job queued` carries request id + job id; worker lines and `ai_calls` carry the job id, ms and cost |
| O03 | `tests/api/test_correlation.py::test_a_retry_and_a_final_failure_are_logged…`, `mobile/__tests__/activity.events.test.tsx` | Failure code on retry/final failure; tokens, emails and signed-URL secrets redacted; client error keeps request id, never message |
| O04 | `tests/api/test_correlation.py::test_a_queued_job_is_linked_…` (same key → `job reused`, one job), `mobile/__tests__/v1client.test.ts` (resend keeps key and request id) | No second job on a resend; the original job stays linked |
| O05 | existing `mobile/__tests__/activity.track.test.ts` ("signing out sends what is left … the next account starts clean"), `tests/api/test_v1_items.py` two-user tests | Queue keyed by account; rows scoped by token |
| O06 | `tests/test_launch_metrics.py` (same day, 45 min same day, UTC boundary, >7 days) | Different-day KPI vs legacy 30-minute metric, labelled |
| O07 | `tests/test_launch_metrics.py::test_an_app_open_or_screen_view_is_not_a_meaningful_return` | App open, screen view, sign-in, zero-result outfit request don't count |
| O08 | `tests/test_launch_metrics.py::test_each_meaningful_action_counts_once…`, `…::test_accounts_never_mix` | Each meaningful action counts once, per account |
| O09 | existing `mobile/__tests__/activity.*` (tracking never throws), `tests/test_health_check.py` (broken alert hook) | Telemetry failures stay non-blocking |
| O10 | `tests/api/test_correlation.py::test_redact_*`, `tests/api/test_logs.py` | No tokens, emails, signed URLs, paths or query strings in log lines |
| O12 | `tests/test_launch_metrics.py::test_an_empty_cohort_has_no_rates`, `…::test_open_windows_are_counted_apart…`, `…::test_cohort_report_names_aliases_only` | Denominators, open windows apart, no made-up rate, aliases only |
| H05 | `tests/test_health_check.py` (stalled, stuck, queue, failures, budget, bad JSON, timeouts, 5xx) | A 200 with a stalled worker is critical |
| H07 | `tests/test_launch_metrics.py::test_timeline_lines_carry_ids_for_the_server_log` | Timeline shows request ids and job ids |

## P0 Mac & TestFlight readiness tests

| ID | What to do | Expected | Status |
|---|---|---|---|
| H01 | Verify Mac power and idle sleep over scheduled beta window | Mac remains online/awake as planned | NOT RUN |
| H02 | Check local 127.0.0.1:8000/healthz | FastAPI replies; worker metrics inspected | PASS 2026-11-02 — local /healthz healthy, worker metrics read by health_check |
| H03 | Check https://api.kipscloset.com/healthz from cellular/off-Mac device | Tunnel and API accessible from outside Mac network | PARTIAL — public URL healthy from the Mac; still to check from cellular |
| H04 | Controlled shutdown/failure of tunnel process on non-production test window | Off-Mac health check detects outage even if local API works | NOT RUN |
| H05 | API responds but worker stale/queued age high (mock or safe test) | Health evaluator marks worker unhealthy, not healthy by 200 alone | NOT RUN |
| H06 | Controlled restart during an authorized QA in-flight job | Job resumes or safely fails with explicit status; no duplicate item/credit | NOT RUN |
| H07 | Run authorization-safe tester timeline and AI cost report | Can identify onboarding drop-off, failure class and provider cost by job | PASS 2026-11-02 — live usage report: funnel, launch KPIs, reliability and AI cost by job; every job since ai_calls began (2026-10-22) has cost rows |
| H08 | Signed KIPS TestFlight build on actual iPhone over cellular | OTP → First 3 Pieces → first item → Closet across restart | NOT RUN |
| H09 | Five-user external beta group + link/email invite | Apple approval and group/builder confirmed, genuine URL used only when available | NOT RUN |
| H10 | Test crash reporting if vendor approved | Symbolicated error & safe PII scrubbing; privacy disclosure accurate | BLOCKED pending approval |

## Run log — 2026-11-02 (after deploying `5242ba1` to the Mac)

| Check | Where | Result |
|---|---|---|
| `pytest -q` | local, providers faked | 647 passed, 30 skipped |
| `pytest tests/integration` | local Supabase stack (Docker) | **30 passed** (two users, billing e2e, wallet, delete account, store, sweep) |
| `npx supabase test db` | local Supabase stack | **213 passed** — after scoping two `16_activity_events` assertions to their test user (they read the whole table and failed on 21 rows left in the shared local DB; no schema change) |
| `npx jest` · `npx tsc --noEmit` | local | 485 passed · clean |
| Live unauthenticated probes | `https://api.kipscloset.com` | request id echoed + logged; invalid id replaced; no token / fake JWT / other account's job → 401; Build My Look route on (401, not 404) |
| `scripts.health_check` local + public | the Mac | both healthy, exit 0 |
| Log privacy scan | `logs/server.jsonl*` on the Mac | 0 findings in 648 lines |
| `scripts.usage_report --days 30`, `--cohort` | hosted Supabase, read-only | works; findings: 36 AI jobs, 9 since `ai_calls` began, all with cost rows; one garment job failed on 2026-10-19 without a failure code (from before codes existed); onboarding events 0 for the 3 sign-ups (no account went through First 3 Pieces in this period) |

Not run here (need a phone, a real tester account or Apple): O02, O03, O06–O09 on live data, H01, H03 from cellular, H04, H06, H08–H10. Nothing was created, signed in to or changed on the production server for this QA.

## P1 after initial five if not needed for fault diagnosis

- Full backend OpenTelemetry exporter and multi-service trace visualization.
- Automated third-party alerts if none yet approved (document degraded manual alert strategy before GO).
- Visual dashboard UI on top of existing Supabase/report scripts; first five can use read-only CLI + a private sheet.

## The first incident drill

1. Ask a consenting QA user to do garment upload on an off-Mac mobile network.
2. Record approximate time and the optional app-side sanitized diagnostic ID.
3. Check server structured log `X-Request-ID`; locate `job_id` after successful submission.
4. Inspect the queue/worker and `ai_calls` outcome and estimated cost; verify no unexpected credit mutation.
5. Run private `scripts.usage_report --user <QA-account>` for meaningful events; never copy output to public issue.
6. Produce one sanitized internal issue summary with operation, build version, failure code, timings, redacted correlation identifiers and action taken.

## Release gate

**Must PASS:** O01–O12, H01–H03 and H05–H08; H09 once invitation is ready. Real live shutdown H04 can be simulated/read-only validated if intentionally taking the beta offline is not safe, but off-Mac detection must be verified at least once. H10 is optional until vendor/privacy approval, but residual crash diagnostic limitations must be documented.

Five testers are a qualitative pilot. Record exactly `2 of 5`, not grand claims from percentage swings. No test should be marked PASS just because code/tests were added.