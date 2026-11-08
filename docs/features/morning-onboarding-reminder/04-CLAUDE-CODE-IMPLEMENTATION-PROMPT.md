# Claude Code Implementation Prompt — One-Time Onboarding Morning Reminder

Paste this message into Claude Code inside `RoiSafran9/digital-wardrobe`:

---

**Task:** Implement an opt-in, one-time local iOS notification that helps a new KIPS user resume the First 3 Pieces onboarding using a mirror photo of the outfit they're wearing.

This is an **implementation request**: inspect, code, test and deliver, not merely propose another plan.

## Mandatory reading

1. Check `git status`, active branch, pending work and latest `main`. Pull safely, without overwriting concurrent work.
2. Read `AGENTS.md`, `CLAUDE.md`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md` and the current first-five beta docs.
3. Read **all** documents in `docs/features/morning-onboarding-reminder/` in order:
   - `README.md`
   - `01-PRODUCT-LIFECYCLE-SPEC.md`
   - `02-TECHNICAL-IMPLEMENTATION.md`
   - `03-ACCEPTANCE-QA-AND-PILOT.md`
4. Inspect current `mobile/src/notifications.tsx`, `api/push.py`, `mobile/app/_layout.tsx`, `mobile/app/(tabs)/account.tsx`, `mobile/app/first-pieces/index.tsx`, `mobile/src/firstPieces/offer.ts`, `mobile/src/firstPieces/FirstPiecesProvider.tsx`, `mobile/src/api/client.ts`, `mobile/src/activity/track.ts` and `api/activity.py`.
5. Confirm the current Expo SDK and installed `expo-notifications` API/types before writing code. Avoid unnecessary dependency additions.

## User-facing feature

- A new user who has **0–2 real saved wardrobe items** can choose to get **ONE** helpful reminder after initial onboarding context.
- Show an unobtrusive choice (not a mandatory modal): `Want a reminder tomorrow morning?` with **Remind me** / **Not now** and one-time disclosure.
- Do not request iOS notification permission until **Remind me** was tapped.
- This is a **separate explicit consent** from existing **Notify when ready** (AI job completion notifications). Don't change that setting or request/register Expo push token as part of this feature.
- If consent and iOS permission are granted, schedule **one local DATE notification** using `expo-notifications` at **08:45 local phone time next eligible calendar morning**, with at least **12 hours** after permission/opt-in, no repeat.
- Suggested message:
  - Title: `Your outfit can start your closet 👕`
  - Body: `Heading to work or class? Snap a mirror photo, then pick the pieces to add to KIPS 📸`
- Notification tap (warm, background or cold-start) takes an authenticated eligible user to **First 3 Pieces with "Someone wearing them" preselected**, exposing **Take Photo** and **Choose from Library**; never automatically open camera or generate an AI image.
- Recheck user eligibility and flag on resume/tap. If 3 pieces already saved or outfit import is off, navigate safely to Home.
- On **confirmed third saved piece** in either garment/worn flow, user opt-out, account change/sign-out/delete, permission revocation or outfit-off, cancel **this one pending reminder**. Never `cancelAllScheduledNotificationsAsync`; other KIPS notifications must work.
- One-time state is account-scoped, persistent, idempotent across restarts and rapid taps. Handle AsyncStorage failure, native scheduled-ID orphan, foreground behavior, login hydration, stale notification responses and account A vs account B.
- Keep the feature **off by default in application configuration** until owner approves activation. Don't secretly activate it for current beta users.
- Use local scheduling so notification delivery doesn't depend on the owner's Mac being powered on. Acknowledge limitation: **a local scheduled alert cannot be reliably revoked when the same user completes onboarding on another device while this iPhone is closed**. Do not claim a guaranteed backend-state check at delivery time.
- Add minimal privacy-safe activity events with fixed enum props on both client and backend; if `onboarding_started.entry="reminder"` is used, extend both allow-lists. Preserve existing first-five KPI definitions.

## Engineering constraints

- Reuse existing routes and First 3 Pieces camera/library behavior; do not add another onboarding or Add screen. Align with the unified Add Clothes implementation (it may have evolved since the spec).
- No new AI call, AI prompt, credits, billing rule, purchase, new vendor, backend scheduled campaign, database migration, hosted background task, or cloud hosting migration.
- Existing `Notify when ready` push feature, job-result notifications and per-account ownership must remain intact.
- No private photos, IDs, emails or push tokens in event props or notification payloads.
- Do not introduce automatic daily reminders or an intrusive permission prompt at sign-up.
- No changes to production config or Mac services; no store submission/TestFlight build or real-user reminder delivery without explicit owner approval.
- Follow the Git workflow in `AGENTS.md`, unless I explicitly requested a different workflow. Avoid overwriting other agents' work.

## Implement in small steps

1. Pure eligibility and next-local-morning scheduling calculation.
2. Account-scoped local reminder manager, native notification ID persistence, reconciliation and cancellation.
3. Single contextual opt-in card + independent account cancellation affordance.
4. Lifecycle checks and cross-flow third-saved-item cancellation.
5. Notification tap observer with one-time routing, auth and router readiness; First3 worn path preselected.
6. Strict privacy-safe analytics events and server allow-list tests.
7. Comprehensive tests per `03-ACCEPTANCE-QA-AND-PILOT.md`, including new consent, denied permissions, double taps, restart, cancellation, and cold start.
8. Provide a manual signed iPhone QA procedure for scheduled delivery and notification tap. **Do not mark actual TestFlight/physical-device tests PASS unless you ran them.**

## Verification

Run from repo root, as available:

```bash
PYTHONPATH=$PWD .venv/bin/pytest -q
cd mobile && npx jest && npx tsc --noEmit
```

Run integration/pgTAP only when test dependencies exist. If unable, explicitly mark NOT RUN with the reason. Preserve existing tests for job-completion push notifications. If no real device can be used, leave device test status **NOT RUN**, not PASS.

## Final handoff

Summarize: exact files changed, UX behavior, trigger and opt-in logic, local notification ID lifecycle, deep link, unit/integration test results, privacy and billing safety, known cross-device limitation, what remains for real-device verification, and any owner-only activation/build steps.

**Implement now. Do not send a real notification to a tester, activate flags, merge a PR, deploy to the Mac, or submit a TestFlight build without explicit owner approval.**

---
