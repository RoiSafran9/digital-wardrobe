# AI Credits — Product Decision and Proposed Design

Status: **Product direction approved · numerical prices and billing policies pending**
Date: 2026-10-18
Scope: AI-generation costs only. Server hosting, storage volume, subscriptions and financial package prices are separate decisions.

## Confirmed
1. Every account has **one shared AI Credits balance**. Do **not** create independent quotas such as `100 garments + 4 turns`.
2. Each **billable user-facing AI generation action** consumes credits from that balance.
3. An in-app **AI Price List** tells users how many credits each available action costs. The action screen shows its cost before the user triggers it.
4. The Account/profile screen shows **credits remaining** with a readable progress/usage meter. Users can continue browsing already saved items even at zero credits.
5. Pricing uses product-defined **credits**, not the underlying provider's token count or dollars. Model retries remain an internal cost concern.
6. F&F participants can be granted promotional credits; real-launch users may be offered paid credit packs. Packages and specific quantities have not been finalized.

## Action types to price
- Create Garment: generate an item from a supplied photo, with vision classification.
- Add Back Image: generate a back-side catalog image from an additional back photo.
- Create 360 View: generate four AI ghost-mannequin angles.
- Manual Regenerate Image: only available in contexts where product UX allows it; pre-save regeneration currently exists as a product decision. Whether/how to charge manual repeated generations is **open**.

For illustration only, a possible conversion discussed was **1 credit per garment / 1 per back / 3 per 360**. **These figures are NOT approved and must not be surfaced as final prices or hardcoded as business rules.**

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
- A single photo might contain multiple garments: present a maximum or item-level confirmed price before generation.
- F&F promotional grants must be auditable and controlled by an administrator.
- Keep the underlying AI API usage/cost logs independent from the user credit wallet.

## Product decisions needed before coding real billing
1. Exact prices by action, and whether photo-based batch creation is per detected garment.
2. Charge when successful generation completes versus at Save; handling created-but-unsaved previews.
3. Number of free user-triggered regenerations, failure/refund thresholds.
4. Initial F&F grant size, who can approve top-ups, limits and duration.
5. Real-launch free trial/packs/prices, expiration policies if any, and iOS in-app purchase flow.
6. Account balance meter definition and low-balance experience.

## Current repository state
The existing iOS client communicates with a Mac-hosted FastAPI server over the local network, with local filesystem item data. Authentication, per-user databases, hosted storage, wallets, real charge enforcement and purchased credit packs are **future work**, not implemented features.
