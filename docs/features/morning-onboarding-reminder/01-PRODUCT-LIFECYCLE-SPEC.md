# Product & Lifecycle Specification — Morning Outfit Reminder

## 1. Problem and hypothesis

The first-five TestFlight pilot asks people to add just three items. Some may postpone the first addition because taking items from a closet feels like work. A morning mirror photo lets them do it while already dressed, linking KIPS to a real moment without a generic "come back" push.

**Hypothesis:** a *single, opt-in* morning prompt makes it easier for a user with fewer than three saved items to add one garment from a worn photo, with no founder intervention.

Not a hypothesis about long-term retention or paid conversion. Never mark a notification-only app open as "meaningful return."

## 2. Proposed exact message (English app / iPhone)

**Title:** `Your outfit can start your closet 👕`

**Body:** `Heading to work or class? Snap a mirror photo, then pick the pieces to add to KIPS 📸`

The copy says "pick" because KIPS detects candidates and the owner chooses which to generate, rather than automatically saving everything. No claim of instant generation or zero cost.

**Explicit pre-permission prompt** (non-system UI; after a relevant first use):
- Title: `Want a reminder tomorrow morning?`
- Detail: `Already dressed? A mirror photo is a quick way to add what you're wearing to KIPS.`
- Primary: `Remind me`
- Secondary: `Not now`
- Disclose clearly: `One reminder only. You can turn it off in Account.`

No request to turn on notification permission until the user selects `Remind me`. Both denial and dismissal must be respected. The existing `Notify when ready` switch does not subscribe to this reminder.

## 3. Eligibility and trigger

Eligibility is evaluated **only after** a successful authenticated session (not merely TestFlight install):
1. `status === "signedIn"` and account id available; local/unconfigured/signed-out modes never schedule.
2. 0, 1 or 2 **actual saved** items in the owner's closet after authoritative `getItems()` / existing saved-state logic, not a photo, scan candidate, pending job, mock onboarding screen or push-token presence.
3. Server has `WARDROBE_OUTFIT=on` at the time of offer (worn import enabled). If off, no offer or scheduled reminder (cancel if app subsequently learns it turned off).
4. No previous accept/decline, consumed, completed or terminal cancellation for this account **on this device**. Do not automatically target existing tester accounts retroactively without an opt-in opportunity.
5. App has shown a relevant onboarding entry / its initial value proposition; offer the opt-in on a safe nonblocking surface after the user finishes/backs out of the First 3 Pieces intro, or on the following Home visit. **Don't put a permission pop-up on top of another modal.** If complex, implement an unobtrusive card on Home beneath First3. Never prevent a first item from being added.
6. Reminder feature is explicitly enabled in **app config** for pilot testing after owner approval; default to off for ordinary users until validated.

**Time rule:** next calendar day at **08:45 according to device local time**, if ≥12 hours after the user agrees; otherwise the following morning at 08:45. Example: opt in Monday 17:00 -> Tuesday 08:45; Monday 23:30 -> Wednesday 08:45 to avoid waking users a few hours later. Exactly one date trigger, not a repeating calendar notification. If timezone changes, device OS may interpret scheduling differently; no guarantee of exact delivery.

**What it is NOT:** "24 hours after download" is not reliable because the app does not receive an authoritative download time. Use first signed-in opt-in / eligibility instead. For already installed beta users, offer opt-in on their next eligible app visit, not a silent retrospective notification.

## 4. Behavior/state

Suggested states (specific implementation flexible):
- `unseen` — eligible but never shown an opt-in;
- `declined` — user chose Not now; no automatic reprompt;
- `scheduled` — explicit opt-in + OS permission granted + one local notification ID persisted for this account;
- `opened` — user tapped the reminder and was routed; terminal for one-time sequence;
- `cancelled` — user opted out, signed out, permission revoked, feature disabled or onboarding completed; terminal and no auto re-schedule;
- `expired` — intended delivery time has passed; do not re-schedule automatically, because OS delivery isn't guaranteed/observable via app analytics.

Scheduling should be idempotent and survive app restarts. If the user cancels the OS permission prompt, **do not silently treat them as opted-in**; show a friendly "Notifications are off" explanation and allow a deliberate future re-try from Account, but no repeated popups. The app should provide a way to cancel pending reminder independently of `Notify when ready`.

**On third saved item:** cancel the specific pending notification on this device as soon as completion is confirmed (and on next app activation/account refresh); mark onboarding complete. Note that the push can already have fired or be visible in Notification Center; cancellation does not retroactively retract an already displayed alert. Do not claim an API read at delivery time.

**Account switching:** on sign-out, account deletion, or switch to different account, cancel the prior account's pending reminder. Never let notification tap of account A open private data under account B. Do not store account ID in the notification payload.

## 5. Tap/deep-link UX

- Notification has fixed internal type `onboarding_morning_outfit_v1`, with no user content or image URI.
- If authenticated as the right account and currently 0–2 pieces: route to First 3 Pieces with **Someone wearing them** already selected and **Take Photo / Choose from Library** visible. Keep full choice flexibility if user actually has a laid-out photo.
- If app starts cold from notification, **wait for auth/provider hydration and initial router mount**, then apply navigation exactly once. Test foreground, background, terminated paths; do not duplicate opening on old `lastNotificationResponse` after regular future launches.
- If user signed out, go to sign-in first, then re-evaluate; if signed in to a different account, don't act on the prior user's notification.
- If user already reached three saved items or `WARDROBE_OUTFIT` is off, route safely to Home, not to an invalid import or onboarding loop.
- Avoid automatically invoking camera permissions, camera capture, photo picker, free scan or billable generation when the push is tapped. The tap is a **CTA**, not a silent job trigger.

## 6. Notifications taxonomy and permissions

- **AI completion push**: existing `Notify when ready`, on-demand Expo push registration — preserve behavior.
- **Onboarding reminder**: new, separately consented **local** notification. It requires OS notification authorization but *not* Expo push-token registration, and must not flip the existing job-completion toggle.
- Send no marketing reminders to a person who has enabled only job-completion notifications.
- Ask for permission contextually after clear user intent; iOS settings can change later, so recheck permission before scheduling and on return to app. Apple Focus, Scheduled Summary and user permission can affect presentation.

## 7. First-five experiment and rollout

First run QA on signed build with a consenting account. Owner approval before turning the feature on or uploading a TestFlight build. If enabled, show the opt-in to first-five eligible participants without pressuring them. Observe **scheduled**, **tapped**, and **successful saved item after tap** separately; neither scheduling nor lack of tap proves delivery. No A/B significance with N=5; pair instrumented data with informal observations.

**Success signal:** at least one participant explains the notification reminded them to use a mirror photo and actually saves a piece. The overall first-five activation/retention goals remain those in `docs/beta/first-five-mac/08-PILOT-TRACKING-AND-DECISIONS.md`.

## 8. Non-goals

No daily/weekly notifications, personalization based on location/jobs/school/gender, calendar or geofence access, backend schedule service, remote pushes for this campaign, re-engagement marketing sequence, new analytics vendor, or forced opt-in. Do not add a new DB table just to schedule one reminder on one iPhone.

## 9. Honest limitation / future alternative

**Local notification is simple and survives Mac downtime, but cannot be conditionally suppressed at fire time based on fresh cross-device server state while the app is closed.** If strict cross-device "never show after three pieces" is mandatory later, use a trusted server-side send-time check and remote push scheduler, including unsubscribe/state sync, accepting that the Mac must remain available (or migrate scheduler separately with approval). This is not required for the first-five MVP; document the residual risk in QA and release review.
