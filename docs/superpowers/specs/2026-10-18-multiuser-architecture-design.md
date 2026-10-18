# Multi-User Architecture — Research, Design and Milestones

Status: **Approved by the owner 2026-10-18** · Date: 2026-10-18 · Task: `docs/tasks/multiuser-architecture-implementation.md` (branch `docs/multiuser-task-prompt`, PR #3)

## 1. Intent

Digital Wardrobe works today for one person: an Expo Go app on the owner's iPhone talks over home Wi-Fi to a FastAPI server on the owner's Mac, which runs the Gemini pipeline and stores items as files under `runs/`. The next phase turns this into a product other people can use: each person signs in with their email, owns a private wardrobe that follows them across devices, and can never see anyone else's items, photos or jobs.

We keep what already works — the pipeline, the FastAPI app, the mobile screens — and add accounts, a database, private cloud storage and user-owned jobs around it, one reviewable milestone at a time.

**Goals:** email sign-in, persistent sessions, per-user isolation enforced by the database and the backend, private images, durable AI jobs that finish if the phone disconnects, safe migration of the owner's existing items, a data model ready for AI Credits.

**Non-goals (this phase):** payments, credit billing, social/sharing, Sign in with Apple, passwords, Android polish, rewriting the pipeline, outfit features.

**Anti-goals:** a client that can act as another user by sending their ID; permanent public image URLs; service-role/secret keys or Gemini keys in the app; duplicate items or double-billed AI calls from retries; breaking the owner's fast local loop (Expo Go + local server).

## 2. Research summary

| Topic | Finding | Effect on our design |
|---|---|---|
| Supabase Auth in Expo ([Expo tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native), [RN quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native)) | `@supabase/supabase-js` with `persistSession`, `autoRefreshToken`, `detectSessionInUrl: false`. Supabase's own Expo tutorial stores the session with a `LargeSecureStore`: an AES-256 key in `expo-secure-store` (Keychain; values > 2048 bytes don't fit) and the encrypted session in AsyncStorage. Refresh is paused/resumed with `startAutoRefresh`/`stopAutoRefresh` on AppState changes. | We use that exact pattern. All packages run in Expo Go, so no dev build is needed yet. |
| Email OTP vs magic link ([passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless)) | Same call (`signInWithOtp`); the email template decides link vs code. A code needs `{{ .Token }}` in the template and `verifyOtp({ email, token, type: 'email' })`. Magic links need deep-link redirect allow-lists; in Expo Go the `exp://<LAN-IP>` URL changes with the network. Default: 1 request / 60 s per user, 1 h expiry. | **Owner decision: 6-digit code.** No deep-link setup; works in Expo Go. Unknown emails sign up automatically (`shouldCreateUser` default true). |
| API keys ([API keys](https://supabase.com/docs/guides/api/api-keys)) | `sb_publishable_…` is safe in the app (power limited by RLS). `sb_secret_…` bypasses RLS and must stay on servers. Legacy `anon`/`service_role` JWT keys are scheduled for deprecation by end of 2026. | App gets URL + publishable key only. Backend gets the secret key (M3). We use the new key names from day one. |
| Verifying user tokens in FastAPI ([JWTs](https://supabase.com/docs/guides/auth/jwts), [PyJWT](https://pyjwt.readthedocs.io/en/stable/usage.html)) | With asymmetric signing keys (ES256/RS256), verify locally against `https://<ref>.supabase.co/auth/v1/.well-known/jwks.json` — check signature, `exp`, `iss`, `aud = authenticated`. Don't cache JWKS longer than ~10–20 min. Supabase strongly discourages verifying with the legacy shared HS256 secret; with legacy keys, call `GET /auth/v1/user` instead. | M3: a FastAPI dependency `current_user()` using `PyJWKClient` (cached, refetches on unknown `kid`). The user ID always comes from the verified `sub`, never from the request body/path. Owner must enable asymmetric JWT signing keys in the project. |
| Row Level Security ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)) | RLS on every exposed table; one policy per operation; `to authenticated`; `(select auth.uid()) = user_id` (cached per statement); `with check` on insert/update so `user_id` can't be reassigned; index every `user_id`; test with pgTAP (`supabase test db`). | Our M2 schema follows this verbatim, with pgTAP tests that use two users. |
| Private Storage ([access control](https://supabase.com/docs/guides/storage/security/access-control)) | Buckets deny everything until policies exist on `storage.objects`. Owner-only folder policy: `(storage.foldername(name))[1] = (select auth.jwt()->>'sub')`. Secret key bypasses Storage RLS. Images are read with short-lived signed URLs or authenticated downloads. | One private bucket `wardrobe`, keys `<user_id>/<item_id>/<file>`. App reads via signed URLs (≤ 1 h). Backend writes with the secret key, always under the verified user's folder. |
| Long-running jobs ([FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)) | FastAPI docs position `BackgroundTasks` for small in-process work and point to a queue (Celery + Redis/RabbitMQ) for heavy work. In-process tasks die with the process and aren't retried. | Today's request-held `/runs` call (15–60 s) and in-memory 360 tasks are not enough for hosted use. M3 uses a **Postgres job table as the queue** (claim with `FOR UPDATE SKIP LOCKED`) and a worker loop in the same Python codebase. No Redis/Celery for a small team. |
| Alternative: Firebase | Firebase Auth offers email *link* sign-in but no built-in 6-digit email code; Firestore is a document store (a credit ledger with balance invariants is clumsier than Postgres transactions/constraints); the Python Admin SDK verifies tokens well; native `@react-native-firebase` needs a dev build. | **Supabase stays.** It matches the owner's existing direction, gives SQL + RLS + Storage policies in one place, has a first-class Expo path that runs in Expo Go, and a relational ledger for credits later. |

## 3. Current state and documentation discrepancies

The code is the evidence; several planning docs (written 2026-10-15, before the app was built) describe a different product. Recorded here, to be reconciled in the PR that changes each area rather than silently:

1. `README.md` says "No mobile app has been scaffolded yet" — an Expo app, FastAPI server and Gemini pipeline exist.
2. `docs/ARCHITECTURE.md` proposes Supabase Edge Functions and "no custom application server"; the pipeline is Python (OpenCV, rembg, scikit-image) and lives in FastAPI. **Decision: keep FastAPI as the AI backend;** Edge Functions are not used.
3. PRD/SCREENS describe nine fixed categories, an explicit Save Item step, a pre-save Generated/Original toggle and Regenerate. The app instead auto-files results from each photo (one photo can yield several items), with free-text category plus colors/pattern/trims/visible text, white-background *and* cutout images, optional back photo, optional AI 360 view, and recoverable soft-delete. Multi-user work preserves **current** behavior; those PRD flows remain separate product decisions.
4. CLAUDE.md requires a retained **original** photo per item. Today only the per-item **crop** is kept; the full photo is a temp file and is not stored. M3 stores the original upload privately (`source.jpg`); migrated legacy items use `crop.png` as their source and are flagged `source_kind = 'crop'`.
5. Tabs are Home | Closet | Add (DESIGN.md), not Wardrobe | Add | Account. **Owner decision:** add a fourth **Account** tab → Home | Closet | Add | Account.
6. PRODUCT.md "Users: today the owner" and "no accounts" become outdated as milestones land; update at M4.

## 4. Recommended architecture

```text
iPhone (Expo app)
  ├─ Supabase Auth (email code) ── session in Keychain-backed LargeSecureStore
  ├─ Supabase Postgres via supabase-js (reads own items/jobs; RLS)        [M2]
  ├─ Supabase Storage signed URLs for own images                          [M2]
  └─ FastAPI  (Authorization: Bearer <Supabase access token>)             [M3]
        ├─ verifies JWT via JWKS → user_id
        ├─ uploads original → Storage <user>/<job>/upload.jpg, inserts generation_jobs row
        └─ worker loop (same codebase) claims jobs → existing pipeline → writes images to
           Storage <user>/<item>/… and rows with the secret key, always for job.user_id
Gemini — unchanged, called only by the backend.
```

Key decisions:
- **Who writes what:** the app may read its own rows and update user-editable fields (facts edits, soft delete). Creating items and job results is done only by the backend (items are products of AI jobs). This keeps item creation idempotent and tied to jobs.
- **Jobs survive disconnects:** the phone uploads, gets `202 {job_id}` and polls (or later subscribes via Realtime). The job row is the truth; a crashed worker's job is reclaimed after its lease (`locked_until`) expires, up to `max_attempts`.
- **Idempotency:** every job-creating request carries an `Idempotency-Key` header (UUID made by the app per user action); `unique (user_id, idempotency_key)` makes retries return the existing job instead of paying Gemini twice. Item rows created by a job carry `(job_id, piece_index)` unique, so a retried job can't duplicate items.
- **Local dev:** Supabase CLI (`npx supabase start`, Docker) gives a local Auth/Postgres/Storage with a mail catcher (Mailpit) for codes; the server keeps a `WARDROBE_AUTH=off` local mode during the transition so the owner's current loop keeps working until M3 lands. No production data or keys in development.

## 5. Data and storage model (built in M2)

> **As built (M2, `supabase/migrations/2026101812*`):** the model below, with these refinements. `profiles` is read-only to users (no update grant, so a disabled account can't re-enable itself). Client edits on items are limited by a **column-level grant** (`update (facts, deleted_at)`) rather than a trigger; a `before update` trigger bumps `updated_at` and keeps the first `facts` in `facts_original`. **Same-owner composite FKs** (`(job_id, user_id)` and `(item_id, user_id)`) make it impossible to link an item to another user's job or a job to another user's item, and **check constraints** require every stored path to start with `<user_id>/`. A garment job has no `item_id`; back/turn jobs must have one. Deleting a job keeps its items (`job_id` set null, `piece_index` kept); deleting an item cascades its back/turn jobs; deleting an account cascades everything. The bucket allows PNG/JPEG/HEIC/HEIF/WebP up to 25 MiB. pgTAP suites in `supabase/tests/database/` prove all of this with two accounts.

```sql
profiles          id uuid pk → auth.users(id) on delete cascade, email text, status text check in ('active','disabled') default 'active', created_at
wardrobe_items    id uuid pk, user_id uuid not null → auth.users, job_id uuid → generation_jobs, piece_index int,
                  tier text, facts jsonb not null, facts_original jsonb,
                  source_path text not null, source_kind text check in ('original','crop'),
                  display_path text not null,          -- generated.png (white bg) — the catalog image
                  cutout_path text, crop_path text,
                  back jsonb, turn jsonb,               -- paths/state of optional extras, as today's API
                  legacy_key text,                      -- runs/<run>/<photo>/<item> for idempotent migration
                  deleted_at timestamptz, created_at, updated_at,
                  unique (job_id, piece_index), unique (user_id, legacy_key)
generation_jobs   id uuid pk, user_id uuid not null, item_id uuid null → wardrobe_items,
                  kind text check in ('garment','back','turn'), status text check in ('queued','running','succeeded','failed','canceled'),
                  idempotency_key text not null, input_path text, result jsonb, error text,
                  attempts int default 0, max_attempts int default 2, locked_until timestamptz,
                  created_at, started_at, finished_at, unique (user_id, idempotency_key)
```

- Indexes: `wardrobe_items (user_id, created_at desc) where deleted_at is null`, `generation_jobs (user_id, created_at desc)`, `generation_jobs (status, locked_until)` for claiming.
- RLS: `profiles` select own row; `wardrobe_items` select own, update own (column grant limits updatable columns to `facts`, `deleted_at`); no client insert/delete (backend only; hard delete = backend purge job that removes both rows and Storage objects); `generation_jobs` select own only. All policies `to authenticated` with `(select auth.uid()) = user_id`. The hosted project does not auto-expose new tables, so each migration also `grant`s exactly the needed privileges to `authenticated` (e.g. `select, update` on `wardrobe_items`, `select` on `generation_jobs`) and nothing to `anon`.
- A trigger on `auth.users` insert creates the `profiles` row.
- Storage: private bucket `wardrobe`; objects `<user_id>/jobs/<job_id>/upload.<ext>` (inputs) and `<user_id>/items/<item_id>/{source,generated,cutout,crop}.png`, `…/back/*`, `…/turn/*`. Select policy: own folder only. No client insert/update/delete policies (backend writes). Signed URL TTL ≤ 1 h.
- Orphans: uploads whose job failed or was never claimed are swept after 7 days; items are written as Storage-first-then-row, and a sweep deletes Storage folders with no row.
- **Credits (future, not built):** `credit_wallets (user_id pk, balance int check (balance >= 0))` + append-only `credit_ledger (id, user_id, delta, reason, job_id unique null, created_at)`; a `reserve → settle/refund` pair around each billable job, done in the backend inside one transaction. Integration points: `generation_jobs` gets `cost_credits`; job creation reserves; job failure refunds. Nothing in M1–M4 needs to change for this.

## 6. Milestones

### M1 — Authentication foundation (this PR)
- **Implement:** Supabase client in the app (`mobile/src/auth/`): config resolution, `LargeSecureStore`, AppState refresh; `AuthProvider` (session state, send code, verify code, resend, sign out); Sign In screen (email step → 6-digit code step, resend after 60 s, change email, clear errors); authenticated navigation (signed-out users only see Sign In; tabs move to an `(tabs)` group); fourth **Account** tab showing email and Sign Out (with confirmation). **Local mode:** in development with no Supabase settings, the app behaves exactly as today and Account says "Local mode — not signed in"; a release build without settings shows a blocking "Sign-in isn't configured" screen. `supabase/` folder for the local CLI stack with the 6-digit code email template; `mobile/.env.example`; docs.
- **Files:** `mobile/app/_layout.tsx`, `mobile/app/(tabs)/{_layout,index,closet,add,account}.tsx`, `mobile/app/sign-in.tsx`, `mobile/src/auth/*`, `mobile/__tests__/auth/*`, `mobile/package.json`, `supabase/config.toml`, `supabase/templates/*`, `.env.example`, `docs/*`.
- **Not in M1:** backend token checks, database tables, sending the token to FastAPI.
- **Dependencies:** `@supabase/supabase-js`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js`, `expo-crypto` (random key), `react-native-url-polyfill`.
- **Risks:** session theft from device storage (mitigated by Keychain key + encryption); stale sessions after sign-out (clear storage, `signOut({ scope: 'local' })` fallback when offline); local mode accidentally shipping (blocked in release builds and tested).
- **Acceptance:** tests cover config modes, storage adapter round-trip and clearing, provider transitions (loading → signed out → code sent → signed in → signed out), invalid/expired code errors, rate-limit message, route guard, Account sign-out; `npx jest`, `npx tsc --noEmit`, Python suite unchanged and green. Manual: with the local Supabase stack, sign in on the phone, kill and reopen the app (still signed in), sign out.

### M2 — User data and private storage
- **Implement:** `supabase/migrations/*` for §5 tables, triggers, RLS, bucket + Storage policies; pgTAP tests proving user A cannot select/update/insert/delete user B's rows or read B's objects, and anon sees nothing; generated TS types.
- **Risks:** missing policy = data leak (pgTAP deny tests for every table/op); `user_id` reassignment (`with check` + column trigger).
- **Acceptance:** `supabase test db` green locally and in CI.

### M3 — Backend integration
- **Implement:** `api/auth.py` (`current_user` via JWKS), `api/storage.py` (Supabase Storage + DB via secret key, user-scoped helpers), job endpoints (`POST /jobs` garment/back/turn with `Idempotency-Key`, `GET /jobs/{id}`), worker loop (`python -m api.worker`) that wraps today's `run_photo`/`run_back`/`run_turn` unchanged and uploads results; app sends Bearer token, reads items from Supabase, polls jobs; legacy file routes kept behind `WARDROBE_AUTH=off`. Migration script `scripts/migrate_runs.py --user <email>`: idempotent by `legacy_key`, uploads each `runs/*/*/item_*` (incl. back/turn), `facts.original.json` → `facts_original`, `.trash` → `deleted_at`, dry-run + report, never deletes local files. Pick a host (container with a long-running worker, e.g. Fly.io/Railway/Cloud Run).
- **Risks:** IDOR on job/item routes (every query filtered by verified `user_id`; tests with two tokens); double charges (idempotency key + `(job_id, piece_index)` unique); worker crash mid-job (lease + reclaim); orphans (Storage-first writes + sweeper).
- **Acceptance:** API tests with two signed test tokens prove 404 on cross-user job/item/image access; job retry creates no duplicates; pipeline tests unchanged.

### M4 — End-to-end multi-user flow
Two real accounts on two devices: add, view, edit, soft-delete/restore, back photo, 360, failures and retries, restart persistence, sign-out clears local caches. Update PRODUCT.md, README, ARCHITECTURE, ROADMAP to the shipped state.

### M5 — Credit system readiness
Document the ledger/wallet integration points from §5 against PR #2's credits spec once merged; add `cost_credits` hooks where jobs are created; no purchasing.

## 7. What the owner must do (cannot be done by an agent)
Status 2026-10-18: items 1 and 5 are done (hosted project `digital-wardrobe`, Europe, free plan; Docker Desktop running). Item 2 is blocked on item 3.

1. ✅ Create a Supabase project; its **Project URL** and **publishable key** go in `mobile/.env` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Never put the secret key in `mobile/`. The project was created with "Automatically expose new tables" **off** and automatic RLS **on**, so M2 migrations must grant table privileges to `authenticated` explicitly.
2. ⏳ Auth → Email: put `{{ .Token }}` in the **Magic Link** template (text in `supabase/templates/magic_link.html`). Supabase only allows template edits once custom SMTP is configured; the default template contains only a link, which the app can't use.
3. ⏳ **TODO (owner):** create an account with a mail provider (e.g. Resend, Postmark, Amazon SES), verify a sending domain or address, and enter its SMTP settings under Auth → SMTP. Then do item 2 and delete `mobile/.env.local` so the app uses the hosted project.
4. M3: enable asymmetric JWT signing keys; create a secret key for the backend; choose a host.
5. ✅ Docker Desktop running for `npx supabase start`.

Until item 3 is done, development uses the local CLI stack: `mobile/.env.local` (git-ignored) overrides `mobile/.env` with the local URL (`http://<Mac LAN IP>:54321`) and the local publishable key. Switching between local and hosted is env-only; no code changes.

## 8. Calls made by the designer (owner may override)
- Supabase CLI local stack for development instead of a shared dev project.
- Postgres-as-queue instead of Redis/Celery.
- Backend-only item creation; client updates limited to facts + soft delete.
- One private bucket with user-ID first path segment.
- `LargeSecureStore` rather than plain AsyncStorage for the session.
- Unknown emails auto-create accounts (open sign-up); can be closed with `shouldCreateUser: false` if testers should be invite-only.
