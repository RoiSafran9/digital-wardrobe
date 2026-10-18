# Roadmap — Digital Wardrobe
Updated: 2026-10-18

## Done — single-owner app
- [x] Pipeline: quality check → one Gemini call for detection + facts → crop → catalog image with color/text check and retries → tier
- [x] Simplified to Gemini only (SAM and Claude judge dropped)
- [x] FastAPI backend on the owner's Mac over the LAN; Expo Go iPhone app: capture, results, closet
- [x] Edit an item's facts; soft delete (recoverable)
- [x] Retake guidance; pieces past the photo edge completed with a tip
- [x] Optional back photo
- [x] Local background removal (rembg cutouts), white parts kept opaque
- [x] Native iOS redesign: Home tab, motion, haptics, dark mode
- [x] API found on any Wi-Fi without config
- [x] Optional AI 360 "on body" view (four ghost-mannequin angles, background job)

## Multi-user phase ([design](superpowers/specs/2026-10-18-multiuser-architecture-design.md))
- [x] M1 — Authentication foundation: email-code sign-in, encrypted persisted session, guarded navigation, Account tab, local mode for development
- [x] M2 — Database schema, RLS, private Storage bucket and policies, two-account isolation tests
- [x] M3 — FastAPI verifies Supabase tokens, Postgres-backed generation jobs, results in private Storage, migration of local `runs/`
  - [x] M3a — backend: token verification, `/v1` jobs/items API, worker, `claim_generation_job`, `runs/` migration script
  - [x] M3b — app: send the token, use `/v1`, poll jobs, signed image URLs (server stays on the Mac for now; tunnel documented, not set up)
- [x] M4 — End-to-end two-user verification (automated on the local stack; on-device check by the owner), storage sweeper, product docs updated
- [x] M5 — Credit system readiness: job `cost_credits`, server price list (off), credit gate hooks, `GET /v1/prices`, [integration notes](superpowers/specs/2026-10-18-credits-readiness.md); no payments

## Owner steps open
See README → "Owner setup still open": hosted Supabase SMTP and email template, `db push`, backend secret key, moving the current closet, the on-device account-mode check.

## AI Credits workstream ([decisions](CREDITS.md))
- [x] Approve one pooled credit balance per account and a transparent in-app AI price list
- [x] Approve **billing by requested AI generation action**, not by owned garment: front image, optional back image and one bundled 360 creation
- [x] Authentication and user-scoped data, migration from local files (multi-user M1–M4)
- [x] Hooks: job `cost_credits`, server price list (off), credit gate, `GET /v1/prices` (M5)
- [x] Select provisional F&F action rates for planning: **1 front image / 1 back image / 3 for one 360** (not active billing)
- [ ] Approve manual regeneration policy, F&F grant size and public-launch pack prices
- [x] Wallet M1: per-account wallet, append-only ledger, backend-only grant/reserve/settle/release with idempotency, admin F&F grant CLI, read-only `GET /v1/credits` — billing still off ([design](superpowers/specs/2026-10-18-ai-credits-wallet-design.md), [brief](tasks/ai-credits-wallet-implementation.md))
- [x] Approve multi-piece accounting: the user approves a maximum number of fronts per photo; charged only for fronts made
- [x] Billing M2: wallet-backed `CreditGate` behind `WARDROBE_BILLING=on` (off by default), `max_fronts` cap, partial settle, reconcile of expired/crashed jobs, fail-closed prices
- [ ] Account remaining-credits/usage meter and **AI Price List** screen
- [ ] Show price and balance before generation; handle insufficient credits in the app
- [ ] F&F grant process, activity tracking and cost caps
- [ ] Before paid public launch: payments and receipt verification, refunds and App Store compliance

## Next (candidates — owner to pick)
- AI Credits: app UX (M3: balance, price list, cost and `max_fronts` before capture, 402 state), then switch billing on for F&F; purchases later
- A cloud host for the backend and worker (or the documented tunnel), then EAS build and TestFlight
- Better print fidelity across 360 angles (prompt work or a better model)
- Labeled eval set of real photos to measure fidelity
- Restore a removed item inside the app
- Remove unused `anthropic` / `replicate` dependencies from `pyproject.toml`

## Later (from the first planning docs; not built, undecided)
Kept so the intent isn't lost; none is committed.
- A pre-save Review step: Generated/Original toggle, Regenerate/Retake, explicit Save Item (today results go straight to the closet)
- Regenerating an already-saved item from its retained original (account-mode items now keep the original upload)
- A fixed category list (the plan had nine: T-Shirts, Shirts, Sweaters & Hoodies, Pants, Shorts, Jackets & Coats, Shoes, Accessories, Dresses & Skirts); brand, name and notes fields
- Original-photo retention notice and controls for deleting retained originals
- Outfit creation and recommendations, weather/context suggestions, AI wardrobe search

## Workflow
Small focused commits directly to `main` (the owner's choice); a branch or PR when the owner asks. Record material product or architecture changes in the PRD/architecture docs in the same change.
