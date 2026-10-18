# Multi-User M3a — Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With `WARDROBE_AUTH=on`, FastAPI identifies each caller from their Supabase access token, queues AI work as user-owned jobs in Postgres, runs the existing pipeline in a worker, stores results in the private bucket and serves each user only their own items — while `WARDROBE_AUTH=off` (default) keeps today's local file-based API unchanged.

**Architecture:** M3 is split in two PRs. **M3a (this plan): backend + `runs/` migration script.** M3b: the app sends the token, uses the `/v1` API and polls jobs. In M3a, new modules sit beside the legacy ones: `api/auth.py` (JWKS verification), `api/store.py` (Supabase REST/Storage over httpx with the secret key, plus an in-memory `MemoryStore` used by tests), `api/routes/v1.py` (user-scoped endpoints), `api/worker.py` (claims jobs and wraps `run_photo`/`run_back`/`run_turn` by rebuilding today's item folder layout in a temp dir), one migration adding the `claim_generation_job` function, and `scripts/migrate_runs.py`. `api/main.py` mounts legacy routers when auth is off, the v1 router and the in-process worker when it's on.

**Tech Stack:** FastAPI, httpx, PyJWT[crypto] (`PyJWKClient`), Supabase local stack (ES256 JWKS), pytest.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` (§4, §5, §6 M3)

## Global Constraints

- Default `WARDROBE_AUTH=off`: legacy routes and `runs/` behavior byte-for-byte as today; all existing tests pass untouched.
- With auth on, the user id comes only from the verified token `sub`. Accept only asymmetric tokens (ES256/RS256) from `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`; check `exp`, `aud == "authenticated"`, `iss == SUPABASE_JWT_ISSUER` (default `{SUPABASE_URL}/auth/v1`). HS256/legacy tokens → 401.
- Backend env: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (never logged, never returned), optional `SUPABASE_PUBLIC_URL` (host the phone uses for signed URLs; default `SUPABASE_URL`), `SUPABASE_JWT_ISSUER`. Startup with auth on and either required var missing → refuse to start with a clear message.
- Storage keys: `<uid>/jobs/<job_id>/upload<ext>`, `<uid>/items/<item_id>/{source,crop,generated,cutout}.png`, `…/back/{crop,generated,cutout}.png`, `…/turn/{view}.png|{view}_cutout.png`. Signed URL TTL 3600 s.
- Cross-user access answers **404** (never 403), so IDs can't be probed.
- Every job-creating request needs an `Idempotency-Key` header (1–200 chars); a repeat returns the existing job (200) instead of a new one (202).
- No extra model calls; pipeline code under `pipeline/` unchanged.
- Never touch `runs/` except reading it in the migration script's dry run.

## Review Focus

1. Token edge cases: missing/garbled header, `Bearer` with no token, expired, wrong audience, wrong issuer, HS256-signed, unknown `kid` → 401 with no detail leak. (Task 1 tests.)
2. User B using user A's job/item IDs on every v1 route (get job, patch, delete, back, turn, list) → 404 and A's data unchanged. (Task 3 tests.)
3. A retried upload with the same `Idempotency-Key` after a timeout → same job, one upload kept, no second pipeline run. (Task 2 tests.)
4. A worker that dies mid-job → the job is reclaimed after its lease and finishes; a job failing past `max_attempts` ends `failed` with a user-facing message, and its partial files are removed. (Task 4 tests.)
5. Migration dry run on odd `runs/` content (retake-only items, trashed items, missing facts, back/turn folders) → reported, never written. (Task 5 tests.)

---

### Task 1: Settings and token verification

**Files:** Create `api/auth.py`; modify `pyproject.toml` (add `httpx`, `pyjwt[crypto]` to dependencies); test `tests/api/test_auth.py`.

**Interfaces — Produces:**
- `@dataclass(frozen=True) class Settings: auth_on: bool; supabase_url: str; secret_key: str; public_url: str; issuer: str`; `load_settings(env: Mapping[str, str] = os.environ) -> Settings` (raises `RuntimeError` naming the missing var when auth is on).
- `@dataclass(frozen=True) class User: id: str; email: str | None`.
- `class TokenVerifier: __init__(self, jwks_url: str, issuer: str, jwk_client=None); verify(self, token: str) -> User` (raises `InvalidToken`).
- FastAPI dependency `current_user(request) -> User` using `get_verifier()` (overridable); 401 `{"error": "sign in again"}` on any failure.

- [ ] Failing tests with a generated EC P-256 key and a fake JWK client: valid token → `User(sub, email)`; each Review Focus #1 case → `InvalidToken`; `current_user` maps failure to 401 with the fixed body; `load_settings` defaults off, requires URL + secret when on, derives `public_url`/`issuer`.
- [ ] Run `pytest tests/api/test_auth.py` → FAIL. Implement with `jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=600)`, `algorithms=["ES256", "RS256"]`. Run → PASS. Commit `feat(api): Supabase token verification`.

### Task 2: Store and job creation

**Files:** Create `api/store.py`, `supabase/migrations/20261018130000_claim_generation_job.sql`, `api/routes/v1.py` (jobs part); test `tests/api/test_store_memory.py`, `tests/api/test_v1_jobs.py`, `supabase/tests/database/05_claim_job.test.sql`.

**Interfaces — Produces (`Store` protocol, implemented by `SupabaseStore(settings, client: httpx.Client)` and `MemoryStore()`):**
- Jobs: `create_job(user_id, kind, idempotency_key, input_path, item_id=None, job_id=None) -> tuple[dict, bool]` (row, created; duplicate key → existing row, False); `get_job(user_id, job_id) -> dict | None`; `active_job(user_id, item_id, kind) -> dict | None` (queued/running); `claim_job(lease_seconds) -> dict | None`; `finish_job(job_id, status, result=None, error=None)`; `retry_job(job_id, error)`.
- Items: `list_items(user_id) -> list[dict]` (not deleted, newest first); `get_item(user_id, item_id) -> dict | None`; `insert_item(row: dict) -> dict` (duplicate `(job_id, piece_index)` → existing row); `update_item(user_id, item_id, fields: dict) -> dict | None`; `find_legacy(user_id, legacy_key) -> dict | None`.
- Files: `upload(path, data: bytes, content_type)`; `download(path) -> bytes`; `remove(paths: list[str])`; `sign(paths: list[str]) -> dict[str, str]` (absolute URLs on `public_url`).
- `get_store()` dependency.
- SQL: `public.claim_generation_job(lease_seconds int) returns setof generation_jobs` — picks the oldest `queued` job, or a `running` one whose `locked_until < now()` and `attempts < max_attempts`, with `for update skip locked`; sets `running`, `attempts + 1`, `locked_until = now() + lease`, `started_at = coalesce(started_at, now())`. Execute granted to `service_role` only.
- Routes: `POST /v1/jobs` (multipart `photo`, header `Idempotency-Key`) → uploads to `<uid>/jobs/<new id>/upload<ext>` then `create_job(... job_id=new id)`; duplicate → delete the new upload, return existing (200); new → 202. `GET /v1/jobs/{id}` → `JobOut {id, kind, status, error, item_ids, quality, failed}` or 404. Missing key → 400; missing photo → 400.

- [ ] Failing tests: MemoryStore contract (idempotency, per-user isolation, claim order, lease reclaim, attempts cap); pgTAP for the SQL function (claims oldest, skips locked/fresh-running, reclaims expired, respects attempts, `authenticated` can't execute); v1 jobs routes with `MemoryStore` and two users (A creates, B's GET → 404; repeat key → same id, one stored upload; no key → 400).
- [ ] Implement; `npx supabase db reset`; run pytest + `npx supabase test db` → PASS. Commit `feat(api): user-owned generation jobs`.

### Task 3: Items API and two-user isolation

**Files:** Modify `api/routes/v1.py`; modify `api/schemas.py` (add `V1ItemOut`); test `tests/api/test_v1_items.py`.

**Interfaces — Produces:** `V1ItemOut` = today's `ClosetItemOut` shape with `id: str` in place of `run_id/photo_name/item_id`, image URLs signed (absolute), `back`/`turn` from the item's jsonb (turn `running` past 5 min → failed "Interrupted — try again", as today). Routes: `GET /v1/items` → `{items: [...]}`; `PATCH /v1/items/{id}` (same `ItemPatch` validation as legacy, writes `facts`; first edit keeps `facts_original` via the DB trigger / MemoryStore equivalent); `DELETE /v1/items/{id}` → sets `deleted_at` (204); `POST /v1/items/{id}/back` (photo + key) → back job; `POST /v1/items/{id}/turn` (key) → 409 if a turn job is active, else sets `item.turn = {"state": "running"}` and queues a turn job.

- [ ] Failing tests with two users: list shows only own; B's PATCH/DELETE/back/turn on A's item → 404 and A's item unchanged; validation errors as legacy (400 messages); signed URLs only for the caller's paths; deleted items hidden.
- [ ] Implement → PASS. Commit `feat(api): user-scoped items API`.

### Task 4: Worker

**Files:** Create `api/worker.py`; modify `api/main.py` (mode switch + lifespan worker); test `tests/api/test_worker.py`, `tests/api/test_main_modes.py`.

**Interfaces — Produces:** `async def run_once(store, provider_factory, lease_seconds=600) -> bool` (processed a job?); `async def run_forever(store, provider_factory, idle_seconds=2.0)`. Per kind: **garment** → download upload to temp, `run_photo`, for each `item_*` with `generated.png`: upload a copy of the original photo as `<uid>/items/<item>/source<ext>` (one copy per piece, so deleting one item never breaks its siblings), plus `crop/generated/cutout`, `insert_item(job_id, piece_index=i, tier, facts, paths)`; result `{item_ids, quality, failed}`; quality retake → succeeded with no items. **back** → rebuild the item folder (`generated.png`), `run_back`, upload `back/*`, `update_item(back={paths, visible_text})`; `BackPhotoRejected` → failed, no retry. **turn** → rebuild item folder (front generated/crop/facts.json, back/*), `refs_for_item`, `run_turn`, upload views, `update_item(turn={state: done, views})`; `TurnFailed` → failed and `turn={state: failed, error}`. Other exceptions → `retry_job` (back to queued) until `attempts >= max_attempts`, then failed with "Something went wrong — try again". Files uploaded for a job that then fails are removed. `api/main.py`: auth off → legacy routers only (as today); on → `load_settings`, v1 router, lifespan task running `run_forever` with `SupabaseStore`.
- [ ] Failing tests with `MemoryStore` + fake providers from existing tests: garment job → items stored with per-user paths, one per piece, job succeeded; retry of the same job creates no duplicates; back/turn jobs update the item; rejected back → failed with message; crash → requeued, final failure → failed + files removed; auth off app has no `/v1` routes and legacy routes work; auth on app without settings fails fast.
- [ ] Implement → PASS. Commit `feat(api): background worker for user jobs`.

### Task 5: `runs/` migration script

**Files:** Create `scripts/migrate_runs.py`; test `tests/test_migrate_runs.py`.

**Interfaces — Produces:** `plan_migration(runs_dir) -> list[LegacyItem]` (each with `legacy_key = "<run>/<photo>/<item>"`, files present, `deleted` for `.trash`, facts/facts_original, back/turn presence, skip reason); `apply_migration(store, user_id, items) -> Report` (idempotent via `find_legacy`; source = `crop.png`, `source_kind = "crop"`); CLI `python scripts/migrate_runs.py --runs runs --email <owner email>`: **dry run by default** (prints counts and skips), `--apply` required to write; resolves the user id from the email via the Auth admin API.
- [ ] Failing tests on a temp `runs/` fixture (normal item, retake-only, trashed, missing facts, back, turn, edited facts) for the plan; apply into `MemoryStore` twice → second run adds nothing.
- [ ] Implement → PASS. Run the dry run against the real `runs/` (read only) and record its summary. Commit `feat(scripts): idempotent runs/ migration`.

### Task 6: End-to-end check and docs

- [ ] Integration test `tests/integration/test_supabase_store.py`, skipped unless `SUPABASE_TEST_URL` and `SUPABASE_TEST_SECRET_KEY` are set, run against the local stack: upload/sign/download/remove; job create (incl. duplicate key) + claim + finish; item insert/list isolation between two users created via the Auth admin API; `TokenVerifier` accepts a real token from a code sign-in (code read from Mailpit) and rejects it with a wrong issuer.
- [ ] Docs: README (running the backend with auth on), design §6 M3 split note + owner questions, ROADMAP. Full suites green. Commit `docs: M3a backend setup`.
