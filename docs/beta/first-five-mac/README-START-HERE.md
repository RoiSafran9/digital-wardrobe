# KIPS — First Five TestFlight Beta Kit (Mac-hosted edition)

**Updated:** 2026-11-02  
**Decision:** The first **five** invited iPhone testers will use KIPS through **TestFlight**, with **FastAPI + the AI worker running on the founder's Mac** via **Cloudflare Tunnel at `https://api.kipscloset.com`**. Supabase continues to host authentication, database and private item storage. **Do not migrate or deploy the backend to a cloud compute host for this pilot.**

**Status:** Documentation and implementation plan; **not evidence that a TestFlight build, external review, live uptime alerts or a public invitation URL are ready**. The existing GitHub code, not this document, determines actual available features. The founder must confirm server availability, feature flags, Apple review, credits and privacy before inviting testers.

## Documents and how to use them

1. [01-WHATSAPP-INVITE-HE.md](01-WHATSAPP-INVITE-HE.md) — personalized invite for five friends; **placeholder** for unique KIPS TestFlight URL.
2. [02-INSTALL-GUIDE-HE.md](02-INSTALL-GUIDE-HE.md) — friction-minimized guide for iPhone testers (install, email code, first three garments, support).
3. [03-OWNER-LAUNCH-CHECKLIST-HE.md](03-OWNER-LAUNCH-CHECKLIST-HE.md) — readiness and Apple TestFlight steps **plus Mac operating checks**.
4. [04-OBSERVABILITY-ARCHITECTURE.md](04-OBSERVABILITY-ARCHITECTURE.md) — current-as-audited telemetry, missing correlation, launch metrics, privacy, lightweight Mac-first diagnostics and alerting.
5. [05-CLAUDE-CODE-IMPLEMENTATION-PROMPT.md](05-CLAUDE-CODE-IMPLEMENTATION-PROMPT.md) — **actionable, copy/paste coding task** for implementing Mac-hosted observability and beta readiness; no cloud migration.
6. [06-MAC-OPERATIONS-RUNBOOK.md](06-MAC-OPERATIONS-RUNBOOK.md) — preflight checks, health probes, Mac power/network, launchd, restart/escalation and downtime communication.
7. [07-OBSERVABILITY-QA-ACCEPTANCE.md](07-OBSERVABILITY-QA-ACCEPTANCE.md) — end-to-end verification matrix, privacy tests, fault drills and launch gate.
8. [08-PILOT-TRACKING-AND-DECISIONS.md](08-PILOT-TRACKING-AND-DECISIONS.md) — private first-five tracking template (store participant info **outside Git**), success questions and initial KPI measurement.
9. [KIPS-BETA-INSTALL-PAGE.html](KIPS-BETA-INSTALL-PAGE.html) — static RTL installation landing-page **template**; the KIPS enrollment button stays disabled until a genuine approved TestFlight URL is inserted.

## Pilot topology (explicit)

```
5 iPhones (TestFlight)
     -> HTTPS api.kipscloset.com
     -> Cloudflare Tunnel on founder's Mac
     -> FastAPI + in-process AI worker + Gemini requests
     -> Supabase Auth/Postgres/private Storage

Existing activity_events + usage_report; existing Mac JSON logs; additional privacy-safe correlation + alerts.
```

**Mac constraints:** plugged into power, kept awake and online, launchd services for the API and tunnel inspected, logs/health/worker checked, an external off-network probe and a communication plan for downtime. A tunnel by itself does not keep the Mac awake. **No cloud-hosted FastAPI/container rollout in the first-five scope.**

## Before sending invitations

1. Install a **store-signed KIPS build** via TestFlight on the owner's phone and run sign-in → AI scan/generate → saved item **over cellular**.
2. Verify actual Mac API and tunnel health; especially worker heartbeat and queue, not just HTTP 200. Confirm release `EXPO_PUBLIC_API_URL` uses `https://api.kipscloset.com` and hosted Supabase publishable settings.
3. Confirm latest approved hosted migrations, account isolation, beta welcome grant/pricing policy, flags and no unexpected credit charges. Do not assume documentation reflects actual production environment.
4. Validate `scripts.usage_report --user` and the new request/job correlation against a **consenting test account**; have a safe outage/rollback procedure.
5. In App Store Connect, complete external tester group, assign build, clear Beta App Review (as required), and choose personal **email invitations** or a **public invitation URL** with limit 5. A public link may be forwarded; a limit is not an identity allowlist.
6. Replace `{{KIPS_TESTFLIGHT_LINK}}` only with a **real** link from App Store Connect. Test it on an iPhone. Then send five personalized invitations, staggered if helpful to avoid a processing burst.

Official Apple pages: https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/ and https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/ .  
Official TestFlight download: https://apps.apple.com/us/app/testflight/id899247664 .

**Privacy:** telemetry must be bounded and privacy-preserving. No screenshots/session replay, photo payloads, filenames, names, verification codes, bearer tokens or image URLs in logs/traces. Any third-party crash/monitoring provider requires owner approval and disclosure updates before activation.

This kit is not an IPA, not a TestFlight link, not proof of production deployment, and not authorization to change settings, deploy or invite users.