# AI Credits — Product Decision and Proposed Design

Status: **Unified action-based credits approved · initial F&F price ratios selected for planning, not deployed; public pricing and remaining billing policies pending**
Date: 2026-10-18
Scope: AI-generation costs only. Server hosting, storage volume, subscriptions and financial package prices are separate decisions.

## Confirmed
1. Every account has **one shared AI Credits balance**. Do **not** create independent quotas such as `100 garments + 4 turns`.
2. **Credits are charged for user-facing AI generation actions, not for owning, counting or storing garments.** Each explicitly requested billable action deducts a published amount from the single wallet. Creating a front catalog image, adding a back image and creating a 360 view are distinct operations; the same garment can be enriched over time without buying it again.
3. An in-app **AI Price List** tells users how many credits each available action costs. The action screen shows its cost before the user triggers it.
4. The Account/profile screen shows **credits remaining** with a readable progress/usage meter. Users can continue browsing already saved items even at zero credits.
5. Pricing uses product-defined **credits**, not the underlying provider's token count or dollars. Internal model calls, quality checks and automatic retries are NOT separate user-facing charges. One requested 360 creation produces four model-generated views but is priced as **one 360 action**.
6. F&F participants can be granted promotional credits; real-launch users may be offered paid credit packs. Packages and specific quantities have not been finalized.

## Action types to price
- Create Front Image: produce an AI-generated front catalog image from an input photo, with vision classification. **Current code uses the internal operation key `garment`; the user-facing action should be named for the generated front image rather than the wardrobe entity.**
- Add Back Image: generate a back-side catalog image from an additional back photo.
- Create 360 View: generate four AI ghost-mannequin angles.
- Manual Regenerate Image: only available in contexts where product UX allows it; pre-save regeneration currently exists as a product decision. Whether/how to charge manual repeated generations is **open**.

### Initial F&F action-price baseline (2026-10-18)

The owner agreed to proceed with the following **provisional pilot pricing ratios**, which are **not yet implemented**:

| User-facing action | Credit cost | Current backend key |
|---|---:|---|
| Generate Front Image | **1 credit** | `garment` |
| Generate Back Image | **1 credit** | `back` |
| Generate 360 View | **3 credits total** | `turn` |

A 360 action creates four internal views but is one user-facing charge. Adding a back image and/or a 360 to a previously created garment are independent optional actions. Merely viewing, editing, keeping or deleting a wardrobe item is not a new generation charge. Automatic model retries must not create additional user-facing charges.

These are **F&F implementation-planning values only**, not paid pack prices, public-launch pricing or authorization to turn live billing on. The actual F&F grant amount, charging semantics, regenerated previews and bulk-photo quote remain open. The client price list and the server-side charge must always agree; never hardcode rates in mobile UI.

## UX
- Account: balance, explanatory usage meter, links to AI Price List and eventual credit activity/purchase options.
- Price List: clear English action names and credit values from a server-controlled price table.
- Action entry: display the balance and price. Explain when credit will be spent, including any multi-garment detection implications.
- Insufficient credits: no paid generation, but existing wardrobe remains usable.
- Credits may come from several grants/purchases. Any usage bar must state the reference allocation or avoid presenting an ambiguous percentage.

## Proposed integrity/security
- Server authenticates account and derives user ID itself.
- Trusted backend handles an append-only ledger and atomic reservation/settlement/refund; mobile app never directly edits balances or prices.
- Repeated requests share a stable operation ID and cannot double charge.
- No hidden per-provider-model-token charging; failed generations and internal automatic retries should not surprise users.
- A single source photo may lead to several AI-generated front images. **Do not equate one photo, one wardrobe item or one underlying model call with one charge automatically.** The exact counting/confirmation rule for multi-piece creation remains open; show and confirm the number and total cost of billable generation actions before charging, including an upper bound or explicit selection.
- F&F promotional grants must be auditable and controlled by an administrator.
- Keep the underlying AI API usage/cost logs independent from the user credit wallet.

## Product decisions needed before coding real billing
1. **Provisional F&F ratio is 1 front / 1 back / 3 for 360**, but final deployment/public prices still require verification. Define the charging/confirmation rules when one photo produces several front images. Never frame the price as ownership of a wardrobe item.
2. Charge when successful generation completes versus at Save; handling created-but-unsaved previews.
3. Number of free user-triggered regenerations, failure/refund thresholds.
4. Initial F&F grant size, who can approve top-ups, limits and duration.
5. Real-launch free trial/packs/prices, expiration policies if any, and iOS in-app purchase flow.
6. Account balance meter definition and low-balance experience.

## Proposed server design
(Moved here from this decision's first ARCHITECTURE draft, so the proposal stays next to the decisions.)
- Proposed tables: `credit_wallets(user_id, available_credits, updated_at)`; append-only `credit_ledger(id, user_id, delta, action_type, operation_id, price_version, status, created_at)`; server-owned `ai_action_prices(action_type, credits, effective_at)`. Schema, indexes and entitlement receipt handling require review.
- The server derives the user from the verified Supabase token, never a client-supplied `user_id`. Only the server sets prices, grants/refunds/debits credits and writes ledger entries; no service-role secret in the app.
- **Atomically reserve** enough credits before invoking AI; settle on a defined successful result or release/refund on failure. A stable `operation_id` plus transaction constraints prevent duplicate debits on retries and polling. The business definition of *successful result* is open.
- A photo may contain several garments: users see the total potential charge and approve it, or select which garments to create, before one photo causes multiple charges.
- The same server-authoritative prices feed the in-app AI Price List and every action entry point. F&F admins issue promotional credits through a protected grant operation; public packs and payment receipts come later.
- Monitor API/model cost separately from user credits; log action type, attempts, model cost, ledger operation, outcome and per-user usage without exposing private photos.
- Test data isolation, atomic debit under parallel requests, insufficient-credit refusal, retries, failure releases/refunds and ledger auditability.

## Current repository state
Accounts exist (multi-user M1–M4): Supabase email-code sign-in, per-user Postgres rows with RLS, private Storage, and AI work as server jobs on a FastAPI backend that still runs on the owner's Mac. Multi-user M5 added **credits-readiness hooks only**, described in [credits integration notes](superpowers/specs/2026-10-18-credits-readiness.md): billing is off, and there is no wallet, ledger, balance, meter, price-list screen, grant tool or purchase. Real charge enforcement and credit packs remain future work.

## Spec vs built hooks (M5)
This record and the built hooks were written separately. Where they differ, neither is rewritten here; the difference is listed so the owner can decide.

| Topic | This spec | Built in M5 |
|---|---|---|
| Price source | Server-owned price table (`ai_action_prices(action_type, credits, effective_at)`, see Proposed server design) | `WARDROBE_CREDIT_PRICES` env JSON read at server start; no table, no `effective_at`. Unset = billing off. |
| Action types | Create Garment, Add Back Image, Create 360, possibly Manual Regenerate | `garment`, `back`, `turn` only. There is no Regenerate action in the app. |
| Multi-piece photos | **Action-based** billing is confirmed. The exact rule for multiple front-image creations from one source photo is still open and needs a quoted/confirmed total. | A `garment` job is priced once per photo, whatever the number of pieces, without a confirmation step. Supporting multiple billed generation actions per photo needs agreed accounting, reservation and settlement. |
| When credits are spent | Open: on successful generation vs at Save; unsaved previews | There is no Save step: results go straight to the closet. The hook settles when the worker finishes the job successfully and refunds when it fails for good. |
| Internal retries and failures | Must not surprise users | Matches: internal retries neither settle nor refund; a job that fails for good is refunded; a repeated `Idempotency-Key` returns the existing job without a second hold. |
| Insufficient credits | No paid generation; wardrobe stays usable | `reserve` can raise `InsufficientCredits` → HTTP 402 "not enough AI credits" before anything is uploaded or queued. The default gate (`NoCharge`) never raises, so this path is unused today. The app has no dedicated screen for it. |
| Ledger shape | `credit_wallets(user_id, available_credits, updated_at)`; `credit_ledger(…, action_type, operation_id, price_version, status, …)` | Not built. The integration notes propose a different shape: wallet `balance` + `held`, ledger `reason` (`grant`/`purchase`/`hold`/`release`/`charge`/`refund`/`adjustment`) with `unique (user_id, operation_key)`. |
| Price shown to users | In-app AI Price List and price at each entry point | `GET /v1/prices` returns `{"billing": false, "prices": {}}`; no app screen uses it yet. Each job stores `cost_credits` (null while billing is off). |
| Example figures | 1 / 1 / 3 are illustration only, not approved | The `.env.example` and integration notes reuse the same figures as a format example only; nothing is hardcoded. |

## Next engineering delivery — wallet foundation

See [Claude Code AI Credits task](tasks/ai-credits-wallet-implementation.md) for a staged research and implementation brief. First ship an **inactive** authenticated wallet, append-only ledger, admin-controlled F&F grants and transaction/idempotency tests. Do **not** enable paid-job enforcement until multi-piece quoting, terminal failure reconciliation and user-facing price confirmation are reviewed.
