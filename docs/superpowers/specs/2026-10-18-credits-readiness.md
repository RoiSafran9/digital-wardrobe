# AI Credits — Integration Points (Multi-User M5)

Status: **hooks built, billing off** · Date: 2026-10-18 · Product direction: `docs/CREDITS.md` (PR #2, still a draft, not changed here)

This note says what the multi-user build already does for credits, where a wallet and a ledger plug in, and which product decisions each code point waits for. No prices, balances, charges or purchases exist yet.

## What is built

| Piece | Where | Behavior today |
|---|---|---|
| Price list | `api/credits.py` `load_prices()`; env `WARDROBE_CREDIT_PRICES` (JSON, e.g. `{"garment": 1, "back": 1, "turn": 3}`) | Unset → billing off. Only `garment`, `back`, `turn`; whole numbers ≥ 0; anything else stops the server at startup. No price is hardcoded; the figures in CREDITS.md are only an illustration. |
| Job cost | `generation_jobs.cost_credits` (migration `20261018140000`), set in `api/routes/v1.py` `queue_job()` | Null while billing is off; otherwise the price of the job's kind at the moment it was queued. The owner can read it on their own jobs; only the backend writes it. Returned as `cost_credits` on `/v1/jobs`. |
| Credit gate | `api/credits.py` `CreditGate` protocol; default `NoCharge` | Called by the backend only, never by the app: `reserve` before the job is created (raising `InsufficientCredits` → HTTP 402 "not enough AI credits", and nothing is uploaded or queued); `release` if the job wasn't created (e.g. a repeated `Idempotency-Key`); `settle` when the worker finishes it; `refund` when it fails for good. Internal retries don't settle or refund. |
| Price list endpoint | `GET /v1/prices` | `{"billing": false, "prices": {}}` today; the source for a future in-app AI Price List and the cost shown before an action. |

One job = one hold: a repeated request with the same key returns the existing job without calling `reserve`, and a request that loses the insert race releases its hold.

## Wallet and ledger (proposal — superseded)

Built in wallet M1 with small changes (ledger `kind` instead of `reason`, `balance_after`/`held_after`, no direct writes even for the backend): see [wallet design](2026-10-18-ai-credits-wallet-design.md). The original proposal is kept below for history.

```sql
credit_wallets  user_id uuid pk → auth.users on delete cascade, balance int not null default 0 check (balance >= 0),
                held int not null default 0 check (held >= 0), updated_at timestamptz
credit_ledger   id uuid pk, user_id uuid not null → auth.users, delta int not null,  -- + grant/purchase/refund, − charge
                reason text not null check (reason in ('grant','purchase','hold','release','charge','refund','adjustment')),
                job_id uuid → generation_jobs, operation_key text not null, created_by text,  -- admin id for grants
                created_at timestamptz not null default now(),
                unique (user_id, operation_key)                                       -- replays can't double-charge
```

- Append-only ledger; the wallet row is a cached sum, changed only in the same transaction as a ledger insert.
- RLS: users `select` their own wallet and ledger rows; no client writes (column grants as in M2). The backend writes with the secret key.
- `reserve` = one transaction: lock the wallet row (`for update`), check `balance - held >= cost`, add a `hold` ledger row keyed by the job id, increase `held`. `settle` turns the hold into a `charge` (`balance -= cost`, `held -= cost`); `refund`/`release` remove the hold. Each step keyed `job:<id>:<step>` so a retried worker can't apply it twice.
- A `SupabaseCreditGate` implementing `CreditGate` would call these as Postgres functions (`security definer`, executable by `service_role` only), like `claim_generation_job`.
- Provider cost logs (`run_log.jsonl`, model usage) stay separate from the wallet, as CREDITS.md requires.

## Decisions waiting on the product (from CREDITS.md) and the code point each one changes

| Decision | Code point |
|---|---|
| Exact prices per action | `WARDROBE_CREDIT_PRICES` (or a `credit_prices` table if prices must change without a restart) |
| Garment photos with several pieces: per photo or per piece? | Today a garment job costs one price per photo. Per piece needs the hold sized as a maximum at `reserve` and the real count at `settle` (the worker knows `item_ids`). |
| Charge on success vs. on a later Save step | `settle` in `api/worker.py` `run_once` (on success today) |
| Free regenerations / refund thresholds | `refund` in `_fail`; `release` in `queue_job` |
| Promotional grants (F&F), approvals, limits | ledger `reason = 'grant'`, an admin-only script or endpoint |
| Paid packs and iOS in-app purchase | ledger `reason = 'purchase'` from a verified App Store server notification |
| Balance meter and low-balance UX | a future `GET /v1/credits` (balance, held, recent ledger rows) and the Account tab |

## App touch points (later)

- Account tab: balance and meter, link to the price list (`GET /v1/prices`).
- Capture, Add back and Make 360 buttons: show the cost from the price list before starting; on HTTP 402 show "Not enough AI credits" (the client already turns `{"error": ...}` into a sentence) and keep the closet usable.
