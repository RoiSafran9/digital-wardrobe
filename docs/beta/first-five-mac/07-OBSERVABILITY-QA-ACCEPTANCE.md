# Observability and Mac Beta — Acceptance & QA Matrix

**Status:** Test design. All cases are **NOT RUN** until executed in the actual environment. Code merged is not proof that App Store Connect, live Mac, tunnel or AI costs are working.

## P0 engineering and telemetry tests

| ID | Scenario | Expected evidence | Status |
|---|---|---|---|
| O01 | Authenticated request from iPhone/QA client | Response `X-Request-ID` validated; sanitized client operation links to server request log | NOT RUN |
| O02 | Job creation then provider success | Client request maps to durable job ID, worker attempt, model stage and finish event | NOT RUN |
| O03 | Scan/Generate error | Error code/latency/account-scoped job diagnostic, NO raw photo, token, prompt or signed URL | NOT RUN |
| O04 | Retry same idempotency key after timeout | Same job, no double generation/charge; new request correlation without losing original job link | NOT RUN |
| O05 | Sign out Account A, sign in B | No A timeline/diagnostics/wardrobe items leak to B; client queue stays keyed by account | NOT RUN |
| O06 | Same-day second item vs next-day item | Correct separate-day repeat import KPI; legacy 30-minute metric clearly named | NOT RUN |
| O07 | Mere app open or background job poll | Does **not** count as meaningful next-day return | NOT RUN |
| O08 | One new item on later day / opened own item | Meaningful return counts once for the correct account and cohort | NOT RUN |
| O09 | Client diagnostics unavailable | App still works and telemetry failures remain nonblocking | NOT RUN |
| O10 | App/worker logs | Never contain auth tokens, email, photo bytes/URLs, raw prompts, OCR, user-entered names | NOT RUN |
| O11 | Out-of-scope user or fabricated ID | RLS and ownership protection; no leak into report or response | NOT RUN |
| O12 | Five-account summary with empty/new cohorts | Counts and denominators correct, no fabricated percentages or hidden unknowns | NOT RUN |

## P0 Mac & TestFlight readiness tests

| ID | What to do | Expected | Status |
|---|---|---|---|
| H01 | Verify Mac power and idle sleep over scheduled beta window | Mac remains online/awake as planned | NOT RUN |
| H02 | Check local 127.0.0.1:8000/healthz | FastAPI replies; worker metrics inspected | NOT RUN |
| H03 | Check https://api.kipscloset.com/healthz from cellular/off-Mac device | Tunnel and API accessible from outside Mac network | NOT RUN |
| H04 | Controlled shutdown/failure of tunnel process on non-production test window | Off-Mac health check detects outage even if local API works | NOT RUN |
| H05 | API responds but worker stale/queued age high (mock or safe test) | Health evaluator marks worker unhealthy, not healthy by 200 alone | NOT RUN |
| H06 | Controlled restart during an authorized QA in-flight job | Job resumes or safely fails with explicit status; no duplicate item/credit | NOT RUN |
| H07 | Run authorization-safe tester timeline and AI cost report | Can identify onboarding drop-off, failure class and provider cost by job | NOT RUN |
| H08 | Signed KIPS TestFlight build on actual iPhone over cellular | OTP → First 3 Pieces → first item → Closet across restart | NOT RUN |
| H09 | Five-user external beta group + link/email invite | Apple approval and group/builder confirmed, genuine URL used only when available | NOT RUN |
| H10 | Test crash reporting if vendor approved | Symbolicated error & safe PII scrubbing; privacy disclosure accurate | BLOCKED pending approval |

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