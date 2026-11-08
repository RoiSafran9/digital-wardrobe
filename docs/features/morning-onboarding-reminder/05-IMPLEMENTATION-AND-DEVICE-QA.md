# Implementation & Device QA — One-Time Morning Outfit Reminder

**Built:** 2026-11-08, behind `EXPO_PUBLIC_MORNING_REMINDER` (unset = **off**). Automated tests pass (see §4). **Real-iPhone QA: NOT RUN.** No reminder was enabled for beta users, scheduled for a tester or sent; nothing was deployed, no TestFlight build was made, the Mac server was not touched.

## 1. What a person sees

1. Signs in → First 3 Pieces is shown (auto-offer, starter-credits screen, or Home's "Get Started"). Nothing about reminders yet; no iOS prompt.
2. Back on Home with 0–2 saved pieces and outfit photos on: one glass card — **Want a reminder tomorrow morning?** · "Already dressed? A mirror photo is a quick way to add what you're wearing to KIPS." · "One reminder only. You can turn it off in Account." · **Remind Me** / **Not Now**. It sits under the First 3 Pieces card (empty closet) or under Add clothes (1–2 pieces), and hides while a photo or round is being made.
3. **Not Now** → never shown again on Home (Account → Morning reminder can still turn it on deliberately).
4. **Remind Me** → the app checks the saved closet on the server, then (only now) asks iOS for notification permission, then schedules one local notification and says "Reminder set for tomorrow at 8:45 AM" (or the weekday). Refused → "Notifications are off …" once, nothing scheduled.
5. Next eligible morning 08:45: **Your outfit can start your closet 👕** / "Heading to work or class? Snap a mirror photo, then pick the pieces to add to KIPS 📸".
6. Tap → First 3 Pieces with **Someone wearing them** already chosen and **Take Photo** / **Choose from Library** showing. No camera, picker, scan or paid work starts. With 3+ saved pieces or outfit photos off → Home.
7. Account → Settings → **Morning reminder** switch (shown while one is set, or after Not Now / refused / turned off): off cancels it; separate from **Notify when ready**.

Button labels use the app's Title Case ("Remind Me", "Not Now"); the spec's sentence-case copy is otherwise verbatim.

## 2. Rules as built

- **Flag:** `REMINDER_ENABLED` in `mobile/src/morningReminder/schedule.ts` reads `EXPO_PUBLIC_MORNING_REMINDER` at bundle time; only `on` enables it. With it off, no card, no row, no scheduling, and any reminder of this kind left on the phone is cancelled.
- **Time:** `nextReminderDate(now)` — the next calendar day at 08:45 local, pushed a day later until ≥ 12 h away (Mon 17:00 → Tue 08:45; Mon 23:30 → Wed 08:45). One `DATE` trigger, no repeat. Built from calendar fields, so DST nights stay 08:45 wall time.
- **Permission:** asked only inside Remind Me. Provisional (quiet) authorization doesn't count. `trackPermission("notifications", …)` is reused. No Expo push token is requested or registered.
- **Record (per account, this phone):** AsyncStorage `morningReminder.v1.<userId>` = `{status, id?, fireAt?, reason?, introSeen?, at}`; statuses `unseen | declined | denied | scheduling | scheduled | opened | cancelled | expired`. All changes run through one serialized queue in `MorningReminderProvider`.
- **Notification ID lifecycle:** write `scheduling` (+ planned time) → cancel any stray reminder of this kind → `scheduleNotificationAsync` → write `scheduled` + id. If the id can't be written, the notification is cancelled again. On sign-in and every return to the app, `getAllScheduledNotificationsAsync` is reconciled: a `scheduling` record adopts the reminder iOS has (extras cancelled) or goes back to `unseen`; a `scheduled` one whose time passed or that iOS no longer lists becomes `expired` (never re-armed, never counted as delivered); any other notification with `data.kind = onboarding_morning_outfit_v1` is cancelled. Job-result notifications (`job_id`/`kind`) are never touched. Cancelling is always `cancelScheduledNotificationAsync(id)`; `cancelAllScheduledNotificationsAsync` is never called.
- **Cancels (on this phone):** third saved piece (any successful account `getItems()` reports the saved count; garment photo, First 3 Pieces jobs and outfit review call `noteItemsSaved()` which re-checks the closet only while a reminder is pending), Account switch off, sign-out / switching account (the previous account's record is cancelled with `sign_out`), Delete Account (cancelled and the record removed), notifications turned off in iOS Settings (next app activation), outfit photos off on the server.
- **Tap:** `MorningReminderTaps` (in `AppShell`) takes the launch response (`getLastNotificationResponse`, then `clearLastNotificationResponse`) and live taps; only the default action on `kind = onboarding_morning_outfit_v1`. It waits for auth to settle, the root navigator to mount and the server flags (up to 5 s, then opens First 3 Pieces anyway — its screen adapts). The tap belongs to the signed-in account only if that account's record holds the notification id — so no account id is ever in the payload. Another account's → Home; already opened → nothing (no hijacked launches). Mine → record `opened`, `markOffered` (so the auto-offer doesn't also open), saved count re-checked, then `/first-pieces?entry=reminder&photoType=worn`.
- **Events** (client `mobile/src/activity/track.ts` + server `api/activity.py`, category "onboarding"): `onboarding_nudge_choice {choice: accepted|declined}`, `onboarding_nudge_scheduled {slot: morning}`, `onboarding_nudge_cancelled {reason: three_saved|opt_out|sign_out|permission_off|outfit_off}`, `onboarding_nudge_tapped {entry: notification}`; `onboarding_started.entry` gains `reminder`. No ids, times, text or notification content. Old events and the activation/usage reports are unchanged. (A `sign_out` cancel is usually not recorded: the account's event queue has already stopped.)
- **No** new dependency, backend scheduler, migration, AI call, credits rule or push campaign. Delivery does not need the Mac.

**Known limit (by design for the MVP):** while the app is closed, nothing re-checks the server. A third piece saved on another device can't cancel this phone's reminder, and an alert already shown can't be unsent. The tap then routes to Home (three pieces), so there's no onboarding loop.

## 3. Files

New: `mobile/src/morningReminder/schedule.ts` (pure rules), `closetSignal.ts`, `MorningReminderProvider.tsx`, `MorningReminderTaps.tsx`, `MorningReminderCard.tsx`; tests `mobile/__tests__/morningReminder.schedule.test.ts`, `morningReminder.provider.test.tsx`, `morningReminder.taps.test.tsx`.
Changed: `mobile/src/RootNavigator.tsx` (mount), `app/(tabs)/index.tsx` (card), `app/(tabs)/account.tsx` (switch, Delete Account), `app/first-pieces/index.tsx` (`photoType=worn`, intro seen), `src/api/client.ts` (saved count), `src/store/captureJobs.tsx`, `src/firstPieces/FirstPiecesProvider.tsx`, `app/outfit/review.tsx` (`noteItemsSaved`), `src/activity/track.ts`, `src/firstPieces/analytics.ts`, `api/activity.py`, `mobile/jest.setup.js` (notification mocks), `mobile/.env.example`, tests for Account / Home / First 3 Pieces / `tests/api/test_activity.py`, docs.

## 4. Test map (03 §B)

| ID | Where |
|---|---|
| N01–N04, N07 | `morningReminder.schedule.test.ts` (`shouldOffer`), `morningReminder.provider.test.tsx` |
| N05, N06, N24 | schedule test (incl. the machine zone's DST nights) + provider test (trigger shape, fake clock) |
| N08, N09 | provider test (denied, provisional, Notify-when-ready token present, no `getExpoPushTokenAsync`) |
| N10, N11, N25 | provider test (count report, `noteItemsSaved`, 2 pieces keep it) |
| N12, N13 | provider test (double tap, restart, failed id write, orphan adoption) |
| N14, N15, N16 | provider test + taps test (A vs B), Account test (Delete Account) |
| N17–N21, N23 | `morningReminder.taps.test.tsx` |
| N22 | provider test + `tests/api/test_activity.py::test_morning_reminder_events_take_only_fixed_choices` |
| N26 | provider test (AppState active, permission off) |
| N27 | existing suites unchanged and green; `FirstPiecesStart.test.tsx` adds the preselected path |

## 5. Signed-iPhone QA (owner, consenting QA account only)

Record PASS / FAIL / BLOCKED / NOT RUN, build number and iOS version, no identifying screenshots. Use a development or internal build with `EXPO_PUBLIC_MORNING_REMINDER=on` in `mobile/.env` — **not** a public beta build. Expo Go works for local notifications; a signed build is still needed before any beta decision.

To avoid waiting overnight, temporarily change `nextReminderDate` in a **local, uncommitted** edit to `new Date(now.getTime() + 2 * 60_000)` (or set the phone clock to 08:40 the next morning after scheduling). Revert before any commit.

1. Fresh QA account, 0 pieces → First 3 Pieces shows first; no iOS prompt at install, sign-in or code entry. Back out to Home → the card appears once.
2. **Not Now** → card gone; kill and reopen → still gone; Account shows the Morning reminder switch off.
3. New QA account → **Remind Me** → iOS prompt appears now (first time) → Allow → "Reminder set for …". Check it is exactly one (switch on in Account; optionally log `getAllScheduledNotificationsAsync()` in a dev build).
4. Background the app; at fire time the alert shows (Focus/Scheduled Summary may delay it). Tap → First 3 Pieces, **Someone wearing them** selected, Take Photo + Choose from Library visible; nothing opens by itself.
5. Repeat with the app killed (swipe away) → tap → same screen, once; reopen the app normally later → no jump to First 3 Pieces.
6. With the app open in the foreground at fire time → banner only, no navigation until tapped. A "Notify when ready" job push still shows and behaves as before.
7. Set a reminder, then save the third piece **before** it fires — once through a garment photo, once through an outfit photo → Account switch disappears; no alert at fire time.
8. Account → Morning reminder off → no alert; **Notify when ready** keeps its own state.
9. Deny notifications at the iOS prompt → "Notifications are off …", nothing scheduled, no repeated prompts. Then allow in iOS Settings, reopen, turn it on from Account → scheduled.
10. Set a reminder as A, sign out, sign in as B before fire time → no alert; if one shows anyway (e.g. already displayed), tapping opens B's Home, nothing of A's.
11. Set a reminder, turn notifications off in iOS Settings, reopen the app → reminder cancelled (Account switch off with the explanation).
12. Set a reminder, turn `WARDROBE_OUTFIT` off on a **test** server, reopen → cancelled; tap of an old alert → Home.
13. Known limit: save the third piece on a second device while this phone's app is closed → this phone may still show the alert; tapping it opens Home. Record as expected behaviour.
14. Mac offline at tap time → First 3 Pieces opens after a short wait; taking/choosing a photo shows the usual network error; nothing saved or charged.
15. Delete Account with a reminder set → no alert later.

## 6. Owner-only steps

- **Activation (done 2026-11-08, owner decision):** `mobile/eas.json` → `build.production.env.EXPO_PUBLIC_MORNING_REMINDER = "on"`, so every `production` EAS build (TestFlight) has it. To turn it off again, remove that line and ship a new build; the next launch of that build cancels any pending reminder of this kind.
- Run §5 on a real iPhone (the TestFlight build) and record results here.
- Restart the Mac API on the latest `main` so the server accepts the new `onboarding_nudge_*` events and `entry=reminder`; until then those events are dropped by the old allow-list (the app keeps working).
- Optional: mention the reminder (a local notification; nothing leaves the phone) on the privacy page / App Store Connect notes if you want it disclosed beyond "usage records".
