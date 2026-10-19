# Roadmap — Digital Wardrobe
Updated: 2026-10-19

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
- [x] Approve **free one-time automatic starter Credits for each new eligible F&F beta user**, no in-app purchases; exact amount not finalized (40 proposed)
- [ ] Approve starter size (40 suggested), invite/eligibility policy and manual top-up limits; manual regeneration policy and any later public pricing
- [x] Wallet M1: per-account wallet, append-only ledger, backend-only grant/reserve/settle/release with idempotency, admin F&F grant CLI, read-only `GET /v1/credits` — billing still off ([design](superpowers/specs/2026-10-18-ai-credits-wallet-design.md), [brief](tasks/ai-credits-wallet-implementation.md))
- [x] Approve multi-piece accounting: the user approves a maximum number of fronts per photo; charged only for fronts made
- [x] Billing M2: wallet-backed `CreditGate` behind `WARDROBE_BILLING=on` (off by default), `max_fronts` cap, partial settle, reconcile of expired/crashed jobs, fail-closed prices
- [x] Account AI Credits card (available, held, used of granted), **AI Price List** and credit activity (M3)
- [x] Price and balance before capture, + Back and 360; pieces-per-photo picker; out-of-credits states (M3)
- [ ] Phone check of the credits UI with billing on (owner), then switch `WARDROBE_BILLING=on` for F&F
- [ ] F&F grant process, activity tracking and cost caps
- [ ] Before paid public launch: payments and receipt verification, refunds and App Store compliance

## Outfit Photo import — planned, NOT BUILT

- [x] Agree product direction: keep existing garment-only photos, add a **worn-outfit two-stage import** for a photo of a person wearing clothes.
- [x] Agree Stage 1 detection/candidate preview + user selection, followed by Stage 2 quality generation **only for selected garments**.
- [x] Agree Stage 1 detection is **free to the user**; confirmed successful high-quality front-image actions use the existing wallet and server price list.
- [x] Document [feature spec](superpowers/specs/2026-10-19-outfit-photo-two-step-design.md) and [Claude Code research/POC task](tasks/outfit-photo-two-step-flow.md).
- [ ] Research current worn-garment extraction methods, quality and commercial/privacy licenses.
- [ ] Offline POC on consented person photos compared to the same real garments laid flat; report fidelity and cost.
- [ ] Approve launch scope, candidate UI, uncertainty disclosure and subjective failure/regeneration credit policy.
- [ ] Implement secure candidate scan with previews, selection and confirmation (do not modify existing garment-only route).
- [ ] Integrate HQ generation, per-selected action billing, privacy tests and resumable jobs, all behind feature flag.
- [ ] Implement iPhone candidate selection and final review; limited F&F experiment.

## TestFlight Friends & Family Beta — next main delivery

**Master plan:** [Beta TestFlight launch master plan](tasks/testflight-beta-launch-master-plan.md)  
**Claude Code kickoff:** [Beta TestFlight staged execution](tasks/testflight-beta-launch-execution.md)

- [x] Set beta direction: real iOS TestFlight build, external friends, per-account private wardrobe, free welcome Credits, **no purchases/subscriptions/payments**.
- [ ] Freeze beta scope and migrate to a supported image-generation model with full regression evaluation; decide whether Outfit import is ready or feature-flagged for a follow-up.
- [ ] Complete hosted Supabase auth SMTP, verified 6-digit email codes, database migrations, private storage and off-LAN account tests.
- [ ] Implement secure **exactly-once welcome-credit grant** after verified eligible signup (40 proposed, configurable; reuse existing wallet/ledger).
- [ ] Host FastAPI + durable worker behind HTTPS, with bounded concurrency, timeouts, restarts and cost controls; demonstrate mobile data usage with Mac off.
- [ ] Ship user-initiated account deletion covering private photos, privacy/support links and safe data retention policy. *(Deletion built in redesign M8: `DELETE /v1/account` + Account → Delete Account; privacy/support links and the retention policy still open.)*
- [ ] Add operational health, AI cost monitoring, free Outfit-detection rate limits, provider-failure kill switch, privacy-respecting basic analytics.
- [ ] Configure Apple Developer / Expo EAS / `mobile/app.json` app identity / `mobile/eas.json`; build and upload store-signed TestFlight IPA.
- [ ] Run end-to-end phone checks and Apple external Beta App Review; invite 3–5 testers, then 10–20 if stable.
- [ ] Confirm 5 friends can complete sign-in → free credits → create → reopen closet with no help, on networks other than home Wi-Fi.

## iOS redesign (design handoff) — [spec](superpowers/specs/2026-10-19-ios-redesign-design.md), [plan](superpowers/plans/2026-10-19-ios-redesign.md)
- [x] M0 design system · M1 onboarding and sign-in · M2 names and groups · M3 Home and Closet · M4 Garment Details · M5 Add and garment flow · M6 outfit flow · M7 Account · M8 job progress and Delete Account (PRs #18–#26, stacked)
- [ ] Owner phone check of each milestone; apply `20261019140000_job_progress.sql` to hosted (`npx supabase db push`)
- [ ] Later: free garment pre-scan (D6 b), outfit corrections / missed garment / regenerate (D13, D14), profile name (D8), push "notify when ready" (D10), help and privacy links (D17)

## Next (candidates — owner to pick)
- Main priority: follow the [Friends & Family Beta Master Plan](tasks/testflight-beta-launch-master-plan.md) — no payment integration in beta
- Complete startup credit grant, cloud hosting, hosted auth and native iOS/TestFlight distribution
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
