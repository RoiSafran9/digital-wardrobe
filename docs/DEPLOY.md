# Deploying KIPS for the TestFlight beta

Status (2026-10-20): **Beta runs from the owner's Mac** behind a Cloudflare Tunnel at `https://api.kipscloset.com`; the
cloud-host path below is prepared, not deployed. Done: bundle ID `com.roisafran.kips`, App Store Connect app, SMTP
(Resend, `kipscloset.com`), hosted migrations, the review demo account. Plan: [TestFlight master plan](tasks/testflight-beta-launch-master-plan.md).

## 1. Server (FastAPI + the in-process AI worker)

The `Dockerfile` at the repo root builds the account-mode server (Python 3.11, tesseract for the printed-text
check, the background-removal model baked in). It was built and smoke-tested locally on 2026-10-19 (≈2.6 GB image).

```bash
docker build -t kips-server .
```

Run it on any container host that keeps one instance always on (the worker lives in the same process).
It needs ~2 GB RAM for the background-removal model; one instance is enough for a small beta.

**Environment at the host** (secrets go only here, never in the image or the app):

| Variable | Value |
|---|---|
| `WARDROBE_AUTH` | `on` (already set in the image) |
| `SUPABASE_URL`, `SUPABASE_PUBLIC_URL` | the hosted project URL |
| `SUPABASE_SECRET_KEY` | the project's secret key |
| `GEMINI_API_KEY` | the Gemini key |
| `WARDROBE_BILLING`, `WARDROBE_CREDIT_PRICES` | `on`, `{"garment":1,"back":1,"turn":3}` |
| `WARDROBE_OUTFIT` | `on` if outfit import is in the beta |
| `WARDROBE_WELCOME_CREDITS`, `WARDROBE_BETA_INVITES` | `40`, `*` (owner decision 2026-10-19) |
| `WARDROBE_DAILY_AI_JOBS` | a daily cap on paid AI jobs (cost guard), e.g. `300` |
| `WARDROBE_FREE_SCANS_PER_HOUR` | free scans per account per hour (default 30) |
| `WARDROBE_SWEEP_EVERY_HOURS` | `6` — Storage cleanup inside the worker |
| `PORT` | whatever the host gives (default 8000) |

**Health check:** `GET /healthz` (no sign-in) — queue depth, oldest queued job, worker heartbeat, AI jobs today.

**Emergency stop:** set `WARDROBE_GENERATION=off` and restart: new AI work is refused (the closet keeps working).
Don't use `WARDROBE_BILLING=off` for this — that makes AI work free instead of stopping it.

## 2. Database

Migrations live in `supabase/migrations/`. Apply new ones to the hosted project from a checkout linked to it:

```bash
npx supabase db push --linked
```

## 3. iOS build (EAS)

`mobile/eas.json` has a `production` profile (store distribution, build number auto-increment) and `preview`.
The Expo project is `@roisafran/mobile` (`extra.eas.projectId` in `app.json`). Before the first build:

1. **Bundle ID** — `com.roisafran.kips` (set in `mobile/app.json`, owner decision 2026-10-19; it can't change
   once the app exists in App Store Connect).
2. **Public settings for the build** (EAS environment `production`):
   ```bash
   cd mobile
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL --value https://<your-server> --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co --visibility plaintext
   npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
   ```
   Only public values go here. A release build refuses to start (the "not configured" screen) if the API URL is
   missing, not HTTPS, or a home-network address, or if a secret key was used.
3. Build and send to TestFlight (needs the Apple Developer account):
   ```bash
   npx eas-cli build --platform ios --profile production
   npx eas-cli submit --platform ios --profile production
   ```

Permission texts (camera, photos, notifications) and the export-compliance flag are already in `app.json`.

## 4. Owner checklist (accounts only the owner can open)

**Hosting** (one always-on container with ~2 GB RAM; e.g. Render or Railway):
1. Create an account and connect the GitHub repo `RoiSafran9/digital-wardrobe`.
2. New service → build from the repo's `Dockerfile` → an instance with at least 2 GB RAM, one instance, always on.
3. Add the environment from §1 (secrets copied from the Mac's `.env`); health check path `/healthz`.
4. Deploy, then share the `https://…` address so the app's `EXPO_PUBLIC_API_URL` can be set and the cellular test run.
   Stop the Mac's server once the hosted one works.

**Apple** (TestFlight):
1. Enroll in the Apple Developer Program (developer.apple.com/programs, yearly fee; approval can take up to two days).
2. Run the first `eas build` interactively: it signs in to the Apple account (password + two-factor code typed by the
   owner), creates the certificates and the App Store Connect app for `com.roisafran.kips`.
3. In App Store Connect → TestFlight: beta description, feedback email, a public privacy-policy URL, an external
   tester group; the first external build goes through Beta App Review. Texts to paste: [APP_STORE_CONNECT.md](APP_STORE_CONNECT.md).
4. **Demo account for Beta App Review** (the reviewer can't read a sign-in email). From the repo root on the Mac:
   ```bash
   python -m scripts.demo_account create --apply
   ```
   It creates `review@kipscloset.com` with a confirmed email and prints a new random password once. Put the email
   and password only in App Store Connect → TestFlight → Test Information → *Sign-in required*, and add to the
   review notes: *"On the sign-in screen, press and hold the title 'Sign in with email' for one second to open
   password sign-in."* Testers never see or need it; they sign in by email code as usual. Run `create --apply`
   again if a reviewer deletes the account or to change the password. After review:
   `python -m scripts.demo_account disable --apply` blocks it (sign-in and refresh) and drops the password;
   keep it on while builds are still being reviewed. Only this account has a password; with *Confirm email* on
   in Supabase, a password sign-up still needs the inbox, so no other account can be entered by password.

**SMTP** — done 2026-10-19: Resend (free tier, 100 emails/day), domain `kipscloset.com` verified (DNS in
Cloudflare), sender `KIPS <noreply@kipscloset.com>`, Auth email rate limit 100/hour, test code delivered.
`support@kipscloset.com` forwards to the owner's Gmail through Cloudflare Email Routing. Steps, for reference
(so sign-in codes reach testers, not only the project's own team):
1. An email provider with SMTP (e.g. Resend) and a domain you own, verified with the provider's DNS records.
2. Supabase dashboard → Authentication → Emails → SMTP settings: the provider's host, port, user and password,
   sender `KIPS <noreply@your-domain>`.
3. Authentication → Emails → Templates → Magic Link: must contain `{{ .Token }}` (copy `supabase/templates/magic_link.html`).
4. Authentication → Rate limits: raise emails per hour for the beta (e.g. 100).
5. Test: sign in with an email that isn't a team member's.
