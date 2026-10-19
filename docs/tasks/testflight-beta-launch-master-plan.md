# Digital Wardrobe — Friends & Family TestFlight Beta Launch Master Plan

**Status:** Planning proposal — NOT implemented or approved for live rollout  
**Prepared:** 2026-10-19  
**Goal:** First independent external iOS testers using TestFlight, free starter AI Credits, functioning private wardrobes, without the owner's Mac running.  
**Audience:** Owner, Claude Code, project contributors.  
**Sources of truth:** `PRODUCT.md`, `README.md`, `docs/ROADMAP.md`, `docs/CREDITS.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SCREENS.md`, `AGENTS.md`, `CLAUDE.md`. This plan describes proposed future work; update those files *as changes actually ship*.

## 1. Launch goal and non-goals

### Launch promise

A friend who was invited can:

1. Receive a TestFlight invite; install the real signed iOS app on their own iPhone.
2. Sign up or sign in with a six-digit code delivered to their own email.
3. Automatically receive **one free starter pack** of AI Credits without an administrator having to run a command for each sign-up.
4. See a clear, truthful price list and remaining credits.
5. Import one/multiple garment-only photos; optionally add backs and create one four-view 360 action.
6. If the Outfit Photo experiment meets its quality gate, import selected garments from a photograph of a person wearing them, with a free detection-and-selection step and explicitly authorized high-quality generation.
7. View/edit their *own* wardrobe across app restarts and mobile networks. Other users cannot access it.
8. Recover gracefully from AI timeouts, uploads failing, network disconnects and app restart, without double charging.
9. Report feedback, contact support and delete their account/data.
10. Do this without the owner's Mac, home Wi-Fi, personal intervention or credit-card details.

### In beta scope

- Hosted always-available FastAPI + AI worker.
- Existing Supabase Auth/Postgres/private Storage and account separation, configured on hosted environment.
- Free user starter credits (proposed amount below), server-authoritative action prices and ledger.
- Action-based AI credit charges for front/back/360, with internal retries free.
- Private images, error recovery, operational controls, privacy and user-initiated deletion.
- Real EAS production build, App Store Connect and external TestFlight groups.
- A minimal feedback and usage-measurement loop.
- Conditional Outfit Photo import behind a beta flag, *only after quality, privacy and cost gates are passed*.

### Explicitly out of scope

- Any real-money payments, Apple in-app purchases, credit pack purchases, subscriptions or checkout.
- Public App Store release, Android launch, viral/public open signup, elaborate admin UI, social features, outfit recommendations, guaranteed 3D models, growth tooling.
- A new database, rewrite of the garment-only AI pipeline, elaborate Kubernetes or separate queue platform unless measurements justify them.

**Beta scope rule:** If Outfit Photo does not pass its proof-of-quality gate, release the already-working garment-only/back/360 experience through TestFlight. Outfit Photo can follow in an update. Do not allow open-ended AI research to block the entire beta.

## 2. Current repo baseline — confirmed by GitHub on 2026-10-19

**Already built in source code:**
- Expo SDK 57 / React Native / Expo Router phone app, English UI and product screens.
- Existing laid-flat garment detection, image generation, cutout, retry and scoring; optional back and 360.
- Supabase email-code auth, Postgres schema + Row Level Security, private Storage and owner-scoped FastAPI API.
- Generation jobs with durable Postgres queue, retries, idempotency, worker in the FastAPI process.
- AI Credits wallet, append-only ledger, admin `scripts/grant_credits.py`, server-side per-action pricing, optional billing flag `WARDROBE_BILLING=on`, partial settle and reconciling stuck holds.
- Account UI showing credit balances and activity, front-count quote, prices for back and 360 (when billing on).
- Automated Python, app, database and integration tests.

**Not yet verified as a working externally hosted product:**
- Backend currently on the owner's Mac; mobile API URL defaults to an Expo LAN-based address unless overridden.
- Hosted Supabase SMTP / 6-digit-code template, migrations, hosted API secrets and on-phone cross-network test are listed as owner steps in `README.md`; confirm their actual completion before assuming any are still pending.
- No `mobile/eas.json` found on `main`, `mobile/app.json` name is `mobile`, with no finalized `ios.bundleIdentifier`.
- No automatic welcome-credit grant; current new-user wallet starts at zero, manual CLI grants available.
- No production health/alerting/runbook/automated end-user account deletion was verified.
- Billing OFF by default; feature toggling, hosted pricing and phone testing are needed before a beta charge is enabled.
- Outfit Photo experiment exists as an OPEN PR #14, `feat/outfit-photo-poc`: prompts, offline POC, real/photo tests and proposed integration; **it is not yet a shipped app feature**.
- The primary Gemini image model in `pipeline/providers/gemini.py` is `gemini-2.5-flash-image`; the PR #14 experiment compared alternatives and recommends `gemini-3.1-flash-image` as a candidate, but production migration/compatibility still require review.
- Some legacy docs describe old statuses (e.g. credits "hooks only"). Trust current code and update docs after real milestones.

## 3. Free welcome pack — proposed beta product policy

**Recommendation for review:** **40 AI Credits** per eligible new beta user, configurable server-side; NOT hardcoded in React Native, and not auto-enabled without owner confirmation.

Pilot price baseline (from `docs/CREDITS.md`, check server config):
- 1 Credit per **successfully generated front**.
- 1 Credit per **successfully generated back**.
- 3 Credits per **one complete 360 action**, not per each of its four internally generated views.
- Stage 1 Outfit detection + cropped previews cost **zero user Credits**; all AI/vendor calls still cost the app.
- No extra debit for model retries, failed jobs, merely viewing/storing garments or changing metadata.
- No automatic balance reset/recurring refill, credit expiration or monetary value during the F&F pilot. Consider discretionary manual admin top-ups using the existing admin script.

**Who is eligible:** for the first closed F&F beta, an invited/allowlisted email can complete OTP sign-in and receive a pack. A second account or uninvited signup should not automatically create an unlimited-cost entitlement. If the owner opts for fully open signup, add abuse protections and explicitly approved account-spend policy first.

**Technical requirements — propose implementation:**
1. Use the existing zero-balance wallet and the server-only `credit_grant` SQL RPC/ledger. Do not create a parallel balance or special per-action quota.
2. Trigger a welcome grant after the user's **first verified/authenticated successful beta session**, not on unverified form submission. Implement a server-authorized idempotent account-bootstrap operation, e.g. `POST /v1/bootstrap`, called after token verification; a server-owned one-time operation key derived deterministically from the account ID and grant policy (e.g. `welcome:beta-v1`, unique per user) prevents duplicate grants across two devices, retries and reinstalls.
3. Check beta invitation/eligibility and disabled account state on the server; never trust an app-provided user ID, amount, admin name or new operation key.
4. Apply ledger credit grant atomically before presenting its result; concurrent requests yield **one grant** only, and the user may immediately see the credits in Account. Clear/refetch on sign-out/account switch.
5. Config-controlled pack size and feature flag; enabling/reducing/granting packs in production is an explicit owner decision, with audit and rollback handling.
6. Do **not** inadvertently give existing users a second starter pack. Decide whether to seed existing testers manually or allow one backfill under the same unique welcome key.
7. Ensure no secret/service-role key appears in Expo `EXPO_PUBLIC_*` or the mobile bundle. Keep grants backend-controlled only.
8. Test first login, same-user double tap, concurrent devices, re-install, sign-out/sign-in, delayed retries, disabled/ineligible user, migrated account and exhausted balance.
9. Do not call a side-effecting grant invisibly from every plain GET without deliberate documented semantics; prefer explicit idempotent bootstrap.

**Open approval:** exact welcome size (40 proposed), invitation policy and whether existing accounts receive a one-time beta grant. No payment implementation is required.

## 4. Delivery sequencing

The phases below can overlap once dependencies are met. Each should be a separate focused PR, with code + tests + accurate docs, not one giant agent change.

### Phase 0 — Freeze beta scope and finish critical AI decisions

**Work:**
- Review open Outfit PR #14, including POC quality, observed hallucinations, licensing and cost. Agree on a small gate for integration or defer it to a later beta build.
- Review/change model used for image generation: validate that a currently supported Gemini image model works with front, back and 360 (color, OCR/text, white background, response format, latency, retries, per-action API cost). Add sane model-call timeouts and classify transient vs permanent failures.
- Make an explicit beta feature list and use flags for `OUTFIT_IMPORT_ENABLED`, `AI_GENERATION_ENABLED` or equivalent; fail safely with a helpful error if the model is unavailable.
- Decide exact initial credits, beta invite policy, who manually tops up and maximum app/provider budget.
- Inventory current hosted Supabase and Apple/Expo account access (ask owner only for genuinely required external steps).

**Exit gate:** selected working model + regression/eval report; Outfit go/no-go for beta documented; beta scope locked.

### Phase 1 — Hosted Auth, data and automatic welcome credits

**Work:**
- Set up hosted Supabase SMTP and six-digit OTP email template, proper sending domain and email delivery/rate-limit tests.
- Apply/reconcile all migrations on the hosted project, including credits and any approved Outfit schema; check policies, RPC privileges, triggers and storage.
- Prepare a real beta (hosted) environment separate from local development; use an extra staging environment only if needed rather than automatically tripling services.
- Implement **one-time automatic welcome credits** as in §3; use invitation/eligibility policy.
- Confirm the existing Account price list, wallet and ledger UI on two real logged-in devices.
- Select policy for existing user migration from `runs/`, test idempotent migration without deleting originals.

**Exit gate:** a *new eligible tester account* logs in through externally delivered OTP, gets exactly one welcome grant, and reads only their own account/wardrobe data; tests pass.

### Phase 2 — Always-on cloud backend and AI worker

**Work:**
- Choose one managed container host suitable for CPU/RAM-intensive Python OpenCV/`rembg` tasks plus external Gemini calls; e.g. compare Railway and Render based on measured cold start, RAM, worker liveness, cost, logs and deploy/restart characteristics. Don't select by brand alone.
- Add reproducible deployment manifest/Dockerfile, Python dependency pinning, proper health/readiness endpoint, HTTPS domain, TLS, isolated server secrets and deployment checklist.
- Start server in account mode only; keep public auth enforcement on all `/v1` routes. Client must use explicit `EXPO_PUBLIC_API_URL=https://...` on release builds; don't rely on `Expo hostUri` or localhost.
- Keep durable jobs in Supabase Postgres/Storage; ensure worker restarts recover queued jobs, crashed leases and credit holds. Start with one reliable service/worker and bounded concurrency; split API/worker later only when measurements justify it.
- Protect request sizes, timeouts, upload limits, overall concurrency, per-account processing queues, runaway retries, free Outfit-detection rate limits and model provider quotas.
- Introduce coarse health metrics + alerting for worker stalled, queue age, 5xx, AI error-rate, costs, free-pool depletion; keep structured logs free from user images and secrets.
- Schedule safe cleanup of temporary uploads and expired Outfit scans (if enabled). Decide a data backup/restore plan for hosted Supabase.

**Exit gate:** two accounts on different Wi-Fi/cellular networks complete front/back/360 with the owner's Mac **off**, and stored jobs survive API/worker restart without duplicates, data leaks or held credits stranded.

### Phase 3 — Privacy, security, reliability and beta operations

**Work:**
- Add **in-app account deletion request/action** and an authenticated complete deletion path for Auth user, private stored photos (including full-person Outfit originals, previews and generated artifacts), data and credits. Avoid claiming soft-delete of one wardrobe item is account deletion. Document asynchronous removal and legal retention where applicable.
- Publish a simple accessible Privacy Policy URL and in-app disclosure: images are privately stored, and processed by an external AI provider; for pictures containing people, require permission from the person depicted and define original photo/scan retention.
- Review iOS camera/photo permission descriptions, sharing/upload transparency and actual App Store Connect privacy data disclosures.
- Error/retry UX: no spinner forever; network retry, auth-code failure, failed image generation, partial success, over-limit and credits exhausted.
- Add feature flags and an emergency **stop-new-generation** switch; do NOT rely on simply turning billing off as a cost-control kill switch (that makes AI generation free).
- Recheck all auth/RLS/storage cross-account tests, price consistency, daily cost visibility and ledger drift. Make storage cleanup run on a defined cadence.
- Create short incident runbook: what to do if Gemini goes down, credits get stuck, SMTP fails, database unavailable or hosting bill spikes.
- Implement minimal privacy-respecting beta analytics and crash/error reporting: signup, welcome granted, first successful catalog image, AI jobs success/fail, Outfit stage1→selection→generated if enabled, returning users. Do not add invasive analytics SDKs without need.

**Exit gate:** user can recover from routine failures, delete account/data, see clear support/privacy links; owner can stop costly generation and identify production errors.

### Phase 4 — Production iOS build and Apple distribution setup

**Work:**
- Create/verify Apple Developer Program membership and an Expo account/project; these require owner-controlled sign-in and may entail fees.
- Change Expo placeholder `name: "mobile"` to approved app name, select a stable unique `ios.bundleIdentifier`, final icon and launch appearance; appropriate iOS permissions, version/build number, app metadata.
- Add `mobile/eas.json` with an iOS **store-distribution** production/TestFlight profile, plus environment configuration (not ad-hoc `distribution: internal`).
- Configure EAS env vars: public URL, publishable Supabase key and HTTPS API URL; **no backend/admin/Gemini secrets in app bundle**. Build must fail clearly if required public config is missing/points to LAN/localhost.
- Build signed iOS IPA, upload using EAS Submit to App Store Connect; check build processing, crash reporting, app encryption/export compliance as appropriate.
- Prepare app listing/beta test description, support contact, Privacy Policy URL, relevant app privacy answers, review notes and feasible reviewer access to email OTP account flows.
- Test an actual TestFlight build on the owner's phone *before* inviting friends.

**Exit gate:** correct signed build uploaded, installs through TestFlight, connects to hosted services only, and completes a real end-to-end smoke test.

### Phase 5 — External TestFlight pilot

**Work:**
- Submit the first build for **external** tester Beta App Review; invite via App Store Connect email/group or a bounded public link after approval. Friends are normally external testers, not internal App Store Connect team users.
- Round 1: owner + ~3–5 trusted users. Verify the full journey and monitor crashes, latency, costs, wallet reconciliation and success of the most common photo use cases.
- Round 2: expand to ~10–20 testers once Phase 5's first release remains stable. Welcome pack automatically for each eligible new tester; admin top-ups only if needed.
- Publish short "What to Test" instructions and a feedback email/form; ask about signup friction, photo capture, how similar generated items are to real garments, usefulness of back/360, time-to-first-wardrobe and Outfit selection usefulness if enabled.
- Fix blockers first; ship controlled TestFlight builds with incremented build numbers, release notes and rollback plan.

**Exit gate:** at least five real external friends complete the core flow *without owner assistance*, on different networks, and can use the app again after a day/restart. Critical security/data-loss bugs absent; sustained cost remains under the owner's agreed cap.

### Phase 6 — Post-beta decision

Use observed evidence to decide whether to:
- Improve worn-outfit fidelity and roll it to more testers.
- Optimize onboarding and conversion to first item before adding features.
- Add paid credits or launch publicly **only as a separate project** after product learning.

## 5. Parallel tracks and critical dependencies

```text
         Phase 0: freeze beta scope + image-model stability
                         |
             +-----------+-----------+
             |                       |
 Phase 1: hosted Auth +       Phase 2: backend
 welcome grant               deployed to HTTPS
             |                       |
             +-----------+-----------+
                         |
             Phase 3: privacy + hardening
                         |
             Phase 4: signed iOS/TestFlight build
                         |
             Phase 5: external beta & feedback
                         |
             Phase 6: next product decision
```

**Start now in parallel (owner external actions):**
- Apple Developer Program registration and access to App Store Connect; Apple fee applies even though testers are not charged.
- SMTP provider/domain verification and Supabase hosted setup.
- Decide provisional starter pack, invite list and hard cost cap.
- Explore host constraints/prices with one real benchmark container; avoid paying for multiple services until ready.

**Do not gate on:** public payment integrations, new styling features, app-store public launch or complete Outfit research if its integration isn't robust.

## 6. PR-sized engineering backlog

| Order | Proposed change | Owner-facing deliverable | Validation |
|---|---|---|---|
| A | AI model viability + scope freeze | comparison/decision and stable model/timeout PR | catalog/back/360 fidelity and latency regressions |
| B | `feat/beta-welcome-credits` | once-only 40-credit configurable grant after verified eligible login | parallel signup/relogin/idempotency/RLS tests |
| C | `infra/hosted-auth-and-data` | documented hosted SMTP, migrations, environment and backup/restore checklist | 2 hosted accounts, email OTP and privacy checks |
| D | `infra/cloud-api-worker` | deployable FastAPI+worker host, health, secrets and HTTPS | Mac off, cellular E2E, restart recovery |
| E | `feat/beta-privacy-and-controls` | delete account+Storage, privacy/support, rate/cost controls, logs/alerts | actual account erasure, abuse and outage drills |
| F | `build/ios-testflight` | app config, `eas.json`, store-signed build, App Store Connect setup | installed TestFlight smoke test |
| G | `ops/beta-launch` | reviewer notes, invitations, metrics dashboard/runbook, feedback loop | 5 unassisted testers and bounded AI spend |

A/B/C/D may be pursued in parallel if the code boundaries are clear; E before external invitations, F can begin as early as A when config is ready.

## 7. Beta readiness checklist / release gate

All must be demonstrably true before sending broad TestFlight invites:

- [ ] App launches from a signed TestFlight build, not Expo Go.
- [ ] API + worker hosted behind HTTPS; Mac powered off; no public LAN IP dependencies.
- [ ] Supabase hosted project, migrations, private bucket, JWT signing and SMTP working.
- [ ] New invited user gets exactly one free configured starter grant, visible in Account.
- [ ] Balance and server price list match; 1/1/3 is a pilot proposal, never a mobile hardcode.
- [ ] Front/back/360 available through off-home-network use; Outfit behind its own tested flag if enabled.
- [ ] No blank screens or endless spinners on error; reconnect after background/offline or job crash.
- [ ] Cross-user access to garments, people photos, candidates, storage and credits denied.
- [ ] Double-taps and repeated requests cannot double-debit, double-save or double-grant.
- [ ] Failed/abandoned jobs do not strand holds; job and ledger reconciliation runs.
- [ ] New-generation kill switch, per-user rate limits, global spend alarms and a known way to disable new invites.
- [ ] In-app account deletion and verified cleanup of private Storage.
- [ ] Privacy Policy URL, AI photo-data disclosure, permissions copy, support address and beta instructions.
- [ ] Relevant `pytest`, Jest, TypeScript, pgTAP and two-user integration suites green; manual cellular test.
- [ ] Beta builds signed/submitted and external Beta App Review done where required.
- [ ] At least five friends can sign up/import/view without the owner intervening.

## 8. Operational metrics for the first cohort

Use small privacy-respecting counters rather than building a large data warehouse:

1. New authenticated beta users; % successfully receiving starter grant.
2. % of users generating their **first successful front**; time to first usable item.
3. Front/back/360 job success and failure rates, retried/final failures, wait-time percentiles.
4. Credit usage per eligible user, available/held balances, daily grants/charges and wallet drift.
5. Provider model calls, USD cost per **successful** created front/back/360, daily total vs budget.
6. Return use after the initial session; number of new garment items per tester.
7. If Outfit enabled: Stage 1 candidates shown → selected → accepted final output, per-item rejection rate and failure types.

Avoid collecting faces/photographs in analytics or logging other people's image contents; obtain feedback/photo examples directly from consenting testers.

## 9. Explicit open owner decisions

| Decision | Proposal until approved |
|---|---|
| Welcome grant | **40 Credits** once per eligible new beta account, not per login/reinstall |
| Beta access | Invite-only/allowlisted addresses initially; no uncontrolled public-signup credit grants |
| Credit pricing | Server-controlled provisional **1 front / 1 back / 3 per 360** |
| Top-ups | Manually via current admin grant CLI, not an in-app purchase button |
| Grant expiry | None during F&F beta; no recurring monthly refill |
| Outsourced spend | Owner approves a daily/monthly hard budget, alerts and number of concurrent jobs |
| Outfit inclusion | Include only if POC meets an owner-approved fidelity gate; otherwise feature flag off |
| Hosting | Choose smallest proven always-on CPU-capable host after an actual benchmark |
| Account deletion / source retention | Full authenticated deletion path; settle exact retention of original person photos |
| Launch cohort | First 3–5, then ~10–20 testers if healthy |
| Branding | Approve visible app name, icon, unique iOS bundle identifier, privacy/support contact |

The owner must provide external account approvals/credentials and approve any live cost/production change. A coding agent may prepare code/config/docs without unilaterally buying services, sending invitations, switching billing on or deploying to production.

## 10. Official references verified 2026-10-19

- Expo iOS TestFlight: https://docs.expo.dev/submit/testflight/
- EAS build/submit: https://docs.expo.dev/submit/ios/
- Expo EAS environment variables and secrets: https://docs.expo.dev/eas/environment-variables/
- Apple TestFlight guide, external beta review, 90-day builds: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- Apple external invitations: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/
- Apple in-app account deletion: https://developer.apple.com/go/?id=ar-ad-support
- Apple App Privacy and Privacy Policy URL: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase production checklist (including free-plan pausing/backups): https://supabase.com/docs/guides/deployment/going-into-prod
- Apple Developer Program annual membership: https://developer.apple.com/programs/whats-included/
