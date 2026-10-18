# Multi-User M2 — User Data and Private Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postgres tables, privileges, RLS and a private Storage bucket that make every wardrobe row, job and image owned by exactly one user — proven by pgTAP tests with two accounts.

**Architecture:** Two SQL migrations under `supabase/migrations/` (tables + RLS; bucket + Storage policies) and pgTAP suites under `supabase/tests/database/`. Clients get read access to their own rows and column-limited updates on items; everything else is written by the backend with the secret key (M3). No app or API wiring in M2.

**Tech Stack:** Supabase CLI local stack (Postgres 17, Storage), pgTAP via `npx supabase test db`, `supabase gen types typescript`.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` (§5 model, §6 M2, §7 notes on grants)

## Global Constraints

- Hosted project: auto-expose OFF, automatic RLS ON. Migrations therefore `revoke all` from `anon, authenticated` on every new table/function and grant exactly what's needed (the local stack's default privileges grant everything, so the revoke makes local match hosted). `service_role` gets table privileges explicitly.
- Every policy: one operation, `to authenticated`, `(select auth.uid())` comparisons.
- Storage keys: `<user_id>/jobs/<job_id>/…` and `<user_id>/items/<item_id>/…` in private bucket `wardrobe`.
- `anon` gets nothing.
- Existing `cd mobile && npx jest && npx tsc --noEmit` and the Python suite stay green.

## Review Focus

1. A row pointing at another user's data: item with a job of user B, job with an item of user B, item/job paths under B's folder → rejected by composite FKs and path checks. (Task 1 tests.)
2. A client trying to change ownership or catalog images through an allowed update (`user_id`, `display_path`, `source_path`) → permission denied, not silently accepted. (Task 1 tests.)
3. A disabled account re-enabling itself via `profiles` → no update privilege. (Task 1 test.)
4. Listing the bucket root or another user's folder, or writing/deleting objects from the app → nothing visible, writes refused. (Task 2 tests.)
5. A new table added later without RLS → a test asserts every `public` table has RLS on. (Task 1 test.)

---

### Task 1: Tables, privileges and RLS

**Files:**
- Create: `supabase/migrations/20261018120000_wardrobe_schema.sql`
- Test: `supabase/tests/database/01_profiles.test.sql`, `02_wardrobe_items.test.sql`, `03_generation_jobs.test.sql` (each file creates its own two users inside its transaction)

**Schema (exact):**
- `profiles(id uuid pk → auth.users on delete cascade, email text, status text not null default 'active' check in ('active','disabled'), created_at timestamptz not null default now())`; trigger `on_auth_user_created` after insert on `auth.users` → `public.handle_new_user()` (security definer, `set search_path = ''`) inserts `(id, email)`.
- `generation_jobs(id uuid pk default gen_random_uuid(), user_id uuid not null → auth.users on delete cascade, item_id uuid, kind text not null check in ('garment','back','turn'), status text not null default 'queued' check in ('queued','running','succeeded','failed','canceled'), idempotency_key text not null check length 1..200, input_path text check (input_path like user_id || '/%'), result jsonb, error text, attempts int not null default 0 check >= 0, max_attempts int not null default 2 check >= 1, locked_until, created_at not null default now(), started_at, finished_at, unique (user_id, idempotency_key), unique (id, user_id), check ((kind = 'garment') = (item_id is null)))`.
- `wardrobe_items(id uuid pk default gen_random_uuid(), user_id uuid not null → auth.users on delete cascade, job_id uuid, piece_index int check >= 0, tier text, facts jsonb not null check object, facts_original jsonb, source_path text not null, source_kind text not null default 'original' check in ('original','crop'), display_path text not null, cutout_path text, crop_path text, back jsonb, turn jsonb, legacy_key text, deleted_at, created_at not null default now(), updated_at not null default now(), unique (id, user_id), unique (job_id, piece_index), unique (user_id, legacy_key), check ((job_id is null) = (piece_index is null)), every non-null *_path like user_id || '/%')`.
- Same-owner FKs: `wardrobe_items (job_id, user_id) → generation_jobs (id, user_id) on delete set null (job_id)`; `generation_jobs (item_id, user_id) → wardrobe_items (id, user_id) on delete cascade`.
- Indexes: `wardrobe_items (user_id, created_at desc) where deleted_at is null`, `generation_jobs (user_id, created_at desc)`, `generation_jobs (status, locked_until) where status in ('queued','running')`.
- Trigger `wardrobe_items_before_update` → `public.wardrobe_items_touch()`: sets `updated_at = now()`; if `facts` changed and `facts_original` is null, keeps the old `facts` in `facts_original` (today's `facts.original.json` behavior).
- Privileges: revoke all on the three tables from `anon, authenticated`; grant `select` on all three + `update (facts, deleted_at)` on `wardrobe_items` to `authenticated`; grant all on the three to `service_role`; revoke execute on both functions from `public, anon, authenticated`.
- RLS on all three; policies: profiles select own (`id`); items select own, items update own (using + with check); jobs select own.

- [ ] Write failing pgTAP suites. Helpers inline per file: insert two `auth.users` rows (A, B) as postgres, `set local role authenticated` + `set local request.jwt.claims` to act as A, `reset role` to return. Assertions:
  - profiles: trigger created both profiles with emails; A sees exactly 1 profile (own); A `update profiles set status='active'` throws `42501`; anon `select` throws `42501`; every table in `public` has `relrowsecurity`.
  - items (seeded as postgres for A and B): A sees only A's rows; A `update … set facts=…` on B's row affects 0 rows and B's facts unchanged; A updates own facts → `facts_original` holds old facts, `updated_at` advanced, second edit keeps first original; A sets own `deleted_at` and clears it; A updating `user_id`, `display_path`, `source_path` throws `42501`; A insert throws `42501`; A delete throws `42501`; anon select throws `42501`; as postgres: A item with path under B's folder fails (`23514`), A item referencing B's job fails (`23503`), duplicate `(user_id, legacy_key)` and `(job_id, piece_index)` fail (`23505`), job_id without piece_index fails (`23514`).
  - jobs: A sees only own; A insert/update/delete throw `42501`; duplicate `(user_id, idempotency_key)` fails; same key for B succeeds; garment job with item fails and back job without item fails (`23514`); A back job pointing at B's item fails (`23503`); input_path under B's folder fails; deleting an item cascades its back/turn jobs; deleting a garment job keeps its items with `job_id` null; deleting the auth user cascades profile, items, jobs.
- [ ] Run `npx supabase test db` → FAIL (relations missing).
- [ ] Write the migration; `npx supabase db reset` (local test data only).
- [ ] Run `npx supabase test db` → all pass. Commit `feat(db): wardrobe schema, grants and RLS`.

### Task 2: Private bucket and Storage policies

**Files:**
- Create: `supabase/migrations/20261018120100_wardrobe_storage.sql`
- Test: `supabase/tests/database/04_storage.test.sql`

**Interfaces:** bucket `wardrobe`: `public = false`, `file_size_limit = 25 MiB`, `allowed_mime_types = {image/png, image/jpeg, image/heic, image/heif, image/webp}`. One policy on `storage.objects`: select, `to authenticated`, `bucket_id = 'wardrobe' and (storage.foldername(name))[1] = (select auth.uid())::text`. No insert/update/delete policies.

- [ ] Write failing pgTAP: bucket exists and is not public; seeded objects (as postgres) `A/items/…`, `B/items/…`, and a root-level `stray.png`: A sees only `A/…`; A insert into `storage.objects` throws (RLS `42501`); A update/delete of B's object affects 0 rows; anon sees 0 rows; A sees none of B's even with a `name like 'B-uuid/%'` filter.
- [ ] Run → FAIL. Write migration, `npx supabase db reset`, run → PASS.
- [ ] Commit `feat(db): private wardrobe bucket and owner-only read policy`.

### Task 3: Types and docs

**Files:**
- Create: `mobile/src/api/database.types.ts` (`npx supabase gen types typescript --local`)
- Modify: `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` §5 (final schema notes: column grants instead of a trigger, composite same-owner FKs, path checks, profiles read-only), `docs/ROADMAP.md` (M2 ticked), `README.md` (how to run `npx supabase test db`; applying migrations to the hosted project is an owner step: `npx supabase link --project-ref xdzqwkqwfqvpovoftlyl` + `npx supabase db push`, needs the DB password)

- [ ] Generate types; `cd mobile && npx tsc --noEmit && npx jest` green; Python suite green; `npx supabase test db` green; `npx supabase db lint` reports no errors.
- [ ] Commit `docs: M2 schema notes, roadmap and types`.
