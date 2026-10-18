# Multi-User M3b — App on the `/v1` API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When signed in, the app talks to the backend's `/v1` API with the Supabase token — captures, back photos and 360s become jobs it polls — while local mode keeps today's endpoints; screens stay as they are.

**Architecture:** The API client (`mobile/src/api/client.ts`) keeps its public functions and their return types. A small `configureApi({ getToken, onUnauthorized })` (called by `AuthProvider` when signed in, cleared on sign-out) switches every function to its `/v1` implementation in `mobile/src/api/v1.ts`, which adapts `/v1` responses to the existing `ClosetItem` / `RunResponse` / `Turn` shapes. Two small backend additions make that possible: `created_at` on `V1ItemOut` and `GET /v1/items/{id}`.

**Tech Stack:** Expo/React Native, Jest; FastAPI + pytest for the two backend additions.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` (§4, §6 M3); backend contract in `docs/superpowers/plans/2026-10-18-multiuser-backend.md`.

## Global Constraints

- Local mode (no Supabase config, or auth `local`): requests and behavior byte-for-byte as today; existing tests untouched except imports.
- Signed in: every request carries `Authorization: Bearer <access token>` from `supabase.auth.getSession()` (fresh after refresh); job-creating requests carry an `Idempotency-Key` from `expo-crypto.randomUUID()`, reused when the same request is retried once after a network error.
- Poll jobs every 2 s, give up after 5 min with "Still working on it — check your closet in a minute."
- 401 from the server → message "Your session expired. Sign in again." and `onUnauthorized()` (signs out).
- `/v1` route missing (FastAPI's default 404 body without `error`) → "Your wardrobe server isn't in account mode. Restart it with WARDROBE_AUTH=on."
- Absolute (signed) image URLs are used as-is; relative ones keep today's `API_BASE_URL` prefix.
- Hosting: the server stays on the owner's Mac. Reaching it off the LAN = point `EXPO_PUBLIC_API_URL` (and `SUPABASE_PUBLIC_URL` / the Supabase URL) at a tunnel; documented, not set up.

## Review Focus

1. Signing out (or switching user) mid-poll → no request goes out with the old token afterwards; the poll stops. (Task 2 test.)
2. A capture whose POST times out after the server accepted it → the retry with the same key returns the same job, no duplicate pieces. (Task 2 test.)
3. A job that fails (bad photo) → the server's sentence is shown, not a generic error. (Task 2 test.)
4. Signed image URL already absolute → not double-prefixed. (Task 2 test.)
5. Signed-in app against a server still in local mode → a clear setup message, not "Something went wrong". (Task 2 test.)

---

### Task 1: Backend additions

**Files:** Modify `api/schemas.py` (`V1ItemOut.created_at: str`), `api/routes/v1.py` (`item_out` fills it; `GET /v1/items/{item_id}` → `V1ItemOut` or 404); test `tests/api/test_v1_items.py`.
- [ ] Failing tests: list items carry `created_at` (ISO string); `GET /v1/items/{id}` returns own item with signed URLs; B's GET of A's item → 404; unknown/non-uuid → 404. Implement → PASS. Commit `feat(api): item created_at and GET /v1/items/{id}`.

### Task 2: Client `/v1` mode

**Files:** Create `mobile/src/api/v1.ts`; modify `mobile/src/api/client.ts`, `mobile/src/api/types.ts` (`ClosetItem.id?: string` — set for `/v1` items); test `mobile/__tests__/v1client.test.ts`.

**Interfaces — Produces:**
- `configureApi(config: { getToken: () => Promise<string | null>; onUnauthorized: () => void } | null): void` in `client.ts`.
- Unchanged signatures: `postRun(uri) → RunResponse`, `getItems() → ItemsResponse`, `updateItem(item, patch) → ClosetItem`, `deleteItem(item)`, `addBack(item, uri) → ClosetItem`, `startTurn(item) → Turn`, `getTurn(item) → Turn`, `imageUrl(path)`.
- Adapter (`v1.ts`): `toClosetItem(v1) → ClosetItem` with `id`, `item_id = id`, `photo_name = ""`, `run_id = "<local YYYYMMDD-HHMMSS>"` from `created_at` (so "Added Oct 18" and "added this week" keep working). `postRun`: POST `/v1/jobs` → poll → on `succeeded` GET `/v1/items` and return `RunResponse { run_id: job.id, quality, items: pieces in item_ids order as RunItem (reason "", retake_instruction null), failed: job.failed + one entry per retake }`; on `failed` throw the job's error. `addBack`: POST back → poll → GET `/v1/items/{id}`. `startTurn`: POST turn → `{state: "running", error: null, views: []}`. `getTurn`: GET `/v1/items/{id}` → its `turn` (null → running).
- [ ] Failing tests (mocked `fetch`, fake timers): local mode hits legacy URLs with no auth header; configured mode sends Bearer + key; postRun polls to success and returns adapted pieces; failed job throws its sentence; network error on POST retries once with the same key; 401 → session message + `onUnauthorized`; local-mode server → setup message; `configureApi(null)` mid-poll stops the poll and no further requests carry the token; absolute image URLs untouched; adapted `run_id` gives `addedLabel` "Added Oct 18"; poll timeout message.
- [ ] Implement → PASS; `npx tsc --noEmit`. Commit `feat(app): use the /v1 API when signed in`.

### Task 3: Wire auth to the client

**Files:** Modify `mobile/src/auth/AuthProvider.tsx` (when `signedIn`, `configureApi({ getToken: () => client.auth.getSession() → access_token, onUnauthorized: signOut })`; otherwise `configureApi(null)`); test `mobile/__tests__/auth/AuthProvider.test.tsx`.
- [ ] Failing tests: signed in → `configureApi` called with a getter returning the session token; sign out → `configureApi(null)`; local mode never configures. Implement → PASS. Full `npx jest` + `tsc`. Commit `feat(app): signed-in sessions use the account API`.

### Task 4: End-to-end check and docs

- [ ] Against the local stack + this branch's server (`WARDROBE_AUTH=on`, fake or real providers): exercise the client flow from a Node script or the integration test path (capture → job → items → back → 360 status) with a real token; record results. Phone test is the owner's.
- [ ] Docs: README (running the Mac server in account mode for the phone: env vars, `SUPABASE_PUBLIC_URL` = Mac LAN IP; tunnel notes), ROADMAP (M3b ticked, M3 done), design §6 note. All suites green. Commit `docs: M3b app setup`.
