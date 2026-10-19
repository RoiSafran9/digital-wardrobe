# Claude Code Kickoff — TestFlight Friends & Family Beta

**First read:** [Complete launch master plan](testflight-beta-launch-master-plan.md).  
**Status:** Planning and staged execution instruction; not permission to deploy or enable billing.

## What we are building

A genuine iOS TestFlight beta for a **small invited Friends & Family group**, with cloud-hosted API/worker, hosted Supabase private accounts and photos, and a **free one-time AI Credits starter pack** for each new eligible beta user. There are **no payments, purchases or subscriptions in this release**.

**Proposed trial configuration pending owner approval:** 40 welcome Credits, 1 credit per successful front image, 1 per back image, 3 for one bundled 360, no recurring refill, server-controlled. Do not hardcode numbers into mobile app or auto-enable live charging.

The normal garment-photo experience is in beta scope. New person-worn Outfit Photo import is included only if its ongoing quality experiment and review pass; preserve a flag to defer it without delaying TestFlight.

## Engineering workflow

1. Read the latest `main`, `AGENTS.md`, `CLAUDE.md`, `README.md`, the master plan, Product/PRD/Architecture/Credits/Roadmap docs, current migrations/code/tests, and open Outfit PR #14. Reconcile stale documentation with the actual repository.
2. Carry out a **short beta-readiness audit** against every release gate in the master plan. List complete / incomplete / needs owner action, with source file paths and test evidence rather than guesses.
3. Propose **PR-sized development tasks** with dependencies and measurable exit criteria. Avoid one huge PR. Split parallel workstreams for hosted Auth + automatic Welcome Credits, cloud API/worker, privacy/operational readiness and iOS EAS build.
4. Make a concise cloud-host comparison based on the real Python AI worker's dependency/runtime requirements. Don't order paid services without explicit owner approval.
5. Review the account creation/wallet code: `handle_new_user` currently creates a **zero-balance wallet**; `credit_grant` and `scripts/grant_credits.py` are present, but an automatic one-time credit grant is missing. Design a secure, idempotent verified-user bootstrap that only grants once per eligible beta account and doesn't leak credentials or bypass invitation restrictions. Capture the specific tests.
6. Check `mobile/app.json` and absence of EAS configuration: choose a stable bundle identifier and EAS build plan; owner supplies account/brand details. Production build must use hosted HTTPS/API, not the Mac's LAN IP.
7. Review practical account erasure (Auth/DB/Storage), permission copy, Privacy Policy URL, external AI/photo disclosure, abuse/rate limits, provider spending caps, failed-job recovery and operational monitoring.
8. Validate official vendor documentation before committing external platform or security decisions.
9. Prepare a focused first **research/readiness PR**, and (if approved and independently testable) one **welcome-credit bootstrap implementation PR**. Never merge on your own.
10. Hand the owner a compact Hebrew summary of required services/settings, approved vs open choices and the next executable milestone.

## Ground rules

- **Do not** switch `WARDROBE_BILLING` on, start sending Apple invitations, grant production credits, migrate hosted data, buy hosting, configure paid accounts, upload app builds or deploy production infrastructure without the owner's explicit approval and credentials.
- Do not break the current running local app or existing user data. Don't merge the Outfit PR unless separately approved.
- No payment workflow or payment screens.
- Grant welcome credits exactly once per verified/eligible user, server-side only, ledger-backed and concurrency-safe. Never use client-supplied grant amount or ID.
- Use real test evidence. Call out blocked hosted SMTP/Apple/Expo steps; don't claim completion without proof.
- Do not store private person images in Git or logs.
- Run required tests and document what cannot be run.
- Keep PR scope narrow and update living docs to reflect *what ships*, not proposals.

## Definition of success

An external TestFlight invitee installs from Apple, signs in via hosted email OTP, automatically receives their free credits, adds garments across Wi-Fi/cellular with the Mac off, sees only their own private content, survives app/server restarts without losing/duplicating jobs or credits, and can send feedback and delete their account. The beta is useable without payment or owner's manual intervention.
