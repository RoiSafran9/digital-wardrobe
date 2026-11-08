# KIPS — One-Time Morning Outfit Reminder (First-Five Beta)

**Status:** implemented behind `EXPO_PUBLIC_MORNING_REMINDER` (unset = off). **Turned on for EAS `production` builds by the owner on 2026-11-08** (`mobile/eas.json`); development builds and Expo Go stay off unless `mobile/.env` sets it. Automated tests pass; **real-iPhone QA NOT RUN** before activation (owner's decision). No reminder has been enabled for beta users, scheduled for a tester or sent. See [05-IMPLEMENTATION-AND-DEVICE-QA.md](05-IMPLEMENTATION-AND-DEVICE-QA.md).
**Prepared:** 2026-11-08.
**Baseline inspected:** GitHub `main` at `3577a0462b258ff8df3065ed68be00eaeea3856c`; Claude must pull latest safe `main` before implementing.
**Product goal:** help a new KIPS user resume building their wardrobe by attaching one small action to an existing morning habit: photographing what they are already wearing.

## The decision

- **One optional, consented, local iPhone notification** on the next eligible morning, **not a daily campaign**.
- The nudge is offered **contextually after sign-in and initial First 3 Pieces exposure**, not via a notification prompt at app launch. Never interrupt a capture, scan, payment sheet or signup flow.
- **Eligible:** signed-in first-time beta account, 0–2 actually saved closet items, worn-photo import enabled, one-time invitation not previously declined/used. New feature is off by default behind a local app configuration flag until approved.
- **Separate opt-in:** "Notify when ready" is for processing completion; it is **not** consent for onboarding reminders.
- **Schedule:** one local notification for approximately **08:45 phone-local time on the next calendar morning**, preserving a sensible overnight gap (details in 01).
- **On tap:** authenticated user is directed to the **First 3 Pieces / Someone wearing them** path, with **Take Photo** and **Choose from Library** available. No capture and no AI call starts automatically.
- **Cancel on this device:** when third item is confirmed saved, reminder disabled, signed out, account deleted, or permission revoked; never cancel unrelated notifications.
- **Known limitation:** an iOS local reminder cannot re-check the server while the app is closed. If the account reaches three pieces on a different device, the first device may still display the scheduled alert. Don't describe this as guaranteed backend-state cancellation.
- **No Mac dependency at send time**, new backend job scheduler, provider, model calls, credits, DB migration or cloud migration.
- Test both **background/terminated** and **foreground** handling; prevent duplicate scheduling/opening.

## Documents

1. [01-PRODUCT-LIFECYCLE-SPEC.md](01-PRODUCT-LIFECYCLE-SPEC.md) — user journey, opt-in, timing, copy and state transitions.
2. [02-TECHNICAL-IMPLEMENTATION.md](02-TECHNICAL-IMPLEMENTATION.md) — actual repo surfaces, implementation order, device-bound lifecycle, navigation and analytics.
3. [03-ACCEPTANCE-QA-AND-PILOT.md](03-ACCEPTANCE-QA-AND-PILOT.md) — tests, privacy and first-five learning.
4. [04-CLAUDE-CODE-IMPLEMENTATION-PROMPT.md](04-CLAUDE-CODE-IMPLEMENTATION-PROMPT.md) — copy/paste instructions to implement with Claude Code.
5. [05-IMPLEMENTATION-AND-DEVICE-QA.md](05-IMPLEMENTATION-AND-DEVICE-QA.md) — what was built, where, the test map and the signed-iPhone QA script.

## Current implementation verified in repo

- `mobile/src/notifications.tsx`: `expo-notifications` handler + opt-in for `Notify when ready`, using Expo push token registered with the API. No morning scheduling or notification tap navigation.
- `api/push.py`: sends job-result **remote** notifications through Expo. Do not modify this feature.
- `mobile/app/(tabs)/account.tsx`: existing notification switch is job-completion only.
- `mobile/app/first-pieces/index.tsx`: two evidence types, including "Someone wearing them" with camera/library, and `onboarding=1` routing.
- `mobile/src/firstPieces/FirstPiecesProvider.tsx` and `mobile/src/firstPieces/offer.ts`: protected signup/onboarding and resumable item creation.
- `mobile/src/activity/track.ts` + `api/activity.py`: strict event-name/property allow-lists and privacy categories.
- `mobile/app/_layout.tsx` mounts `NotifyProvider`; `expo-router` navigation is available elsewhere.
- `mobile/package.json` includes Expo SDK 58 and `expo-notifications`; no new package is necessary.

## Scope and safety

Documentation is committed to `main`; **implementation must follow repository `AGENTS.md` workflow unless the owner requests a branch/PR**. Do not merge, deploy, enable an actual reminder for real users, change notification permissions, restart live Mac services, submit TestFlight, or send any real user notification without explicit owner approval. Tests may simulate scheduling via mocks and a consenting QA device.

Sources:
- Expo Notifications (schedule/date/cancel/response): https://docs.expo.dev/versions/latest/sdk/notifications/
- Expo receive/response: https://docs.expo.dev/push-notifications/receiving-notifications/
- Apple notification authorization guidance: https://developer.apple.com/documentation/UserNotifications/asking-permission-to-use-notifications
