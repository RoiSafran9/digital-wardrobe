# Multi-User M5 — Credit System Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the hooks for one AI Credits balance per account where billing will plug in later — every job records its credit cost, a server-controlled price list exists (empty = billing off), and a credit gate is called at reserve/settle/refund points — without wallets, prices or purchases.

**Architecture:** `api/credits.py` holds the price list (from `WARDROBE_CREDIT_PRICES`, JSON; unset = billing off) and a `CreditGate` protocol with a `NoCharge` default. `queue_job` asks the gate to reserve the job's cost before creating it and releases the reservation if the key turned out to be a repeat; the worker settles on success and refunds on failure. A migration adds `generation_jobs.cost_credits`. `GET /v1/prices` serves the price list for a future in-app Price List. The wallet/ledger design and the open product decisions are written down, not built.

**Spec:** `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` §5 (credits), PR #2's `docs/CREDITS.md` (product direction; not modified here).

## Global Constraints
- No prices are hardcoded; the illustration figures in CREDITS.md are not approved. Unset price list → `cost_credits` stays null and nothing is charged.
- The app never sees or edits balances; only the backend calls the gate.
- One charge per job: a repeated `Idempotency-Key` never reserves again.
- No wallet/ledger tables in this milestone.

## Review Focus
1. Repeat request with the same key while billing is on → one reservation, the duplicate's reservation released. (Task 2.)
2. Gate refuses (insufficient credits) → 402 "Not enough AI credits", no upload or job left behind. (Task 2.)
3. Job fails after retries → refund; succeeds → settle; a retried attempt doesn't settle twice. (Task 2.)
4. Malformed `WARDROBE_CREDIT_PRICES` (not JSON, negative, unknown action) → server refuses to start with a clear message. (Task 1.)
5. Billing off → `cost_credits` null and the app's flow unchanged. (Task 2.)

---

### Task 1: Price list, gate and column
**Files:** create `api/credits.py`, `supabase/migrations/20261018140000_job_cost_credits.sql`; test `tests/api/test_credits.py`, `supabase/tests/database/06_cost_credits.test.sql`.
**Interfaces:** `load_prices(env) -> dict[str, int]` (keys ⊆ {garment, back, turn}, values ≥ 0; raises `RuntimeError`); `class InsufficientCredits(Exception)`; `class CreditGate(Protocol): reserve(user_id, job_id, kind, cost) ; release(job_id) ; settle(job_id) ; refund(job_id)`; `class NoCharge` (all no-ops); `get_prices()`, `get_gate()` dependencies. Column: `cost_credits int check (cost_credits >= 0)`, nullable, not client-updatable.
- [ ] Failing tests → implement → PASS (pytest + `npx supabase test db`). Commit `feat(api): credit price list and gate hooks`.

### Task 2: Hooks in the job flow
**Files:** modify `api/store.py` (`create_job(..., cost_credits=None)`), `api/routes/v1.py` (`queue_job` reserve/release, 402, `JobOut.cost_credits`, `GET /v1/prices`), `api/worker.py` (settle/refund via a gate passed to `run_once`), `api/main.py` (wire `NoCharge` + prices); tests `tests/api/test_v1_credits.py`, `tests/api/test_worker.py`.
- [ ] Failing tests for Review Focus 1–3, 5 and the prices endpoint → implement → PASS. Commit `feat(api): record job cost and call the credit gate`.

### Task 3: Integration notes
**Files:** create `docs/superpowers/specs/2026-10-18-credits-readiness.md` (what's built, wallet/ledger schema proposal with constraints and RLS, reserve/settle/refund transaction design, where each hook lives, open product decisions from CREDITS.md mapped to code points, app UI points); ROADMAP M5 ticked; PRODUCT/README one-liners.
- [ ] Write; all suites green. Commit `docs: credit system integration points`.
