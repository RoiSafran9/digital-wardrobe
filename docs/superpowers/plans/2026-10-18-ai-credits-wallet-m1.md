# AI Credits Wallet M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An inactive per-account AI Credits wallet: schema, trusted ledger functions, admin grant CLI, read-only `GET /v1/credits`.

**Architecture:** `credit_wallets` cache + append-only `credit_ledger`, written only by four `SECURITY DEFINER` functions (service_role only). Backend reads via the secret key filtered by the token's user id. Billing stays off (`NoCharge`).

**Tech Stack:** Postgres/Supabase migrations + pgTAP, FastAPI, httpx, pytest.

**Spec:** `docs/superpowers/specs/2026-10-18-ai-credits-wallet-design.md`

## Global Constraints
- No change to `api/main.py` gate (`NoCharge`), job routes, worker, or `mobile/`.
- No invented prices or grant amounts in code or docs; examples use `<N>` placeholders.
- Never touch the hosted project; local stack via `npx supabase migration up --local` (no `db reset`: it wipes local accounts).
- Error codes: `WC402` insufficient credits, `WC409` hold already ended the other way, `WC422` invalid input / mismatched replay, `WC404` unknown user, `WC403` disabled user.

## Review Focus
- Replay of a grant key with a different amount or user → rejected, not silently ignored (pgTAP).
- Two settle/release for one job → second is a no-op of the same kind or WC409 (pgTAP).
- `before` cursor that belongs to another user → page contains only own rows (API test).
- Admin CLI with an email that doesn't exist → clear error, nothing written (CLI test).
- Parallel reserves exceeding available → exactly `available` succeed (integration test).

---

### Task 1: Migration + pgTAP
**Files:** Create `supabase/migrations/20261018150000_credit_wallet.sql`, `supabase/tests/database/07_credit_wallet.test.sql`.
**Produces:** tables `public.credit_wallets`, `public.credit_ledger`; functions `public.credit_grant(uuid,int,text,text,text)`, `public.credit_reserve(uuid,uuid,text,int)`, `public.credit_settle(uuid)`, `public.credit_release(uuid)` (each returns `public.credit_ledger`, null when nothing to do), `public.credit_wallet_drift()` returns `(user_id, balance, held, ledger_balance, ledger_held)`; `handle_new_user` also inserts a wallet; backfill.
- [ ] Write pgTAP test covering spec §7 list; run `npx supabase test db` → fails (no tables).
- [ ] Write migration; `npx supabase migration up --local`; run tests → pass. Commit.

### Task 2: Store + `GET /v1/credits`
**Files:** Modify `api/store.py`, `api/schemas.py`, `api/routes/v1.py`; Test `tests/api/test_v1_wallet.py`.
**Produces:** store `credits(user_id) -> dict(balance, held)`, `credit_entries(user_id, limit, before: int|None) -> list[dict]`, `credit_grant(user_id, amount, key, note, by) -> dict`, `credit_reserve/settle/release`, `find_user_by_email(email) -> dict|None`; MemoryStore mirrors (grant/reserve/settle/release same rules, raising `CreditError(code, message)`). Schemas `CreditEntryOut`, `CreditsOut(balance, held, available, entries, next_before)`.
- [ ] Tests: zeros for new user; grant then reserve shows balance/held/available; pagination with limit=2 and `next_before`; B sees nothing of A's; A's cursor id in B's request returns only B's rows; limit 0/101 → 422; no token → 401. Fail → implement → pass. Commit.

### Task 3: Grant CLI
**Files:** Create `scripts/grant_credits.py`, `tests/test_grant_credits.py`.
**Produces:** `main(argv, store=None) -> int`; required `--email|--user-id`, `--amount`, `--reason`, `--key`, `--by`; `--apply`.
- [ ] Tests (MemoryStore): dry run writes nothing and prints new balance; apply grants; rerun same key prints "already granted", balance unchanged; unknown email → exit 1; amount ≤ 0 → exit 2 (argparse). Fail → implement → pass. Commit.

### Task 4: Concurrency integration test
**Files:** Create `tests/integration/test_credit_wallet.py`.
- [ ] Grant 3, 10 threads `credit_reserve(…, 1)` → 3 succeed, 7 `WC402`, held 3, drift empty; settle/release replay. Run with local stack env. Commit.

### Task 5: Docs + full checks + PR
**Files:** `docs/CREDITS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `README.md`, `docs/superpowers/specs/2026-10-18-credits-readiness.md`, `.env.example` if needed.
- [ ] Update to built state; run pytest, jest, tsc, supabase test db, integration; push; open PR (no merge).
