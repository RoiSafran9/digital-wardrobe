# AI Credits Wallet — Research, Architecture and Milestone Plan

Status: **approved 2026-10-18; Milestone 1 built (billing off)** · Date: 2026-10-18 · Brief: [ai-credits-wallet-implementation.md](../../tasks/ai-credits-wallet-implementation.md) · Product decisions: [CREDITS.md](../../CREDITS.md)

Milestone 1 builds an **inactive** wallet: schema, trusted functions, an admin grant CLI and a read-only `GET /v1/credits`. Billing stays off (`NoCharge`), no price is enforced and nothing in the app changes.

## 1. Research notes (official sources)

| Topic | Takeaway for us | Source |
|---|---|---|
| Row locks | `SELECT … FOR UPDATE` on the wallet row makes concurrent reserves for one user queue up; the second sees the first's committed balance. No need for SERIALIZABLE + retry loops. | [PostgreSQL: Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html), [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) |
| Atomicity | A function body runs inside the caller's single transaction: the ledger insert and the wallet update commit together or not at all (crash = rollback of both). | [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| Idempotency | A unique constraint plus `INSERT … ON CONFLICT` is the race-safe "do it once" primitive; a replay with the same key must return the first result, and a replay with *different* parameters must be rejected (Stripe's rule). | [PostgreSQL: INSERT ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT), [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) |
| `SECURITY DEFINER` | Pin `search_path` (we use `''` and schema-qualify everything), revoke `EXECUTE` from `PUBLIC`, grant only to the role that needs it. | [PostgreSQL: Writing SECURITY DEFINER Functions Safely](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY), [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions) |
| RLS / Data API | Tables in `public` are reachable through the Data API; RLS on, `select`-only policies keyed on `(select auth.uid())`, and explicit grants (the hosted project no longer auto-grants new tables). Functions in `public` are also callable over `/rest/v1/rpc` unless `EXECUTE` is revoked. | [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api) |

### Wallet cache + ledger vs ledger only

| | (1) `credit_wallets(balance, held)` + append-only `credit_ledger` | (2) balance derived from ledger only |
|---|---|---|
| Balance check | one row, O(1) | `sum()` over the user's history |
| Concurrency | lock the wallet row | needs something to lock anyway (advisory lock or a per-user row), or SERIALIZABLE with retries |
| Drift risk | wallet could disagree with ledger if written outside the functions | none |
| Read API | trivial | aggregate per request |

**Recommendation: (1)**, with the drift risk closed off structurally: no role (not even `service_role`) may write either table directly; the only writers are four `SECURITY DEFINER` functions that change the wallet and append the ledger row in the same transaction, and every ledger row stores `balance_after`/`held_after`. A `credit_wallet_drift()` check function returns any wallet whose cache disagrees with the ledger sum (expected: none; pgTAP asserts it after every scenario).

How it stays consistent:
- **Crash** mid-operation → the transaction rolls back; wallet and ledger never diverge.
- **Simultaneous requests** → both lock the same wallet row; the second waits, then re-checks `balance − held`.
- **Retries** → each operation has a stable key (`job:<id>:hold`, `…:charge`, `…:release`, or the admin's grant key) with a unique index; a replay returns the existing row and changes nothing.

## 2. Schema (Milestone 1)

```
auth.users ──1:1── credit_wallets                     credit_ledger (append-only)
  (on delete         user_id    pk/fk                    id             bigint identity  (cursor)
   cascade)          balance    int ≥ 0                  user_id        fk auth.users, cascade
                     held       int ≥ 0, ≤ balance       kind           grant | hold | charge | release
                     created_at, updated_at              amount         int > 0  (sign comes from kind)
                                                         balance_after, held_after   int ≥ 0
                                                         action         garment | back | turn   (job rows)
                                                         job_id         uuid (no FK: the hold is taken
                                                                         before the job row exists)
                                                         operation_key  text, unique per user
                                                         note           grant reason (shown to the user)
                                                         granted_by     admin label (hidden from the app)
                                                         created_at
available = balance − held
```

Effect of each kind: `grant` balance +n · `hold` held +n · `charge` balance −n, held −n · `release` held −n.

Constraints: one `hold` per `job_id`; at most one of `charge`/`release` per `job_id` (partial unique indexes), so a hold ends exactly once. Grants need a `note` and `granted_by`; job rows need `job_id` and `action`. Index `(user_id, id desc)` for history.

Privileges: RLS on; `authenticated` may `select` its own wallet and its own ledger rows (all columns except `granted_by`); `anon` nothing; **no `insert/update/delete` for anyone**, including `service_role`; a trigger also refuses `update`/`delete` on the ledger. `service_role` keeps `select`.

**Wallet on signup (my call):** the existing `handle_new_user` trigger also inserts a zero wallet, and the migration backfills a zero wallet for every existing account. Why: "one wallet per account" holds as a fact in the data, the read API never has to invent a row, and the reserve lock always has a row to lock. The functions also create a missing wallet defensively, so a gap can't block anyone.

**Account deletion (my call):** wallet and ledger cascade with the account, like items and jobs. No real money exists in M1–M3; before paid packs (M4), keep purchase receipts outside the cascade.

**Disabled accounts (my call):** reads still work; `credit_reserve` refuses a disabled account (the API already returns 403 earlier) and `credit_grant` refuses one too.

## 3. Trusted functions

All `SECURITY DEFINER`, owner `postgres`, `set search_path = ''`, `EXECUTE` revoked from `public, anon, authenticated` and granted to `service_role` only. The user id is an argument because the only caller is our backend, which takes it from the verified token (API) or from the admin CLI's lookup — never from a client.

| Function | Does | Replay | Refuses |
|---|---|---|---|
| `credit_grant(user_id, amount, operation_key, note, granted_by)` | balance +amount | same key + same user/amount → returns first row | amount ≤ 0, unknown or disabled user, missing note/admin, same key with different values |
| `credit_reserve(user_id, job_id, action, amount)` | held +amount if `balance − held ≥ amount` | same job → first row | insufficient credits (`WC402`), amount ≤ 0, unknown action, unknown/disabled user, same job with different values |
| `credit_settle(job_id)` | hold → charge | returns the existing charge | job already released (`WC409`) |
| `credit_release(job_id)` | hold → release | returns the existing release | job already charged (`WC409`) |

`credit_settle`/`credit_release` take only the job id: the hold row already names the owner, so the gate's existing `settle(job_id)`/`refund(job_id)` signatures fit. No hold for that job (billing was off) → returns nothing, changes nothing. Every operation locks the wallet row first, so a settle and a release racing for one job serialize and the loser gets `WC409`.

Flow (Milestone 2 wiring; M1 only builds and tests the primitives):

```
POST /v1/jobs ── credit_reserve(user, new job id) ── insert job ──▶ worker ──┬─ success ─ credit_settle(job)
      │ 402 if WC402         └─ insert lost / failed → credit_release(job)     └─ final fail ─ credit_release(job)
```

## 4. Admin grant CLI

`scripts/grant_credits.py` (runs on the owner's Mac with the server's `.env`; uses `SUPABASE_URL` + `SUPABASE_SECRET_KEY`; nothing in `mobile/`):

```
python -m scripts.grant_credits --email friend@example.com --amount <N> --reason "F&F pilot" \
       --key ff-pilot-friend-1 --by owner            # dry run: shows recipient, current balance, new balance
python -m scripts.grant_credits ... --apply           # writes the grant
```

All of `--email`/`--user-id`, `--amount`, `--reason`, `--key`, `--by` are required; dry run by default (same pattern as `migrate_runs`/`sweep_storage`). Rerunning with the same `--key` is a no-op that prints "already granted". No bulk grant, no default amount. "Admin" = whoever holds the server's secret key; admin roles stay unapproved.

## 5. Read API

`GET /v1/credits?limit=20&before=<ledger id>` (signed-in user only; the backend reads with the secret key, filtered by the token's user id):

```json
{ "balance": 10, "held": 1, "available": 9,
  "entries": [ { "id": 42, "kind": "hold", "amount": 1, "action": "garment", "job_id": "…",
                 "note": null, "created_at": "…" } ],
  "next_before": 41 }
```

`limit` 1–100, newest first, `next_before` null on the last page; zeros for an account without a wallet row. `GET /v1/prices` stays separate and unchanged.

## 6. What stays as it is in M1

- `api/main.py` keeps `NoCharge`; `WARDROBE_CREDIT_PRICES` stays unset; no app change; generation behavior unchanged.
- Store gets read methods (`credits`, `credit_entries`) and thin RPC wrappers (`credit_grant/reserve/settle/release`) used by the CLI and the integration test; the worker and job routes don't call them yet.

## 7. Tests (M1)

- **pgTAP** (`07_credit_wallet.test.sql`): schema/indexes/grants; two-user read isolation; `authenticated` and `service_role` can't insert/update/delete; ledger update/delete refused; functions not executable by `authenticated`/`anon`; backfill + signup wallet; grant/reserve/settle/release happy paths; overspend refused; duplicate keys/job ids are no-ops; mismatched replay refused; settle-after-release and release-after-settle refused; negative/zero amounts; unknown and disabled users; terminal-failure simulation (reserve → release returns credits); `credit_wallet_drift()` empty after all of it.
- **Real concurrency** (`tests/integration/test_credit_wallet.py`, local stack): 10 parallel reserves of 1 against 3 available → exactly 3 succeed, held = 3, no drift.
- **Backend** (`tests/api/test_v1_wallet.py`, MemoryStore): shape, pagination, isolation (B can't see A), auth required, zero wallet; CLI dry-run/apply/idempotent rerun/unknown email.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Someone writes the tables directly and the cache drifts | No write grants at all; ledger trigger; drift check in tests |
| Function callable from the app over `/rpc` | `EXECUTE` revoked from `anon`/`authenticated`; pgTAP asserts it |
| `search_path` hijack in definer functions | `search_path = ''`, fully qualified names |
| Grant typo (wrong user/amount) | dry run by default, explicit `--apply`; a correction would need an `adjustment` kind, which isn't in M1 (no reversal without owner approval) |
| Hosted DB differs from local | migration only; owner applies with `supabase db push` after review |

## 9. Milestones

**M1 (this PR):** everything above.

**M2 — connect billing (plan only, needs owner decisions):**
1. *Multi-garment photos* — choose between (a) detect first, show the pieces, user confirms N → reserve N (one extra vision call ≈ a few seconds before the confirm, but exact charges and the user picks pieces) and (b) user approves a maximum up front → reserve max, settle only the fronts actually created, release the rest (no extra latency or model call, but the quote is an upper bound). Needs `credit_settle` to accept a partial amount.
2. *Zero usable images* — settle by count of fronts created, never by `status = succeeded`.
3. *Expired jobs* — `claim_generation_job` fails them without the worker's refund hook; add a `credit_reconcile()` that releases holds of failed/canceled jobs and settles succeeded ones, called from the worker loop.
4. *Crash between finish and settle* — the same reconciliation makes it self-healing (operations are already idempotent).
5. *Reserve → job insert gaps* — reconcile holds whose job never appeared after a timeout.
6. *Fail closed* — `job_cost` currently returns 0 for an unpriced action when billing is on; must refuse instead.
7. *Price snapshot* — already on the job (`cost_credits`); add a price-list version if prices move to a table.
8. Wallet-backed `CreditGate`, opt-in flag, two-account end-to-end tests with fake AI.

**M3 — app UX (plan only):** Account balance (+held), truthful usage display, history from `GET /v1/credits`, AI Price List from `GET /v1/prices`, cost and balance before front/back/360, multi-piece consent, 402 state, refresh after actions, clear on sign-out.

**M4 — paid launch:** out of scope.

## 10. Owner-only steps / open decisions

- Approve this design (gate before code).
- Later: apply the migration to the hosted project (`npx supabase db push`), then decide the F&F grant size and run the CLI.
- Open (not decided here): grant size, admin roles, expiry, regeneration pricing, unsaved previews, billable-success definition, multi-garment quote rule.

## Deviations found between plans and code

- CREDITS.md proposes `credit_wallets(available_credits)` and a ledger `status`; the M5 notes propose `balance + held` and `reason`. This design follows `balance + held` with `kind`, since holds need a separate held amount.
- CREDITS.md's `ai_action_prices` table isn't built; prices stay in `WARDROBE_CREDIT_PRICES` until M2/M3 decides.
- `job_cost` falls back to 0 for an unpriced action (fail-open) — M2 item 6.
- Worker marks a job succeeded before `settle`; `claim_generation_job` fails expired jobs without a refund — M2 items 3–4.
- A `garment` job is priced once per photo — M2 item 1.
