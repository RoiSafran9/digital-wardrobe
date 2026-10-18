# Claude Code Task — AI Credits: F&F Wallet Foundation and Billing Roadmap

Status: **Approved product direction; task for research, planning and first implementation milestone**
Date: 2026-10-18
Repository: `RoiSafran9/digital-wardrobe`

## Objective

Implement the **foundation for one AI Credits wallet per authenticated Digital Wardrobe user**, preserving the existing Expo / React Native app, Supabase Auth + Postgres + private Storage and FastAPI/Gemini generation pipeline.

This is **not** an invitation to add payments, subscriptions, publicly launch billing or rewrite the pipeline. Start with short current-documentation research and repo inspection, prepare a reviewed technical plan, then implement **Milestone 1 only**: a secure wallet, auditable ledger and admin-controlled promotional grants, behind today's disabled billing mode.

Read `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `README.md`, `docs/CREDITS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/SCREENS.md`, `docs/superpowers/specs/2026-10-18-credits-readiness.md`, current migrations/tests and actual source code before changing files. Identify deviations between plans and shipped code. Inspect current branch, Git status and active PRs before edits.

## Product contract

- One **pooled** credit balance per account. Credits are a product unit, not underlying model tokens or currency.
- Charge for user-facing **AI generation actions**, never for garment ownership or the number of saved records alone.
- Distinct actions: **front image**, **optional back image**, **one bundled 360** (four generated views count as one charge).
- An item may start with front only and be enhanced with a back photo and/or 360 later.
- **Provisional F&F price ratios for planning**: front = 1 credit; back = 1; 360 = 3 (total). These are not active billing and not real-launch financial pack prices.
- Existing wardrobe remains browsable at zero credits. User-initiated generation needs enough credits when enforcement is enabled.
- Never separately charge internal model calls, model retries or quality checks. For actual product billing, terminal failure should release/refund its reservation, with idempotent accounting.
- In-app **AI Price List** and price displayed before actions will be driven by the server, not duplicated constants in the app.
- Account screen will display an available balance and a truthful usage indicator; avoid an invented percentage when top-ups are pooled.
- F&F: grant promotional credits via a trusted admin-only path. The size of the grant, administrator roles, expiry policy, public packs and payment flow remain **unapproved**.
- Manual user-triggered regeneration prices, what to do with generated-but-not-saved previews and final criteria for billable success remain **open**; don't silently make policy decisions.

## Current implementation: inspect and build upon it

- `api/credits.py`: `CreditGate` interface, `NoCharge` default, env-driven `WARDROBE_CREDIT_PRICES` and three internal keys `garment`, `back`, `turn`.
- `api/routes/v1.py`: authenticated job endpoints, `GET /v1/prices`, idempotency key, reserve/release integration and recorded `cost_credits`.
- `api/worker.py`: calls settle on success and refund on final failure; it currently marks the job succeeded before settling.
- `api/main.py`: explicitly instantiates `NoCharge` in account mode, so no real balance enforcement exists.
- `supabase/migrations/20261018140000_job_cost_credits.sql`: job cost metadata only.
- `supabase/migrations/20261018130000_claim_generation_job.sql`: expired-running jobs may be marked failed by the queue function without passing through the worker's credit-refund hook.
- `mobile/app/(tabs)/account.tsx`: email/sign-out screen, with no credit balance, history or price list.
- `docs/CREDITS.md`: records approved product direction, provisional pilot rates and still-open billing decisions.

Verify all of the above against latest files rather than assuming the paths or behavior are unchanged.

## Required short technical research before implementation

Use official, current guidance for Postgres concurrency/transaction integrity, Supabase RLS and privileged RPC function security, and robust payment-like ledger patterns. Compare (briefly) two representations:
1. `credit_wallets(balance, held)` plus append-only `credit_ledger`;
2. deriving available balance solely from a ledger.

Recommend the simplest safe approach and explain how wallet cache and ledger remain consistent under crashes, simultaneous requests and retries. Design server-only operations using authenticated owner identity; never allow mobile direct writes.

Do not add an external payment provider or new queue infrastructure.

## Milestone 1 — Wallet + Ledger + F&F Grants (IMPLEMENT NOW)

Deliver a focused PR (e.g. branch `feat/ai-credits-wallet`) with:

1. **Schema migration:** wallet owned by `auth.users`; auditable, append-only ledger; explicit nonnegative constraints; indexes; operation and job references; idempotency constraints; RLS + grants so authenticated clients may read only their own balances/activity and may not directly mutate credits. Support disabled users and account deletion appropriately. Decide whether to initialize a zero-balance wallet on signup and describe why.
2. **Atomic, trusted operations:** a grant path (admin-only), plus secure transaction primitives for reserve, settle and release/refund, reusable by `CreditGate`. Stable operation keys must prevent duplicate grants/charges. Do not trust a user ID from an unverified client input. Secure PostgreSQL functions with restrictive execution privileges and safe search paths when using `SECURITY DEFINER`.
3. **Admin F&F grant tooling:** minimal audited CLI or other safe admin-only mechanism that identifies the recipient and requires an explicit amount and reason. **Do not auto-grant an invented amount to all users.** Require clear, idempotent execution; no administrative credentials in mobile.
4. **Read-only API:** authenticated `GET /v1/credits` exposing available balance, held balance, and optionally recent ledger entries with pagination. Return simple, stable schema and tests. Keep price list as a separate existing API.
5. **No live billing yet:** production account-mode app continues using `NoCharge` while wallet migrations/grants are tested. Don't enable balance gating or change generation UX in this PR.
6. **Tests:** pgTAP two-user read isolation and denied mutations; concurrent reserve requests, overspend prevention, duplicate operation IDs, replay-safe settle/release, negative amounts, invalid/missing user, refunded terminal failure simulation, grants audit and schema migration. Add backend tests for the new API.
7. **Developer setup:** local Supabase migration/test instructions, admin grant examples with placeholder values, no secrets; document feature flags/default-off behavior.

## Milestone 2 — Connect billing to existing AI jobs (PLAN, DO NOT IMPLEMENT YET)

Propose a focused follow-up PR to replace the `NoCharge` gate with the wallet-backed gate only behind explicit owner-approved opt-in.

Before enabling, investigate and plan fixes for:

- **Photos containing several garments.** Current `garment` job creates multiple front images but costs once per photo. Action-based pricing requires a transparent, approved counting/quoting model. Compare (a) preview/detect/choose then confirm exact number and (b) user-approved maximum billable outputs, reserve the maximum and settle only successful requested front creations. Explain latency, model-call cost and implementation tradeoffs. **Do not pick and deploy a surprise billing rule without owner approval.**
- A garment job might report success with **zero** usable images; do not charge simply because job status is succeeded.
- Expired jobs marked failed by Postgres outside worker `_fail` must not strand held credits.
- Worker can crash after item persistence or marking a job succeeded but before settling. Make accounting self-healing with idempotent reconciliation.
- Ensure `reserve → job insert` and job result/settlement failure paths cannot leave permanently held funds.
- Ensure unknown/unconfigured action prices **fail closed**, not silently free, when billing is enabled.
- Use the price snapshot on the job (and optionally a version) so jobs do not reprice mid-flight.
- Never double debit from API retry, polling, duplicate worker execution, job lease reclaims or concurrent requests.
- Add realistic end-to-end tests with fake AI and two authenticated accounts.

## Milestone 3 — App UX (PLAN, DO NOT IMPLEMENT YET)

- Account screen: available credits, optional held amount, truthfully labeled progress/usage display, transaction history and **AI Price List** using server data.
- Show cost and expected balance before front/back/360 generation. Include clear consent for multiple front outputs and low-balance error states.
- Refresh credit balances following grant, charge, release/refund and account change. Clear account-specific caches on sign-out.
- Keep current visual system from `DESIGN.md`, English app copy and iPhone accessibility support.
- No in-app payment UI until the owner separately approves real-launch pricing and purchases.

## Milestone 4 — Paid public launch (OUT OF SCOPE)

Purchase packs, Apple IAP/server verification, real-money pricing, tax, expiry and receipts are deferred to a separate decision and project.

## Required outputs

Before code:
- Concise research notes with official links.
- A clear schema/transaction diagram, risk analysis and 3-milestone execution plan.
- Call out any technical blocker that needs owner action.

During this assignment:
- Implement and test **Milestone 1 only**, on a scoped branch based on current `main`.
- Update the relevant architecture/credits/roadmap documentation to reflect what is actually built.
- Run database, backend and relevant mobile regression tests. State what could not be executed.
- Commit, push and open a PR targeting `main`; **do not self-merge**.
- Summarize remaining Milestone 2 decisions, especially multi-garment quote and terminal failure reconciliation.

Make small, secure changes. Preserve all existing multi-user work and generation behaviors. There should be no live charge until explicitly approved and tested.
