# Multi-User M4 — End-to-End Two-User Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the whole multi-user flow with two accounts against a real Supabase stack, close the storage-orphan gap, and bring the product docs up to the shipped state.

**Architecture:** An integration suite drives the real `/v1` app (`create_app`) plus the worker (`run_once`, fake model providers) against the local stack with real tokens, and checks Storage RLS directly with each user's JWT. A `scripts/sweep_storage.py` (dry run by default) removes files of deleted accounts and stale job uploads. Docs describe what exists.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` (§5 orphans, §6 M4)

## Global Constraints
- Integration tests skip unless `SUPABASE_TEST_URL`, `SUPABASE_TEST_SECRET_KEY`, `SUPABASE_TEST_PUBLISHABLE_KEY` are set; they create and delete their own users and files.
- No paid model calls (fake providers only).
- The sweeper never deletes without `--apply`; it only touches the `wardrobe` bucket; job uploads are removed only for jobs that are finished (`succeeded`/`failed`/`canceled`) or missing, and older than 7 days.

## Review Focus
1. User B fetching A's file straight from Storage with B's own token (bypassing our API) → refused; A's token → allowed. (Task 1.)
2. A job that crashes once then succeeds → one set of items, job `succeeded`, no leftovers. (Task 1.)
3. A second device (new sign-in) and a restarted server see the same closet. (Task 1.)
4. Sweeper with a live user whose job is still running → their upload is kept. (Task 2.)
5. Sweeper on a folder name that isn't a user id (e.g. a stray file at the root) → reported, not deleted. (Task 2.)

---

### Task 1: Two-user integration suite
**Files:** Create `tests/integration/test_two_users.py` (reuses fixtures/helpers from `tests/integration/test_supabase_store.py` and fakes from `tests/api/test_worker.py`).
- [ ] Tests: A and B each capture (jobs interleaved; worker drains) → each closet holds only its own piece; edit/delete isolation through the API; A's signed URL loads, B's token on `GET /storage/v1/object/authenticated/wardrobe/<A path>` is refused and A's token is allowed; back + 360 for A, B unaffected; crash-once job retried to success with one item; unusable photo → `failed` with its sentence and no files; second sign-in for A and a fresh `create_app` both list the same items. Run against the local stack → PASS. Commit `test: two-user end-to-end suite`.

### Task 2: Storage sweeper
**Files:** Modify `api/store.py` (`list_paths(prefix) -> list[str]` recursive; `user_exists(user_id) -> bool`; `job_status(job_id) -> tuple[str, datetime] | None` admin lookup, both stores); create `scripts/sweep_storage.py` (`plan_sweep(store, now) -> Sweep(remove: list[str], keep_reasons: dict)`, CLI dry run / `--apply`); test `tests/test_sweep_storage.py`, plus one integration test (delete a user → sweep removes their folder).
- [ ] Failing tests with `MemoryStore`: deleted user's whole folder listed; live user's items kept; finished job upload older than 7 days removed, newer kept, running kept, missing job + old removed; non-uuid root entries reported not removed; dry run removes nothing. Implement → PASS. Commit `feat(scripts): storage sweeper for deleted accounts and stale uploads`.

### Task 3: Docs to the shipped state
**Files:** `PRODUCT.md` (Users, Capabilities and Constraints, Principles 5), `README.md` (status, how it runs today in both modes, owner TODO list), `docs/ARCHITECTURE.md` (status banner → current architecture summary at the top), `docs/ROADMAP.md` (M4 ticked), design §6 M4 note.
- [ ] Update; all suites green. Commit `docs: product and architecture docs match the multi-user build`.
