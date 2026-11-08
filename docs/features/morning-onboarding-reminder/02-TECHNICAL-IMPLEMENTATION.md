# Technical Implementation Plan — One-Time Morning Outfit Reminder

**Stack:** Expo SDK 58 / React Native / Expo Router / `expo-notifications`. API FastAPI on Mac, Supabase hosted. **Use local scheduled notification for MVP.**

## 1. Verified integration points

| File | Existing responsibility | Change |
|---|---|---|
| `mobile/src/notifications.tsx` | `NotifyProvider`, handler and job-result push registration | Add separate onboarding-reminder controller (or provider composition). **Do not equate `notify.enabled` with reminder opt-in or mutate push-token settings.** |
| `mobile/app/_layout.tsx` | Auth → Credits → Notify → AppShell | Mount one app-wide reminder lifecycle/response observer after auth hydration and before navigation; avoid duplicate subscriptions. |
| `mobile/src/auth/AuthProvider.tsx` | `status`/`userId` and account transitions | Use existing user-scoped identity; cancel on sign-out/account switch safely (consider dependency order). Do not leak account A state to B. |
| `mobile/app/first-pieces/index.tsx` | First 3 Pieces entry + worn option | Support `entry=reminder` (extend allow-lists) or dedicated typed internal preselection. The worn option should be selected on notification tap, source actions visible. Preserve current analytics and `onboarding=1`. |
| `mobile/src/firstPieces/offer.ts` | One-time guided onboarding offer | Respect its eligibility and avoid prompt clashes; don't re-run First3 auto-offer when a nudge opens intentionally. |
| `mobile/src/components/home/HomeEmpty.tsx`, `mobile/app/(tabs)/index.tsx` | Empty closet and guided CTA | Contextual opt-in in a non-blocking surface only after First3 was introduced; don't hide First3 entry, and don't prompt on every Home render. |
| `mobile/app/(tabs)/account.tsx` | Existing `Notify when ready` toggle | Add clearly separate `One-time morning reminder` pending state/cancel control; show correct granted/denied status; don't reuse job-result switch. |
| `mobile/src/api/client.ts` | `getItems()` / authenticated closet | Use authoritative saved closet rows for 0–2 vs ≥3; reuse existing API, no new endpoint required. Handle unavailable response conservatively. |
| `mobile/src/activity/track.ts` and `api/activity.py` | Strict event schemas, event privacy categories | Add bounded events and allow-lists; extend `onboarding_started.entry` to `reminder` if used. Keep old cohort report semantics. |
| `mobile/__tests__/notifications.test.tsx` | Current job-result notification toggle tests | Keep existing tests green, add independent reminder tests in new `morningReminder.test.ts` etc. |
| `mobile/__tests__/FirstPiecesStart.test.tsx` | First3 type and source navigation | Add notification-entry preselect and permission/flag failure tests. |

Re-inspect current code on latest `main`; the unified Add Clothes UX may still be in flux. Coordinate navigation with its implemented behavior rather than implementing a second add screen.

## 2. Suggested file structure (names adaptable)

- `mobile/src/notifications/morningReminder.ts` — pure eligibility, local-date calculation, state serialization/deserialization and idempotence helpers.
- `mobile/src/notifications/MorningReminderProvider.tsx` — async manager (user/permission/closet changes) and testable scheduling adapter.
- `mobile/src/notifications/MorningReminderOptIn.tsx` — small contextual opt-in card; no modal immediately after app opening.
- `mobile/src/notifications/notificationRouting.ts` — shared notification response/tap routing for startup + live events, safely ignoring unrelated job-result pushes.
- Keep `mobile/src/notifications.tsx` job-completion behavior intact. If restructuring imports to a directory creates resolution ambiguity, use e.g. `mobile/src/morningReminder/*` rather than an identically named index.

## 3. Core scheduling algorithm

On authenticated, eligible, user-initiated `Remind me`:
1. Check feature flag **off by default**, `WARDROBE_OUTFIT` capability, account state and authoritative saved closet count. If server cannot confirm count, don't schedule (show retry).
2. Check local per-user one-time state: if previously declined/scheduled/opened/terminal, do not create duplicate.
3. Query `Notifications.getPermissionsAsync()`; if not suitable, request only at user action using `Notifications.requestPermissionsAsync()`. Check effective iOS permission status incl. provisional distinctions; for MVP prefer alert-capable explicit permission, don't mark denial as success. Reuse `trackPermission`.
4. Compute next eligible phone-local 08:45 `Date`, ≥12 hours after consent. Ensure exactly one future timestamp and no repeated trigger.
5. Call `Notifications.scheduleNotificationAsync({content:{title,body,data:{kind:"onboarding_morning_outfit_v1"}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date}})`; save returned notification identifier, intended date and state under a versioned `AsyncStorage` key `morningReminder.v1.<userId>`.
6. Retry/reconcile cautiously if storage write fails or the app terminates between native schedule and persistence: inspect `getAllScheduledNotificationsAsync` for the exact `data.kind` and cancel duplicate/orphan reminders **only of this feature**. Use a serialized in-memory operation lock for rapid taps and async rendering; do not schedule the same user twice across remounts.
7. Expose enabled/scheduled and cancellable state in Account. For already sent or expired, show no re-arming prompt automatically.

**Pure date function example policy:** for `now = Monday 17:00`, schedule Tuesday 08:45. For `now = Monday 23:30`, Tuesday 08:45 is too soon (under 12h), so Wednesday 08:45. Never schedule at past date due DST/clock changes; test those conditions. iOS may delay actual display due Focus/Scheduled Summary.

**Critical note:** local notification should NOT rely on app background JS timers or worker/Mac availability to fire.

## 4. Cancellation and reconciliation

Cancel **only by the saved notification ID** (`Notifications.cancelScheduledNotificationAsync(id)`), not `cancelAllScheduledNotificationsAsync()`; the latter could affect unrelated KIPS notifications.

Triggers:
- At the moment a third item is **persisted and confirmed saved** by the server; integrate across **both** garment and worn flows, after success in regular import and First3. Do not infer from "3 scans", "3 generated" or "3 selected".
- Whenever app returns to foreground / auth/closet refresh reports ≥3 actual saved items.
- When user disables from Account (optional choice but must work).
- On sign-out/account deletion/account change.
- If permission is revoked or outfit import disabled and app becomes aware.

Race guard:
- After scheduling, re-read verified closet state if necessary; cancel if completion happened during scheduling.
- Before changing local state, validate that the async result belongs to the same `userId`; do not schedule under a different signed-in user due late resolution.
- If state expired and OS no longer lists the ID, do **not** schedule again automatically. Track terminal expiry safely, without claiming notification was shown.
- On sign-out, cancel the prior user reminder **before clearing user-specific data or lose mapping**. After account switch, never expose a private A reminder under B.

**Limits:** when app is terminated, deletion/completion on another device does not trigger on-device cancellation. A previously delivered notification also cannot be unsent. This is a documented MVP limitation (see 01 `9).

## 5. Tap and cold-start handling

Use `Notifications.addNotificationResponseReceivedListener` + supported last response API as documented in installed Expo version (SDK 58). Recognize only `request.content.data.kind === "onboarding_morning_outfit_v1"`; ignore other job-result pushes, which carry `job_id/kind`.

Navigation requirements:
- Wait for Expo Router root mounted and auth/loading state resolved; do not route during initial render before `RootNavigator` is ready.
- Deduplicate by notification request ID / last response and mark handled in a per-user or session-safe state, so an old response does not hijack future ordinary launches.
- Signed out → sign-in flow (or no automatic navigation) and re-evaluate after login; signed in but different account → safe Home.
- Signed in, incomplete, outfit enabled → `/first-pieces?entry=reminder&photoType=worn` (or equivalent typed route), preselect `Someone wearing them` and reveal **Take Photo / Choose from Library**. Preserve Back/Close, no automatic camera permission, file picker or paid job.
- Re-check saved items and feature availability before routing. If ≥3, route Home instead.
- Mark `reminder_opened` only for actual tap; don't count `notification scheduled` or mere app open as a tap.
- A local notification displayed while app is already open should not unexpectedly navigate unless tapped. Keep the existing foreground handler behavior for `Notify when ready`.

## 6. User-facing opt-in placement

Don't insert the permission prompt directly after install, login or OTP. Offer one explanatory card when signed-in new user has encountered the First3 guided flow and returns to Home / after saving the first piece; also avoid showing next to other bottom sheets or while a job is submitting. Suggested text is in 01. `Not now` means no repeated prompting. Offer a separate Account control to cancel a pending reminder and (if declined/permission denied) voluntarily opt in later; one-time send remains one-time.

Preserve the normal onboarding, three-piece goal, existing background job notifications and `FirstPiecesProvider`. Don't gate primary task completion on notification choice.

## 7. Privacy-safe first-five telemetry

Add a small closed-vocabulary set of optional app events, to **both client and backend allow-lists**, e.g.:

| Event | Props | Interpretation |
|---|---|---|
| `onboarding_nudge_choice` | `choice: accepted|declined` | explicit opt-in choice, **not** actual OS permission/delivery |
| `onboarding_nudge_scheduled` | `slot: morning` | OS schedule API returned ID successfully, not displayed |
| `onboarding_nudge_cancelled` | `reason: three_saved|opt_out|sign_out|permission_off|outfit_off` | attempt to cancel pending reminder |
| `onboarding_nudge_tapped` | `entry: notification` | received user tap and processed routing |

If retaining old `onboarding_started.entry` analytics, extend choices from `auto|starter|home` to include `reminder` in client and server; do not change historical event semantics or cohort KPIs. Existing metrics "meaningful return" must still require meaningful action on another day, not a notification tap alone.

No notification content, photo URLs/URIs, user IDs, token, email, precise hour, free-text copy or device identifiers in event properties. If app privacy policy changes meaningfully, update `site/public/privacy/index.html` and `docs/APP_STORE_CONNECT.md`. Avoid storing a new push-token registration or transmitting reminder data to a vendor.

## 8. Gates / rollout

- Use a **static app-side flag default OFF** (name and location follow existing config conventions), to gate opt-in/offering and scheduling. Changing it in production or submitting a new build is an owner decision; don't silently change remote flags.
- No migrations, no account table, no background scheduler, no new third-party provider.
- Feature implemented and mock-tested in branch or under repo instructions, but **no real notifications sent to testers**, no EAS build submitted and no Mac restarted until owner approval.
- If SDK 58 installed API differs from docs examples, use the installed types; don't downgrade or upgrade Expo just for this.
- Manual device test required; TestFlight delivery is never inferred from Jest tests.

## 9. Suggested phases

1. Inspect latest code, active branches, account and First3 logic; implement pure date+eligibility helpers.
2. Add device local state manager (one per account) with opt-in, permission and schedule ID reconciliation.
3. Add contextual explanatory UI and separate Account cancellation/permission state.
4. Wire user-saved-count cancellation and foreground/account-change reconciliation.
5. Add cold/warm notification response routing and safe First3 worn preselection.
6. Add privacy-safe events + allow-list/tests and verify prior push system unaffected.
7. Run available tests; explain integration/device test gaps; code-ready review; deploy only on approval.
