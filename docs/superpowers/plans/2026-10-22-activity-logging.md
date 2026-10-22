# Activity and Operations Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Status: **Waiting for the owner's approval (and D1–D3 in the spec §11). Do not start before that.**

**Goal:** Record every meaningful action in KIPS — server-side truth plus a few app-side events — with per-model-call AI cost, a structured server log and one report script, without storing personal content or slowing any request.

**Architecture:** Product events go to `activity_events` (the renamed, widened `activation_events`) written by the server from the verified token and by the app through a batched endpoint; per-model-call cost goes to `ai_calls`, filled by the worker from the `RunLogger` entries it now discards; debugging goes to JSON log files on the Mac. `scripts/usage_report.py` reads the real tables (`generation_jobs`, `credit_ledger`, `wardrobe_items`, `profiles`) plus these two.

**Tech Stack:** FastAPI, Python 3.11 stdlib `logging`, Supabase Postgres (migrations + pgTAP), Expo / TypeScript (AsyncStorage, expo-constants — both already in Expo Go), Jest.

**Spec:** [docs/superpowers/specs/2026-10-22-activity-logging-design.md](../specs/2026-10-22-activity-logging-design.md)

## Global Constraints

- Event props: whole numbers 0–1000, booleans, or values from a fixed list. Never photos, garment facts, printed text, names, emails, free text, error messages, IPs, device ids or push tokens.
- The user id comes only from the verified token. `activity_events`, `ai_calls` and `reports.*`: no grants to `anon`/`authenticated`.
- Logging never raises into a request or a job: every write is wrapped; failure = one `warning` log line.
- Retention: `activity_events` 180 days, `ai_calls` 400 days, `logs/server.jsonl*` 14 daily files.
- `POST /v1/events` (single event, used by TestFlight build 7) keeps working unchanged.
- Local mode (no `WARDROBE_AUTH`) records nothing new and keeps `run_log.jsonl`.
- No new paid service, no new native dependency.
- Each migration is one file the owner can paste into the hosted SQL editor; say so in the hand-off with the file path.
- Commit straight to `main`, small commits, `Co-Authored-By` trailer per the session's attribution rule.
- Checks after each task: `PYTHONPATH=$PWD /Users/roisafran/Desktop/my_wardrobe/.venv/bin/pytest -q`; for app tasks `cd mobile && npx jest && npx tsc --noEmit`; for migrations `npx supabase test db` (local stack).

## Review Focus

1. **A store failure during event recording** (Supabase down, constraint error) — the user's request still returns its normal status and body. Test in Task 8 (`test_event_write_failure_never_breaks_the_route`).
2. **A batch from the app containing another account's ids or a bad event** — valid events are stored for the token's account only; the bad one is skipped, not a 400. Test in Task 10.
3. **A job that fails on attempt 1 and succeeds on attempt 2** — `ai_calls` holds both attempts' calls (real cost), `job_finished` is recorded once. Test in Task 6.
4. **Sign-out and sign-in as another account on the same phone** — queued events of account A are sent with A's token or dropped, never with B's. Test in Task 11.
5. **A filled-in path in logs** (`/v1/items/<uuid>`) — the request log writes the route template only. Test in Task 3.

---

## File map

| File | Responsibility |
|---|---|
| `site/public/privacy/index.html`, `docs/APP_STORE_CONNECT.md` | L0 privacy truth |
| `api/logs.py` (new) | logging config, JSON formatter, request-id/user-id context, request-log middleware |
| `pipeline/run_log.py`, `pipeline/types.py`, `pipeline/providers/gemini.py` | token counts + fallback flag on each run-log entry |
| `pipeline/costs.py` (new) | dated per-model rates, `estimate_usd()` |
| `api/activity.py` (new; replaces `api/events.py`) | event allow-list, `validate()`, `record()` |
| `api/worker.py` | failure codes, `ai_calls` batch, `job_finished`, purges |
| `api/store.py` | `insert_events`, `insert_ai_calls`, `finish_job(..., failure_code)`, purges, report rows — both stores |
| `api/routes/v1.py`, `api/routes/health.py`, `api/main.py`, `api/schemas.py` | server events, batch endpoint, healthz fields, wiring |
| `supabase/migrations/20261022120000_ai_calls.sql`, `…130000_activity_events.sql`, `…140000_reports.sql` | schema |
| `supabase/tests/database/17_ai_calls.test.sql`, `16_activation_events.test.sql` → `16_activity_events.test.sql`, `18_reports.test.sql` | pgTAP |
| `mobile/src/activity/queue.ts`, `mobile/src/activity/track.ts` (new), `mobile/src/firstPieces/analytics.ts`, `mobile/src/api/v1.ts`, `mobile/src/api/client.ts`, `mobile/src/ui/ErrorBoundary.tsx` (new), `mobile/app/_layout.tsx` + key screens | app events |
| `scripts/usage_report.py` (new; `scripts/activation_report.py` removed, its metrics moved in) | the owner's report |
| `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`, `docs/ROADMAP.md`, `.gitignore` | docs |

---

## L0 — Privacy truth

### Task 1: Privacy page and App Privacy answers

**Files:**
- Modify: `site/public/privacy/index.html` (after the "What is stored" section), `docs/APP_STORE_CONNECT.md` §5
- Test: `tests/test_privacy_text.py`

**Interfaces:** Produces `PRIVACY_EVENT_NAMES` check used by Task 8 (the test reads `api.activity.EVENTS` once it exists; until then `api.events.EVENTS`).

- [ ] **Step 1: Write the failing test** `test_privacy_page_mentions_usage_records`: reads the HTML, asserts it contains `"Usage records"`, `"180 days"`, `"14 days"`, `"never your photos"`; and `test_app_privacy_answers_declare_usage_data`: asserts `APP_STORE_CONNECT.md` contains `"Usage Data → Product Interaction | yes"` and no longer contains `"no analytics"`.
- [ ] **Step 2: Run** `pytest tests/test_privacy_text.py -v` → FAIL.
- [ ] **Step 3: Add this section to the privacy page** (exact copy; the owner approves it as D3), and bump "Last updated" to the publish date:

  > **Usage records.** To understand how the beta is used and fix what breaks, KIPS keeps a record of the steps your account takes in the app — for example signing in, starting onboarding, scanning a photo, creating, editing or removing a piece, and errors — and of each AI job: how long it took, whether it worked and its estimated cost. These records are linked to your account and include the app version, but never your photos, the details of your pieces, any text you type, your email or your device's identifiers. They are not shared with anyone or used for advertising. The developer can see the steps your account took, never your photos. Usage records are kept for 180 days; cost records are kept for 400 days, separated from your account when you delete it. Server logs are kept for 14 days. Delete Account removes your usage records.

  In `APP_STORE_CONNECT.md` §5: change the intro line to "(no advertising, no tracking, no purchases; usage records for analytics)", replace the "Usage Data, Diagnostics…" row with `Usage Data → Product Interaction | yes | yes | no | Analytics, App Functionality`, add `Diagnostics → Other Diagnostic Data | yes | yes | no | App Functionality` and `Usage Data → Advertising Data, Diagnostics → Crash Data, Location, Purchases, Financial Info | no`. (If D1 = delete cost rows too, drop "cost records are kept for 400 days, separated from your account"; if D2 = no, drop "The developer can see…".)
- [ ] **Step 4: Run** the test → PASS.
- [ ] **Step 5: Commit** `docs(privacy): declare usage records on the privacy page and App Privacy`. Hand-off note: the owner publishes with `cd site && npx wrangler deploy` (outward-facing — agents don't run it).

---

## L1 — Server operations log

### Task 2: JSON logging to stderr and a rotating file

**Files:** Create `api/logs.py`; modify `api/main.py`, `.gitignore` (`logs/`), `Dockerfile` CMD (`--no-access-log`), README run command (`--no-access-log`). Test: `tests/api/test_logs.py`.

**Interfaces — Produces:**
- `configure_logging(directory: str | None = "logs", level: int = logging.INFO) -> None` — idempotent; JSON handler on stderr; if `directory`, a `TimedRotatingFileHandler(f"{directory}/server.jsonl", when="midnight", backupCount=14, utc=True)`.
- `request_id: ContextVar[str | None]`, `user_id: ContextVar[str | None]`, `job_id: ContextVar[str | None]` — added to every record by `JsonFormatter`.
- `JsonFormatter.format(record) -> str` — one JSON object: `ts` (ISO UTC), `level`, `logger`, `msg`, `request_id`, `user_id`, `job_id` (omitted when None), `exc` (traceback text) when `exc_info`.

- [ ] **Step 1: Failing tests:** `test_log_line_is_json_with_context` (set `request_id`/`user_id` vars, log `"hello"`, parse the line: `msg == "hello"`, ids present, `level == "INFO"`); `test_info_lines_are_kept` (a `wardrobe.worker` info line reaches the handler — today it is dropped); `test_file_handler_rotates_daily_keeping_14` (handler's `when == "MIDNIGHT"`, `backupCount == 14`); `test_configure_twice_adds_no_second_handler`.
- [ ] **Step 2: Run** → FAIL (no module).
- [ ] **Step 3: Implement** `api/logs.py`; call `configure_logging()` at the top of `create_app` only in account mode (local mode keeps stdlib defaults; pass `directory=None` when `WARDROBE_LOG_DIR=off`).
- [ ] **Step 4: Run** → PASS; full pytest green.
- [ ] **Step 5: Commit** `feat(api): JSON server logs with daily rotation`.

### Task 3: Request log middleware and `/healthz` additions

**Files:** Modify `api/logs.py`, `api/auth.py` (`current_user` sets `request.state.user_id = user.id`), `tests/api/v1_helpers.py` (`fake_user` does the same; `v1_client` installs the middleware), `api/main.py`, `api/routes/health.py`, `api/store.py` (`count_failed_jobs_since(since) -> int` in both stores). Test: `tests/api/test_logs.py`, `tests/api/test_beta_controls.py`.

**Interfaces — Produces:** `add_request_log(app: FastAPI, on_response: Callable[[Request, int], None] | None = None) -> None` — HTTP middleware: new `request_id` (uuid4 hex, or the incoming `X-Request-ID` if it matches `^[0-9a-f]{32}$`), sets the context var, returns it as `X-Request-ID`, logs `{"msg": "request", "method", "route", "status", "ms"}` at INFO where `route = request.scope["route"].path` when matched, else `"unmatched"`; then calls `on_response(request, status)` inside `try/except` (Task 9 uses this for refusals).

- [ ] **Step 1: Failing tests:** `test_request_log_uses_the_route_template` (GET `/v1/items/<uuid>` → logged `route == "/v1/items/{item_id}"`, the uuid appears nowhere in the line); `test_request_id_is_returned_and_logged`; `test_unmatched_path_is_not_logged_verbatim` (GET `/nope/secret` → `route == "unmatched"`, `"secret"` not in line); `test_healthz_reports_failures_and_image_model` (`failed_jobs_last_hour` counts jobs with `status == "failed"` and `finished_at` within 3600 s; `image_model == gemini.image_model()`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; wire `add_request_log(app)` in `create_app` (account mode).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): request log by route template, request ids, healthz failure count`.

---

## L2 — AI cost per call

### Task 4: Token counts, fallback flag and cost estimate on run-log entries

**Files:** Modify `pipeline/types.py` (`RunLogEntry`), `pipeline/run_log.py`, `pipeline/providers/gemini.py`; create `pipeline/costs.py`. Test: `tests/test_run_log.py`, `tests/providers/test_gemini*.py` (existing fakes), `tests/test_costs.py`.

**Interfaces — Produces:**
- `RunLogEntry` gains `input_tokens: int | None = None`, `output_tokens: int | None = None`, `images_out: int | None = None`, `fallback: bool = False`, `error_class: str | None = None`, `ts: datetime` (default now UTC). `error` stays for local mode only.
- `RunLogger.log(..., input_tokens=None, output_tokens=None, images_out=None, fallback=False, error_class=None)`.
- `GeminiProvider._log(stage, model, prompt_version, start, status, error=None, response=None)` — reads `response.usage_metadata.prompt_token_count` / `candidates_token_count` when present, counts image parts in the response for `images_out`, sets `fallback = model == MODEL_IMAGE_FALLBACK`, `error_class = type(error).__name__` when an exception is passed (callers pass the exception, not `str(e)`).
- `pipeline/costs.py`: `RATES: dict[str, dict]` keyed by model → `{"input_per_m": float, "output_per_m": float, "as_of": "YYYY-MM-DD"}`, `estimate_usd(model: str, input_tokens: int | None, output_tokens: int | None) -> float | None` (None for an unknown model or missing tokens).

- [ ] **Step 1: Failing tests:** `test_entry_round_trips_new_fields`; `test_old_lines_without_new_fields_still_read` (a v1 JSON line parses); `test_log_reads_usage_metadata` (fake response with `usage_metadata(prompt_token_count=1200, candidates_token_count=1290)` and one inline image part → entry has those numbers and `images_out == 1`); `test_fallback_call_is_flagged` (provider with `_image_model_gone = True` → `fallback is True`); `test_error_entry_keeps_class_not_message`; `test_estimate_usd` (`estimate_usd(m, 1_000_000, 0) == RATES[m]["input_per_m"]` for each model; unknown model → None).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Fill `RATES` for `gemini-3.1-flash-lite`, `gemini-2.5-flash-image`, `gemini-3.1-flash-image` from Google's published Gemini API price page on the day of implementation, `as_of` that date, image output priced as output tokens. Do not guess a rate: if a model's price can't be found, leave it out (estimate = None) and say so in the hand-off.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(pipeline): token counts, fallback flag and cost estimate per model call`.

### Task 5: `ai_calls` table and `generation_jobs.failure_code`

**Files:** Create `supabase/migrations/20261022120000_ai_calls.sql`, `supabase/tests/database/17_ai_calls.test.sql`.

**Interfaces — Produces:** table `public.ai_calls` exactly as spec §5 (`latency_ms int`, `est_cost_usd numeric(10,5)`, `status in ('ok','error')`, `stage`/`model` not null, `error_class` length ≤ 80, `job_kind` length ≤ 30); indexes `(created_at)`, `(user_id, created_at)`, `(job_id)`; RLS on; `revoke all … from anon, authenticated; grant all … to service_role`. Column `generation_jobs.failure_code text check (failure_code in ('photo_quality','no_garment','item_gone','scan_expired','model_timeout','model_refused','model_error','all_pieces_failed','internal'))`.

- [ ] **Step 1: Failing pgTAP:** `anon`/`authenticated` can't select/insert `ai_calls`; deleting a user sets `ai_calls.user_id` null and keeps the row (D1 = keep; if D1 = delete, `on delete cascade` and assert the row is gone); deleting a job sets `job_id` null; an unknown `failure_code` is rejected.
- [ ] **Step 2: Run** `npx supabase test db` → FAIL.
- [ ] **Step 3: Write the migration** (header comment: what it's for, backend-only, retention 400 days by the worker).
- [ ] **Step 4: Run** → PASS (after `npx supabase db reset` locally).
- [ ] **Step 5: Commit** `feat(db): ai_calls and job failure codes`.

### Task 6: Worker writes `ai_calls` and failure codes

**Files:** Modify `api/worker.py`, `api/store.py` (both stores). Test: `tests/api/test_worker.py`, `tests/api/test_worker_ai_calls.py` (new).

**Interfaces:**
- Consumes: `RunLogger.read_all()`, `estimate_usd()` (Task 4).
- Produces: `store.insert_ai_calls(rows: list[dict]) -> None`; `store.finish_job(job_id, status, result=None, error=None, failure_code=None)`; `store.purge_ai_calls(before: datetime) -> int`; `JobRejected(message, code: str)`; `worker._ai_call_rows(job: dict, tmp: str) -> list[dict]` (reads every `*.jsonl` in `tmp`, maps entries to rows with `job_id`, `user_id`, `job_kind`, `attempt = job["attempts"]`, `est_cost_usd`); `worker.AI_CALLS_RETENTION_DAYS = 400`.

- [ ] **Step 1: Failing tests:** `test_succeeded_job_writes_its_model_calls` (fake providers that log 1 detect + 2 generate entries → 3 rows, kinds/models/tokens/cost carried); `test_failed_job_still_writes_its_calls`; `test_retried_job_keeps_both_attempts` (attempt 1 raises after one call, attempt 2 succeeds → rows with `attempt` 1 and 2); `test_ai_calls_insert_failure_does_not_fail_the_job` (store raises in `insert_ai_calls` → job still `succeeded`, a warning logged); `test_failure_codes` (parametrised: quality retake → `photo_quality`; nothing detected → `no_garment`; item deleted → `item_gone`; expired scan → `scan_expired`; `asyncio.TimeoutError` from the provider on the last attempt → `model_timeout`; other exception → `internal`; outfit job where every pick failed → `all_pieces_failed`); `test_sweep_purges_ai_calls_after_400_days`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** In `run_once`, keep the `TemporaryDirectory` open around the handler *and* the `finally` that calls `_ai_call_rows` + `insert_ai_calls` (wrapped). Each `raise JobRejected(...)` passes its code; `_fail` takes `code` and passes it to `finish_job`. Map `model_refused` where the provider reports no image returned. Add `purge_ai_calls` to `_sweep_now`. Leave user-facing messages unchanged.
- [ ] **Step 4: Run** → PASS, full suite green.
- [ ] **Step 5: Commit** `feat(worker): keep each model call's cost and a failure code per job`.

---

## L3 — Activity events (server)

### Task 7: Rename `activation_events` → `activity_events` and widen it

**Files:** Create `supabase/migrations/20261022130000_activity_events.sql`; rename `supabase/tests/database/16_activation_events.test.sql` → `16_activity_events.test.sql` and extend.

**Interfaces — Produces:** table `public.activity_events` per spec §5. The migration: `create table if not exists public.activation_events (…as in 20261020120000…)` guard is not needed locally, but for hosted use a `do $$ … if to_regclass('public.activation_events') is not null then alter table … rename to activity_events; else create table …; end if $$`; drop the old event `check`, add the shape check, `source`, `job_id`, `item_id`, `session_id`, `app_version`, `client_event_id`, `client_at`; `unique (user_id, client_event_id)`; rename indexes to `activity_events_*`; keep the once-only partial index.

- [ ] **Step 1: Failing pgTAP:** a name not matching the shape is rejected; `source` must be `app`/`server`; a second row with the same `(user_id, client_event_id)` fails; two rows with null `client_event_id` are fine; the once-only milestone index still holds; `anon`/`authenticated` denied; deleting the user removes the rows.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the migration.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(db): activity_events replaces activation_events`.

### Task 8: `api/activity.py` — allow-list and `record()`

**Files:** Create `api/activity.py` (move `api/events.py` content in; delete `api/events.py`, update imports in `api/routes/v1.py`, `api/worker.py`, tests); modify `api/store.py` (both stores: `insert_events(rows: list[dict]) -> int` returning rows written with `on conflict do nothing`; table name `activity_events`; `purge_events` unchanged in meaning). Test: `tests/api/test_activity.py` (new), `tests/api/test_v1_events.py` (updated), `tests/test_privacy_text.py`.

**Interfaces — Produces:**
- `EVENTS: dict[str, dict[str, object]]` — the existing 10 plus every event in spec §4.1 and §4.2 with their props; value rules `COUNT`, `BOOL`, or a `set` of strings.
- `SERVER_EVENTS: frozenset[str]` (§4.1 names) — the app may not send these (`validate(..., source="app")` rejects them).
- `validate(event: str, props: dict | None, source: str = "app") -> dict`.
- `record(store, user_id: str, event: str, props: dict | None = None, *, job_id: str | None = None, item_id: str | None = None) -> None` — validates with `source="server"`, inserts one row with `source="server"`; any exception → `log.warning("activity event %s not recorded", event, exc_info=True)`; never raises.
- `EVENTS_PER_HOUR = 600`, `RETENTION_DAYS = 180`, `ONCE` unchanged.

- [ ] **Step 1: Failing tests:** `test_app_cannot_send_server_events`; `test_bool_props` (`True` ok, `1` rejected for a BOOL); every existing `test_v1_events.py` case still passes against `activity_events`; `test_event_write_failure_never_breaks_the_route` (store whose `insert_events` raises → `record()` returns None and logs a warning); `test_every_event_is_named_in_the_privacy_source_list` (a module-level `PRIVACY_CATEGORIES: dict[str, str]` in `api/activity.py` maps each event to one of the categories named on the privacy page — "signing in", "onboarding", "scanning", "creating", "editing", "removing", "errors", "app use"; the test asserts every `EVENTS` key is mapped).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): activity event allow-list with server-side recording`.

### Task 9: Server events at their routes, in the worker and for refusals

**Files:** Modify `api/routes/v1.py`, `api/worker.py`, `api/main.py`. Test: `tests/api/test_v1_activity.py` (new), `tests/api/test_worker.py`.

**Interfaces:** Consumes `record()` (Task 8), `add_request_log(app, on_response)` (Task 3).
- Routes take `background: BackgroundTasks` and call `background.add_task(record, store, user.id, …)` only **after** their own work succeeded: `bootstrap` → `signed_in {first}` (`first` = no earlier `signed_in` for the user: `store.has_event(user_id, "signed_in") -> bool`, both stores) and `welcome_granted {credits}` when granted; `edit_item` → one `item_edited {field, first}` per changed top-level facts field (`field` from a fixed set = `ItemPatch` field names; `first = item["facts_original"] is None` before the update); `delete_item` → `item_deleted {review}` (`pending`/`kept`/`none` from `review_state`); `keep_item` → `item_kept`; `add_region` → `region_added {category}`; push token POST/DELETE → `push_enabled`/`push_disabled`; `delete_account` → log line `account deleted` at INFO with no event.
- Worker: after `finish_job` / `_fail`, `record(store, job["user_id"], "job_finished", {...}, job_id=job["id"])` with `kind`, `status`, `failure` (failed only), `seconds` (min(1000, finished − created)), `pieces_made`, `pieces_failed`, `attempts`. Not on a retry.
- `refusal_recorder(store) -> Callable[[Request, int], None]` in `api/activity.py`: when `status in {402, 409, 429, 503}`, the request has `state.user_id`, and the matched route template is in `REFUSAL_ROUTES: dict[str, str]` (template → `route` prop, the 8 values in spec §4.1), records `refused {route, reason}`. Passed to `add_request_log` in `create_app` and `v1_client`.

- [ ] **Step 1: Failing tests:** one per event above asserting exactly one row with the right props and `source == "server"`; `test_failed_edit_records_nothing` (400 patch → no event); `test_discard_vs_remove` (`review` = `pending` for a pending outfit result, `none` for a garment item); `test_no_credits_refusal_is_recorded` (billing on, empty wallet, POST `/v1/jobs` → 402 and one `refused {route: "job", reason: "no_credits"}`); `test_paused_refusal` (`WARDROBE_GENERATION=off` → `unavailable`); `test_unauthenticated_401_records_nothing`; `test_job_finished_once_per_job_not_per_attempt`; `test_second_bootstrap_is_not_first`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): record sign-ins, edits, deletes, refusals and job outcomes`.

---

## L4 — App events

### Task 10: `POST /v1/events/batch`

**Files:** Modify `api/schemas.py`, `api/routes/v1.py`. Test: `tests/api/test_v1_events.py`.

**Interfaces — Produces:**
- `EventBatchItem(BaseModel)`: `event: str`, `props: dict[str, Any] | None`, `client_event_id: UUID`, `client_at: datetime`, `session_id: UUID | None`; `EventBatchIn`: `app_version: str` (≤ 20 chars, `^[0-9A-Za-z.\-+ ()]+$`), `events: list[EventBatchItem]` (1–50).
- `POST /v1/events/batch` → `200 {"stored": int, "skipped": int}`; invalid items skipped (unknown name, bad props, server-only name); `client_at` clamped to [now − 7 days, now]; `429` only when the account already has ≥ `EVENTS_PER_HOUR` this hour (then nothing stored). `item_id`/`job_id` are never taken from the app.
- The single `POST /v1/events` stays as is (now writing `activity_events`, `source = 'app'`).

- [ ] **Step 1: Failing tests:** `test_batch_stores_valid_and_skips_invalid` (3 good + 1 unknown + 1 server-only → `stored 3, skipped 2`); `test_resent_batch_is_a_no_op` (same `client_event_id`s → `stored 0`, row count unchanged); `test_batch_rows_belong_to_the_token_account` (A's token → rows with A's id whatever the body says; a `user_id` key in props is rejected as an unknown prop); `test_batch_rate_limit`; `test_client_at_clamped`; `test_51_events_rejected_422`; `test_single_event_endpoint_still_works`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): batched app events`.

### Task 11: App event queue

**Files:** Create `mobile/src/activity/queue.ts`, `mobile/src/activity/track.ts`, `mobile/__tests__/activity-queue.test.ts`; modify `mobile/src/api/v1.ts` (`postEventBatch(account, body) -> Promise<{stored: number; skipped: number}>`), `mobile/src/api/client.ts` (export `postEventBatch` that no-ops in local mode), `mobile/src/firstPieces/analytics.ts` (`track` delegates to the new one, keeping its typed `Events`), `mobile/src/auth/AuthProvider.tsx` (start/stop the queue per account).

**Interfaces — Produces:**
- `createQueue(opts: { userId: string; send: (events: QueuedEvent[]) => Promise<void>; storage?: Storage; now?: () => number }) -> { add(e: Omit<QueuedEvent, "client_event_id" | "client_at" | "session_id">): void; flush(): Promise<void>; stop(): Promise<void> }` — persists to AsyncStorage key `activity.queue.${userId}`; sends ≤ 50 per call; auto-flush at 20 queued, every 30 s, on `AppState` → `background`; keeps at most 500 (drops oldest); on send failure keeps the events; `stop()` flushes once then clears memory and detaches listeners.
- `startActivity(account) / stopActivity()` in `track.ts`, and `track(event, props)` that adds to the current account's queue (no-op when signed out or in local mode). `session_id` regenerated on cold start and on foreground after ≥ 30 min, when `app_opened` is also queued. `app_version` from `expo-constants` (`Constants.expoConfig?.version` + build number).

- [ ] **Step 1: Failing tests:** `queues and sends a batch at 20`; `flushes on background`; `restores unsent events after a restart`; `keeps at most 500, dropping oldest`; `keeps events when sending fails and resends the same client_event_id`; `stop flushes then clears; a new account never sends the old account's events` (queue A stopped, queue B started → B's send never receives A's ids); `track never throws` (send rejects synchronously); `new session after 30 minutes in background records app_opened`.
- [ ] **Step 2: Run** `cd mobile && npx jest activity-queue` → FAIL. **Step 3: Implement.** **Step 4: Run** jest + `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(app): batched, persistent activity queue`.

### Task 12: App events at their screens and the error boundary

**Files:** Create `mobile/src/ui/ErrorBoundary.tsx`; modify `mobile/app/_layout.tsx` (wrap the navigator; `ErrorUtils.setGlobalHandler` chaining the previous handler), the screens for `screen_viewed` (the 15 in spec §4.2, via a `useScreenViewed(screen)` hook in `track.ts` that fires once per session per screen), `mobile/src/ui/CostSheet.tsx` (`cost_sheet`), `InsufficientCreditsSheet` (`out_of_credits_shown`), camera/library/notification permission call sites (`permission`), capture entry points (`capture_source`), `ItemSheet` (`item_opened`), `mobile/src/api/v1.ts` `call()` (`client_error {kind: "network" | "http_5xx", where}` — `where` passed by the caller's screen or `global`). Tests: `mobile/__tests__/activity-events.test.tsx`.

**Interfaces:** Consumes `track()` and `useScreenViewed()` (Task 11). The `Events` type in `track.ts` lists every app event with its props, mirroring `api/activity.py`.

- [ ] **Step 1: Failing tests:** `error boundary reports client_error without message or stack` (assert queued props are exactly `{where, kind: "render"}`) and still shows its fallback; `cost sheet reports confirmed and cancelled with the action and pieces`; `screen_viewed fires once per session per screen`; `a 503 from the API reports http_5xx once`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** jest + tsc → PASS.
- [ ] **Step 5: Commit** `feat(app): app activity events and error boundary`.

---

## L5 — Reading it

### Task 13: `reports` schema views

**Files:** Create `supabase/migrations/20261022140000_reports.sql`, `supabase/tests/database/18_reports.test.sql`.

**Interfaces — Produces** (schema `reports`, `revoke all on schema reports from public, anon, authenticated; grant usage to service_role`), for the SQL editor:
- `reports.timeline(user_id, at, source, what, detail jsonb)` — union of `activity_events`, `generation_jobs` (created/finished, kind, status, failure_code, cost_credits), `credit_ledger` (kind, amount, action), `wardrobe_items` created/deleted; no `facts`, paths or text columns.
- `reports.job_outcomes(day, kind, jobs, succeeded, failed, p50_seconds, p95_seconds)`.
- `reports.ai_cost_daily(day, job_kind, model, calls, fallback_calls, est_cost_usd)`.
- `reports.daily_active(day, accounts)` — distinct users with any event, job or ledger row that day.

- [ ] **Step 1: Failing pgTAP:** `anon`/`authenticated` can't select any `reports.*`; `timeline` has no column named `facts`, `email`, `display_name`, `*_path`; a seeded user's job + event + grant appear in `timeline` in time order; `job_outcomes` counts a seeded success and failure.
- [ ] **Step 2: Run** → FAIL. **Step 3: Write the migration.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(db): reports views for the SQL editor`.

### Task 14: `scripts/usage_report.py`

**Files:** Create `scripts/usage_report.py`, `tests/test_usage_report.py`; delete `scripts/activation_report.py` (its `metrics()` moves in as the Activation section; its tests move to the new file); modify `api/store.py` (`usage_rows(since: datetime) -> dict` returning `signups, items, events, jobs, ledger, ai_calls`; `user_rows(user_id) -> dict` same keys for one account, no `facts`/paths; `find_user(email_or_id) -> str | None` — both stores).

**Interfaces — Produces:** `metrics(rows: dict, now: datetime) -> dict` with keys `funnel`, `activation` (the old report's numbers, same names), `retention` (`d1`, `d7`, `w2` rates by sign-up cohort, `weekly_active`), `features`, `reliability`, `ai_cost`, `credits`; `report(m: dict) -> str`; `timeline(rows: dict) -> str`; `main(argv=None, store=None, now=None) -> str` with `--days N` (default 30), `--user EMAIL_OR_ID`, `--json`.
Definitions (fixed here so the numbers mean one thing): an account is **active on a day** if it has any `activity_events` row, `generation_jobs` row or ledger `hold`/`charge` that UTC day; **d1** = active on the day after sign-up; **d7** = active on any of days 6–8; **w2** = active in days 8–14; funnel steps in spec §6 order, "second session with a new piece" = an item created ≥ 30 min after the first item (the existing `SECOND_IMPORT_GAP_MINUTES`); cost per account = sum of `ai_calls.est_cost_usd` (median, max); cost per credit = AI cost of priced jobs ÷ credits charged.

- [ ] **Step 1: Failing tests** on a seeded `MemoryStore` (two accounts, fixed `now`): `test_activation_numbers_unchanged` (the old report's seeded expectations still hold); `test_retention_d1_d7`; `test_funnel_order_and_counts`; `test_feature_use_counts_back_turn_outfit_edit`; `test_reliability_failure_codes_and_p95`; `test_ai_cost_per_account_and_fallback_share`; `test_credits_totals_match_ledger`; `test_timeline_in_order_without_facts_or_paths` (seed an item with facts text `"SECRET PRINT"` → absent from output); `test_unknown_user_says_so`; `test_json_flag_outputs_parseable_json`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(scripts): usage report and per-account timeline`.

---

## L6 — Docs, hosted rollout, phone check

### Task 15: Docs and hand-off

**Files:** Modify `docs/ARCHITECTURE.md` (replace "Activation analytics" with "Activity and operations logging": the three stores, events list pointer to `api/activity.py`, retention, reports), `docs/DEPLOY.md` (§1: `--no-access-log`, `logs/`, `WARDROBE_LOG_DIR`; replace the activation report line with `python -m scripts.usage_report`; list the three migrations in order), `docs/ROADMAP.md` (beta line "analytics" → built; mark cost monitoring partly built — alerts still open), `docs/PRD.md` if it mentions analytics.

- [ ] **Step 1:** Update the docs as listed; run full checks (pytest, jest, tsc, `npx supabase test db`); note any that couldn't run.
- [ ] **Step 2: Commit** `docs: activity and operations logging as built`.
- [ ] **Step 3: Owner hand-off** (in the final message, not done by an agent): (1) paste `20261020120000_activation_events.sql` first if it isn't on hosted yet, then `20261022120000_ai_calls.sql`, `20261022130000_activity_events.sql`, `20261022140000_reports.sql` into the hosted SQL editor, in that order; (2) restart the server with `--no-access-log`; (3) `cd site && npx wrangler deploy` for the privacy page (after D3); (4) the App Privacy answers in App Store Connect when asked; (5) the next TestFlight build carries L4; (6) phone check: one full session, then `python -m scripts.usage_report --user <your email>` shows it in order; turn on airplane mode mid-session and see the events arrive after.

---

## Order and parallel work

- L0 first (Task 1). Then two independent tracks: **server** L1 → L2 → L3 (Tasks 2–9, one writer: they share `api/worker.py`, `api/store.py`, `api/routes/v1.py`) and, once Task 10 lands, **app** L4 (Tasks 11–12, only `mobile/`). L5 needs L2 + L3. Task 15 last.
- Before beta invites: L0–L3 on the server and L4 in the TestFlight build. L5 can follow in the first beta week: the data is kept from the moment L2/L3 run.
