# Acceptance / QA / Pilot Readiness — Morning Outfit Reminder

## A. Acceptance contract

- Optional; user must explicitly select "Remind me" for this reminder specifically.
- No OS notification prompt on first launch or before the reminder's explanatory CTA.
- A single one-off local reminder at next eligible **08:45 local morning**, minimum 12h gap.
- No reminder when signed out/local mode, ≥3 saved pieces, worn import disabled, feature flag off, user declined, or permissions denied.
- Notification tap opens a safe, authenticated **worn-photo** onboarding path with **camera OR library**; does not auto-open camera, bill credits, run AI or enroll in "Notify when ready."
- Pending reminder cancelled at confirmed third saved piece on **this device**, account change/sign-out/delete, explicit opt-out, permission revoked or outfit feature disabled (when detectable while app runs).
- Never schedule more than one, rearm automatically after used/expired, or cancel the separate job-result notifications.
- Explanatory text and permissions remain accessible and nonblocking.
- No claims about guaranteed delivery, 100% accurate timing or suppression across offline devices.

## B. Automated test matrix

| ID | Setup / test | Expected |
|---|---|---|
| N01 | First sign-in, no consent | No OS prompt, no schedule |
| N02 | User saw onboarding, 0/1/2 saved | One contextual opt-in CTA |
| N03 | 3 saved or more | No opt-in or scheduling |
| N04 | Outfit flag OFF, feature flag OFF, local/signed out | No opt-in/scheduling |
| N05 | Accepted, permissions granted, Monday 17:00 | One next-day 08:45 local DATE trigger |
| N06 | Accepted Monday 23:30 | Following eligible morning respecting ≥12h |
| N07 | Not now | Persist decline; never auto-reprompt |
| N08 | OS permission denied/revoked | Not marked scheduled, no token registered |
| N09 | Existing "Notify when ready" enabled only | Does NOT opt in to morning nudge |
| N10 | Scheduled reminder + third actual item saved | Only own ID cancelled |
| N11 | 3 scan candidates / generated images but not saved | No false completion |
| N12 | Rapid double tap / remount / app restart | Exactly one pending nudge |
| N13 | Native scheduled ID but AsyncStorage write fails | Reconciles safely, no orphan duplicate |
| N14 | Logout / account B sign-in | Cancel account A; no A action under B |
| N15 | Account deletion | Cancel pending and clean personal preference |
| N16 | Schedule due date passed, app reopens | No duplicate re-schedule / false "delivered" analytics |
| N17 | Tap, app backgrounded | Navigate after auth/router ready, worn preselected, two source choices |
| N18 | Tap, app terminated | Cold-start response handled exactly once |
| N19 | Tap old notification after onboarding completed | Safe Home, not onboarding loop |
| N20 | Tap with outfit flag off / auth missing | Safe fallback, no invalid route |
| N21 | Other `job_id` Expo notification | Previous job-result behavior unchanged |
| N22 | Analytics events | Exact allow-list props, no IDs/URIs or arbitrary text |
| N23 | App foreground while notification fires | No automatic route unless tapped; no impact to job completion notification |
| N24 | Clock changes / DST / timezone travel | No past schedule; document OS timing limitation |
| N25 | 2 items already saved and third saved via worn or garment flow | Cancellation runs regardless of add path |
| N26 | Permissions changed via iOS Settings after schedule | Cancel when app next becomes active; no forced OS prompt |
| N27 | Existing onboarding events and First3 card/credit flow | No regressions |

Update `mobile/__tests__/notifications.test.tsx`, `FirstPiecesStart.test.tsx`, `AccountScreen.test.tsx` and related screens. Add pure helper tests; fake time, AsyncStorage, permissions, notification responses, auth changes and native schedule APIs. Run backend activity-schema validation tests. **Do not delete old job-result tests.**

## C. Actual-device iPhone / TestFlight QA

Record PASS/FAIL/BLOCKED/NOT RUN, build number and OS, without personal identifying screenshots:

1. Fresh consenting QA account, 0 pieces → see opt-in only after relevant First3 context, not immediately after install.
2. Reject; go away/return → no repeat prompt.
3. Accept; iOS permission shown; inspect exactly one scheduled notification at expected local time (test with temporary staging-only near-future offset when necessary, never in public beta).
4. Background app; alert appears (subject to iOS settings), tap → First3 "Someone wearing them" and Camera/Library choices.
5. Kill app, repeat new QA setup; tap cold → no duplicate navigation.
6. When app open, notification does not force camera or navigation without tap.
7. Create 3 actual saved items **before** notification fires → pending notification is cancelled; no repeat. Test both garment and worn route.
8. Account → turn reminder off → pending schedule gone; `Notify when ready` remains on/off independently.
9. Permission denied in OS → app doesn't schedule or pressure; helpful explanation.
10. Sign out/in other account before delivery → A's prompt not delivered/routed as B.
11. Outfit flag off after enabling, on next app activation → cancellation/fallback.
12. User reaches three saved pieces on **a different device** while first is offline → **known limitation**: first device may still display notification. Explicitly record (not a release-breaking bug for local MVP if disclosed).
13. Test reminder while Mac is offline: OS may display local notification, but import will require API connectivity when tapped; show existing network errors, no false save or charge.

**No physical notification QA has been run by creating these docs.** Never report mock test success as proof of iPhone display/delivery.

## D. Measurement for the five-test pilot

Keep denominator counts:
- Number shown eligible contextual offer.
- Number opted in, number opted out, number successfully scheduled.
- Number that *tapped*, as observed by app.
- Number of tap users who **successfully saved an item after tapping** (day and context if source attribution is available, not mere `app_opened`).
- Number with voluntary meaningful return vs notification-driven return; ask tester whether prompt caused the action.
- Bugs, permission failures, confusing flow steps, Mac downtime separately.

Cannot infer how many people **saw** an alert only from `scheduled`; cannot infer delivery from absence of a tap. Don't optimize message copy from five participants alone.

No extra analytics SDK; existing activity events/usage report suffice after minimal schema extension.

## E. QA / delivery commands

```bash
PYTHONPATH=$PWD .venv/bin/pytest -q
cd mobile && npx jest && npx tsc --noEmit
# when local Supabase and test env are provisioned:
npx supabase test db
pytest tests/integration
```

Report skipped tests precisely; don't silently change failing tests or label them passing. If native notifications cannot be exercised in Expo Go or the current environment, document a signed build test requirement.

## F. Go/no-go gates

**Ready for code review:** mocks + typechecks green, consent separate from "Notify when ready", no duplicate state, correct account scoping, no new infrastructure, clear manual QA script.

**Ready for beta after owner approval:** actual iPhone verified for scheduling, cold-start tap, camera/library destination, cancellation and unrelated AI-job push regression; no unexpected permission prompt; all privacy copy and TestFlight disclosures reconciled.

**No-go:** scheduling without opt-in, continuing after explicit opt-out, sending daily repetitions, routing user A's notification under user B, launching paid operations on tap, or regressions to existing job-completion notifications.

No live user notifications, store submissions or server deployment authorized by this documentation request.
