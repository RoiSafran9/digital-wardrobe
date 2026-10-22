# Activity and operations logging — design

Status: **Proposed 2026-10-22, waiting for the owner's approval.** Nothing here is built yet.
Plan: [2026-10-22-activity-logging.md](../plans/2026-10-22-activity-logging.md).

## 1. Why

Before the friends-and-family TestFlight beta goes out, the owner wants to record every meaningful action in
KIPS so they can see how testers use it and what each one did: where people drop off, how long until the
first piece, what fails, what the AI costs per job and per person. Today some of this exists in pieces, much
of it is thrown away, and one part is already out of step with what the privacy page promises.

**Success:** after a week of beta, one command answers "how is the beta going?" (funnel, activation,
retention, feature use, failures, AI cost) and "what did this tester do?" (one account's timeline), with no
photo, text or device data stored for it, no new paid service, and no request slowed or broken by logging.

**Non-goals:** third-party analytics or crash SDKs, advertising or tracking, a hosted admin web app, real-time
alerting, A/B testing, session replay, anything about outfit styling.

**Anti-goals (a failure even if it works):** an event that holds a photo, a garment's details, printed text,
an email, a name or a device identifier; a request that fails or waits because an event couldn't be written;
the privacy page or the App Privacy answers saying something the app doesn't do; a second source of truth for
credits or jobs that can disagree with the real tables.

## 2. What is recorded today (as built, 2026-10-22)

| Source | What it holds | Where | Kept | Gaps |
|---|---|---|---|---|
| `activation_events` + `POST /v1/events` (First 3 Pieces) | 10 onboarding steps, allow-listed counts/choices, server time, 3 once-per-account milestones, 120/h per account | Postgres, backend-only (RLS on, no client grants) | 180 days (worker sweep), cascades on account deletion | Onboarding only; the event names are a DB `check` list, so every new event needs a hosted migration; one request per event; no app version or session |
| `generation_jobs` | every AI job and free scan: kind, status, error text, attempts, `cost_credits`, `max_items`, created/started/finished, `progress`, outfit picks/corrections | Postgres | indefinitely (files swept, rows stay) | No failure category (only the user-facing message), no models used, no AI cost, no per-call latency; refused requests (402/409/429/503) leave no row |
| `credit_ledger` / `credit_wallets` | every grant, hold, charge, release with action and job | Postgres, append-only | until account deletion | Complete for credits — the source of truth; nothing to add |
| `wardrobe_items` | items with `created_at`, `deleted_at`, `facts_original` (set on first edit), `origin`, `review_state`, `back`, `turn` | Postgres | soft delete; cascades with account | Shows *that* an item was edited/deleted, not *when* or how often; outfit discard and closet delete look the same |
| `profiles` | `created_at` (sign-up), status | Postgres | with account | No sign-in history (Supabase's `auth.users.last_sign_in_at` keeps only the last) |
| `push_tokens` | one row per phone that turned on "Notify when ready" | Postgres | with account | Enough as is; enabling/disabling isn't an event |
| `RunLogger` (`pipeline/run_log.py`) | per model call: stage, model, prompt version, latency, ok/error, `cost_usd` (never filled) | `run_log.jsonl` | **local mode:** kept in `runs/`. **account mode:** written to the job's temp dir and **deleted when the job ends** | The per-call record the owner most needs for cost and fallback is lost in account mode; no token counts |
| Server stdout/stderr | `log.exception` tracebacks, the Gemini fallback warning | the terminal tab | until the tab scrolls or closes | Logging is never configured, so `log.info` lines (sweep counts, purges) are dropped; no request log; nothing searchable |
| `GET /healthz` | queue depth, oldest queued, worker heartbeat, AI jobs today, pause switch | computed live | — | No failure rate or "fallback model active" |
| Apple TestFlight | native crash reports and screenshot feedback from testers | App Store Connect | Apple's | Free; covers native crashes, not JavaScript errors |

**The privacy gap already open:** `docs/APP_STORE_CONNECT.md` §5 answers *"Usage Data, Diagnostics … no"* and
*"no analytics"*, and `kipscloset.com/privacy/` doesn't mention usage records — but `activation_events` already
records onboarding steps linked to the account. Milestone L0 fixes the texts before anything else ships.

## 3. Decisions (my calls, open to the owner's correction)

1. **No third-party analytics or crash service.** Everything lives in the Supabase Postgres the app already
   uses (free tier; the expected volume is a few thousand rows a week) plus local log files on the server.
   PostHog/Amplitude/Sentry would add a processor to the privacy page and App Privacy, a new SDK in an Expo Go
   app, and a vendor account, for dashboards the beta's size doesn't need. Revisit at public launch.
2. **The server is the source of truth.** Anything the server does or refuses is recorded by the server, from
   the verified token — never by the app saying it happened. The real tables stay authoritative: credits come
   from `credit_ledger`, jobs and their outcomes from `generation_jobs`, pieces from `wardrobe_items`, sign-up
   from `profiles`. Events add only what no table records (sign-ins, refusals, edits, discards, UI-only steps).
   The app reports only what happens on the phone (app opened, a screen reached, a sheet cancelled, a
   permission denied, a JavaScript error) and those are labelled `source = 'app'`.
3. **Three stores, three jobs:**
   - `activity_events` — product analytics: who did what, when (the renamed and widened `activation_events`).
   - `ai_calls` — operations/cost: one row per model call (model, stage, latency, tokens, estimated cost,
     fallback, outcome), written by the worker from the `RunLogger` entries it now throws away.
   - Server log files — debugging: JSON lines with a request id, kept 14 days on the Mac, never in Postgres.
4. **Event names are allow-listed in code, not in the database.** `api/activity.py` keeps the list and the
   allowed properties (counts and fixed choices only, as `api/events.py` does today); the database checks only
   the name's shape (`^[a-z][a-z0-9_]{2,47}$`) and the props size, so adding an event is a code change, not a
   hosted SQL paste.
5. **Logging never breaks or slows a request.** Server events are written after the response (FastAPI
   `BackgroundTasks`) or in the worker after the job's own state is saved; every write is wrapped so a failure
   becomes one warning log line. The app queues events and sends them in batches; a send failure keeps them
   for the next try, and the queue drops the oldest beyond a cap.
6. **Reading it:** SQL views in a private `reports` schema (not exposed to the app's API keys) plus one report
   script, `scripts/usage_report.py`, that replaces `scripts/activation_report.py`. No web dashboard in the beta;
   the Supabase SQL editor can query the same views.
7. **Retention:** `activity_events` 180 days (as today); `ai_calls` 400 days (a year of cost history); server
   log files 14 days. All three are purged by the worker's existing sweep / log rotation.

## 4. What gets recorded

Event properties are only whole numbers (0–1000), booleans or values from a fixed list. Ids that are already
the account's own rows (`job_id`, `item_id`) go in their own columns, not in props. Never: photos, crops,
garment facts, printed text, names, emails, free text, error messages, IP addresses, device ids, push tokens.

### 4.1 Recorded by the server (`source = 'server'`)

| Event | Where | Props | Why a table isn't enough |
|---|---|---|---|
| `signed_in` | `POST /v1/bootstrap` (the app calls it after every sign-in) | `first` (bool: first bootstrap for the account) | Supabase keeps only the last sign-in |
| `welcome_granted` | bootstrap, when credits were granted | `credits` | in the ledger too; kept for the timeline |
| `refused` | 402 / 409 / 429 / 503 on job-creating routes and `/v1/events` | `route` (fixed list: `garment_scan`, `garment_generate`, `job`, `back`, `turn`, `outfit_scan`, `outfit_generate`, `regenerate`), `reason` from the status (`no_credits` 402, `conflict` 409, `rate_limited` 429, `unavailable` 503 — paused or daily cap; recorded once by the request-log middleware, not at each raise) | refusals leave no row |
| `item_edited` | `PATCH /v1/items/{id}` | `field` (one event per changed field, from the fixed `ItemPatch` field names); `first` (bool: the item's first edit) | only the first edit is visible today |
| `item_deleted` | `DELETE /v1/items/{id}` | `review` (`pending` = outfit discard, `kept`/`none` = closet removal) | `deleted_at` can't tell a discard from a removal |
| `item_kept` | `POST /v1/items/{id}/keep` | — | `review_state` loses when |
| `region_added` | `POST /v1/outfit-scans/{id}/regions` | `category` (fixed list) | not stored once the scan expires |
| `job_finished` | worker, after `finish_job` / `_fail` | `kind`, `status` (`succeeded`/`failed`), `failure` (code, §4.3), `seconds` (queued→finished), `pieces_made`, `pieces_failed`, `attempts` | the job row has this, but swept scans and the timeline read better with one row; **the job row stays the truth** |
| `account_deleted` | `DELETE /v1/account` | — | written to the server log only (the account's rows are gone); see open decision D1 |
| `push_enabled` / `push_disabled` | `POST`/`DELETE /v1/push-token` | — | the token row has no history |

Job starts are **not** separate events: every `generation_jobs` row is already one, with its `kind`,
`created_at`, `max_items`, picks and price. The views read them directly.

### 4.2 Reported by the app (`source = 'app'`)

| Event | When | Props |
|---|---|---|
| (all 10 First 3 Pieces events) | unchanged | unchanged |
| `app_opened` | cold start or back to foreground after ≥ 30 min | `cold` (bool) |
| `screen_viewed` | first view of a key screen per session | `screen` (fixed list: `home`, `closet`, `add`, `account`, `camera`, `preview`, `processing`, `results`, `outfit_detect`, `outfit_pick`, `outfit_review`, `item`, `price_list`, `credits_activity`, `help`) |
| `cost_sheet` | a price confirmation closes | `action` (`garment`, `back`, `turn`, `outfit`, `regenerate`), `choice` (`confirmed`, `cancelled`), `pieces` |
| `out_of_credits_shown` | the insufficient-credits sheet opens | `action` |
| `permission` | camera, photos or notifications answered | `kind` (`camera`, `photos`, `notifications`), `granted` (bool) |
| `capture_source` | a photo enters the garment or outfit flow | `flow` (`garment`, `outfit`), `from` (`camera`, `library`) |
| `item_opened` | an item sheet opens from the closet | `has_back`, `has_turn` (bools) |
| `client_error` | the error boundary or global JS handler catches an error, or an API call fails with a network error | `where` (screen from the list above or `global`), `kind` (`render`, `unhandled`, `network`, `http_5xx`), never the message or stack |

Every app event also carries `session_id` (a random UUID made fresh each time the app opens; not tied to the device), `app_version` and `client_event_id` (a UUID, the idempotency key), and the time it
happened on the phone (`client_at`, kept for ordering; `created_at` stays the server's time).

### 4.3 Failure codes (on `generation_jobs.failure_code` and `job_finished`)

`photo_quality` (the quality check said retake), `no_garment` (detection found nothing usable), `item_gone`,
`scan_expired`, `model_timeout`, `model_refused` (safety/no image returned), `model_error` (other provider
error), `all_pieces_failed`, `internal` (anything else). Set by the worker where it already decides the
user-facing message; the message itself is unchanged.

### 4.4 AI calls (`ai_calls`)

One row per model call, from the entries `RunLogger` already writes, plus: `job_id`, `user_id`, `attempt`,
`input_tokens` and `output_tokens` (from Gemini's `usage_metadata`), `images_out`, `fallback` (the fallback
image model answered), `error_class` (the exception type, never its message) and `est_cost_usd` = tokens × the model's rate from a
dated table in `pipeline/costs.py` (filled from Google's published Gemini prices when built, with the date; the
owner keeps it current). It is an estimate for trends, not a bill. The
worker inserts a job's rows in one batch after the job ends, success or failure. In local mode `run_log.jsonl`
stays as is.

### 4.5 Server operations log

Python `logging` configured once in `api/main.py`: JSON lines (`ts`, `level`, `logger`, `msg`, `request_id`,
`user_id` when known, `job_id`), to stderr (the terminal tab, as today) and to `logs/server.jsonl` rotated daily,
14 files kept (`logs/` gitignored). A small middleware logs each request: method, **route template** (e.g.
`/v1/items/{item_id}`, never the filled-in path or query), status, milliseconds, request id (also returned as
`X-Request-ID`). Uvicorn's access log is turned off so client addresses aren't written. `/healthz` gains
`failed_jobs_last_hour` and `image_model` (which model is in use).

## 5. Storage

```sql
-- renamed from activation_events; existing rows keep their meaning (source = 'app')
activity_events(
  id bigint identity pk,
  user_id uuid not null references auth.users on delete cascade,
  event text not null check (event ~ '^[a-z][a-z0-9_]{2,47}$'),
  source text not null default 'app' check (source in ('app','server')),
  props jsonb not null default '{}' (object, ≤ 1 KB),
  job_id uuid, item_id uuid,            -- no FK: events outlive swept scans and deleted items
  session_id uuid, app_version text check (length ≤ 20),
  client_event_id uuid, client_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)     -- app retries are no-ops
)
-- kept: the once-per-account milestone index, the (user_id, created_at) and (created_at) indexes

ai_calls(
  id bigint identity pk,
  job_id uuid references generation_jobs on delete set null,
  user_id uuid references auth.users on delete set null,   -- see D1
  job_kind text, stage text not null, model text not null, prompt_version text,
  attempt int, status text check (status in ('ok','error')), error_class text,
  latency_ms int, input_tokens int, output_tokens int, images_out int,
  fallback boolean not null default false, est_cost_usd numeric(10,5),
  created_at timestamptz not null default now()
)

generation_jobs.failure_code text check (failure_code in (…§4.3…))
```

Both tables: RLS on, no grants to `anon`/`authenticated`, `service_role` only — the app never reads or writes
them directly, as with `activation_events` today. Views live in a new schema `reports` with `usage` revoked
from `anon` and `authenticated` (Postgres views bypass RLS, so they must not sit in `public`).

**Hosted rollout:** each migration is a single file the owner pastes into the Supabase SQL editor; the plan
lists them in order. The rename is safe whether or not `activation_events` already reached hosted (the
migration creates the table if it's missing).

## 6. How the owner reads it

`python -m scripts.usage_report --days 30` prints:

1. **Funnel** — sign-ups → first sign-in → onboarding started → first scan → first generate → first piece →
   3 pieces → second session with a new piece.
2. **Activation** — time to first piece and to three pieces (median, p75), first-session activation (from the
   existing report, unchanged).
3. **Retention** — accounts active (any server event, job or app open) on day 1, day 7 and week 2 after
   sign-up; weekly active accounts.
4. **Feature use** — accounts and counts for garment photo, outfit photo, back, 360, edit, outfit
   keep/discard/regenerate, missed-garment regions; cost-sheet cancel rate per action.
5. **Reliability** — jobs by kind: success rate, failure codes, median/p95 queued→finished seconds; refusals
   by reason; app `client_error` counts by screen.
6. **AI cost** — estimated USD per job kind, per account (median, max), per credit charged, total per day;
   share of image calls on the fallback model; retries' share of cost.
7. **Credits** — granted, charged, released, held now (from `credit_ledger`).

`python -m scripts.usage_report --user <email or id>` prints one account's timeline: sign-ins, app sessions,
screens, jobs with outcome and cost, credits, edits, deletes — no photos, facts or text (see D2).

`--json` gives the same numbers for pasting elsewhere. The SQL behind each section is a `reports.*` view so
the owner can also open it in the Supabase SQL editor.

## 7. Privacy

- Stored per event: the account id, the event name, allow-listed numbers/choices, own row ids, app version,
  a per-session random id, times. Nothing else, enforced by the allow-list on the server (unknown names or
  props → 400, as today).
- Account deletion: `activity_events` rows go with the account (cascade, as today). `ai_calls` keep their
  cost numbers with `user_id` and `job_id` set to null (D1). Server log lines carrying the user id age out
  within 14 days. Nothing else about a deleted account remains.
- **Privacy page** (`site/public/privacy/index.html`) gains a "Usage records" paragraph: what is kept (the
  steps you take in the app, the AI jobs you start and how they went, errors), that it's linked to your account,
  never includes photos or text, isn't shared or used for advertising, is kept 180 days (cost records 400 days
  without your account), server logs 14 days, and goes with Delete Account.
- **App Privacy answers** (`docs/APP_STORE_CONNECT.md` §5): *Usage Data → Product Interaction* — collected,
  linked, not tracking, purposes *Analytics* and *App Functionality*; *Diagnostics → Other Diagnostic Data*
  (`client_error`, job failures) — collected, linked, not tracking, *App Functionality*. *Crash Data* stays
  "no" (Apple's own TestFlight crash reports aren't collected by the app). Tracking stays **No**.
- Both texts change in L0, before any new event ships, and are kept in step with the allow-list from then on
  (the plan adds a test that fails when an allow-listed event has no line in the privacy text's source list).

## 8. Reliability and performance

- Server events: `record(store, user_id, event, props, **ids)` in `api/activity.py`; validates, then inserts.
  Routes call it through `BackgroundTasks` (after the response is sent). The worker calls it after the job's
  state is saved. Any exception → one `warning` log line, never re-raised.
- `ai_calls`: one batch insert per job, inside a `try`, after `finish_job`/`_fail`; a failed insert loses that
  job's cost rows and logs a warning.
- App: `track()` keeps its signature; events go to an in-memory queue mirrored to AsyncStorage
  (`activity.queue.{user}`), sent by `POST /v1/events/batch` (≤ 50 events) every 30 s, when the app goes to the
  background, and when 20 are waiting. A failed send keeps the events; the queue keeps at most 500 (oldest
  dropped). The server accepts a batch partially: invalid events are skipped and counted in the reply, never a
  400 for the whole batch. The per-account limit becomes 600 events per hour. Sign-out flushes then clears the
  queue; another account never sends the previous one's events.
- Compatibility: TestFlight build 7 already sends single events to `POST /v1/events`; that endpoint stays and
  writes the same table. Local mode (no accounts) records nothing new; `run_log.jsonl` stays.
- Idempotency: `unique (user_id, client_event_id)` makes a resent batch a no-op; once-per-account milestones
  keep their index. Server events are best effort; job outcomes are exact because they come from the job row.
- Volume: ~50–150 events per active tester per day; at 20 testers, under 100k rows in 180 days — well inside the
  free Postgres tier.

## 9. Tests

- **pytest:** allow-list (unknown name/prop → rejected; counts bounded; every route's event matches the list);
  batch endpoint (partial accept, idempotent resend, 600/h limit, another account's ids ignored); `record()`
  swallows a store failure and the request still returns its normal status; each server event fires once at its
  route; worker writes `ai_calls` for a succeeded, a failed and a retried job, with tokens, fallback and cost;
  `failure_code` for each path; request middleware logs the route template, not the path; report metrics on a
  seeded `MemoryStore`; `--user` timeline contains no facts/text; account deletion removes events and nulls
  `ai_calls`; purge respects 180 / 400 days.
- **pgTAP:** `activity_events`, `ai_calls` and `reports.*` deny `anon`/`authenticated`; name-shape and size
  checks; `unique (user_id, client_event_id)`; cascade / set-null on deleting a user; existing
  `activation_events` tests carried over.
- **jest:** queue batches at 20, flushes on background, survives restart from AsyncStorage, caps at 500, drops
  nothing on a failed send, never throws into a screen, clears on sign-out; error boundary reports
  `client_error` without the message.
- **Manual:** one beta-style session on the phone (sign in, onboarding, garment, outfit, back, 360, edit,
  delete), then `usage_report --user` shows it in order; kill the network mid-session and see the events arrive later.

## 10. Milestones

| # | What | Before beta invites? |
|---|---|---|
| L0 | Privacy page + App Privacy answers made true for what is already recorded and what this plan adds | **yes — first** |
| L1 | Server operations log: JSON logging, request ids, rotating file, route-template request log, `/healthz` additions | yes |
| L2 | `ai_calls` + token capture + `failure_code` | yes (the cost questions start on day one) |
| L3 | `activity_events` (rename + widen) and server events | yes |
| L4 | App event queue, batch endpoint, app events, error boundary | yes, in the next TestFlight build |
| L5 | `reports` views + `scripts/usage_report.py` (+ `--user`) | can follow in the first beta week; the data is already being kept |
| L6 | Docs (ARCHITECTURE, DEPLOY, ROADMAP), hosted SQL, phone check | with each milestone / at the end |

## 11. Open decisions (the owner's)

- **D1 — After Delete Account, keep cost rows without the account?** *Recommendation: yes* — `ai_calls` keep
  model, latency and cost with the account and job removed, so the beta's total AI spend stays right; no other
  trace remains. The alternative deletes them too (simplest promise; the cost totals then drop when someone
  leaves).
- **D2 — A per-tester timeline (`--user`) for the owner?** *Recommendation: yes*, disclosed on the privacy page
  ("the developer can see the steps your account took, never your photos"). It's the direct answer to "what did
  this user do?", and in a 20-person beta it is how support questions get answered. The alternative is
  aggregate-only reports (still identifiable in a group this small).
- **D3 — Approve the new privacy-page paragraph and App Privacy answers (L0) and publish the page now**,
  before the next build? *Recommendation: yes, now* — the page is already behind what `activation_events`
  records. The text is in the plan's L0 task for the owner to read before it goes live.

Everything else in §3 is my call (no third-party tool, Postgres + log files, retention 180/400/14 days, no web
dashboard, TestFlight for native crashes) and can be changed without reworking the plan.
