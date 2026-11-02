# First Five Pilot — Tracking and Decision Framework

## What we're testing

The primary hypothesis is that taking photos and adding clothes is sufficiently easy for real people to start a closet *without founder hand-holding*. Secondary: they receive faithful catalog images and some return voluntarily to their wardrobe or outfit suggestions.

**For the first five, measure people and actual experiences — not statistically significant percentages.** The Mac host may be unavailable by design; distinguish product friction from availability incidents.

## Private owner tracker (do not put real names/emails in Git)

Use a private notebook/sheet with five tester aliases (T1–T5), actual invite status from App Store Connect, and voluntarily supplied observations. It may include contact details only in an access-controlled location; this template intentionally has none.

| Alias | Invite sent | TestFlight accepted | Installed | OTP signed in | First saved piece | 3 pieces | Returned on another day | Blocker / feedback |
|---|---|---|---|---|---|---|---|---|
| T1 | | | | | | | | |
| T2 | | | | | | | | |
| T3 | | | | | | | | |
| T4 | | | | | | | | |
| T5 | | | | | | | | |

Track Mac availability/outages alongside the tester's actual attempts. If a user couldn't upload because the Mac was off, label it **technical access failure**, not lack of interest.

## Action-based cohort funnel

1. Invitation delivered and accepted: App Store Connect / private owner sheet; the app cannot see preinstall steps.
2. Auth success and welcome grant: authorized server records/events.
3. `onboarding_started`, `photos_collected`, `detection_completed`, `generation_started` — existing activity event pipeline.
4. Actual successful saved wardrobe item in the account DB + `first_garment_saved` event.
5. 3 actual items saved: real wardrobe rows; do not infer just from a celebratory screen.
6. Repeat add on a **different day within 7 days** (not only after >30 minutes).
7. Meaningful value action on **another day within 7 days**: own item opened, new item successfully saved, or validated outfit suggestion viewed. Merely `app_opened` doesn't qualify.

## Questions to ask a tester (once, not every day)

- Did you get through the TestFlight installation without help? Which step was confusing?
- Were you able to add three garments? What part took the most effort?
- Do the generated catalog pictures resemble your real items? Where are they inaccurate?
- Would you choose to add more items yourself? Why or why not?
- Did you return because you wanted to use KIPS, or because I asked you to test it?

## Suggested early success bar, qualitative

- 5/5 can install and sign in on a real iPhone after Apple approval, or each failure has a known fix.
- At least 4/5 can complete a first item during an available, functioning server window *without live guidance* (provisional experiment goal, not a market benchmark).
- At least 3/5 reach three saved items without major confusion.
- At least 2/5 voluntarily perform a meaningful action on a later day, when eligible for observation.
- All ownership/security checks pass; no unacknowledged duplicate charges, lost items or privacy incidents.
- Major failure paths are diagnosable with existing event timeline + new request/job correlation, and Mac/tunnel outages are recorded separately.

With only five, the purpose is to find glaring issues and estimate onboarding effort, not decide product-market fit. A second cohort of 15–25 nontechnical users should be considered after first-five corrections, without changing the hosting decision automatically.

## Daily owner report

- Mac/tunnel uptime and any planned maintenance window.
- Invites/installed/signups, who got stuck and at what step.
- First pieces and time to first saved item; next-day repeat imports/return.
- Failed jobs, 5xx, worker heartbeat/queue, per-user estimated AI cost and remaining daily cap.
- What changed in build or server deployment; never mistake new code in GitHub for deployed code on the Mac.

**Privacy:** keep names/emails/tester mapping off Git. Use `scripts.usage_report --user` only with authorized operator access and never post screenshots of private item photos.