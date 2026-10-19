# Deploying KIPS for the TestFlight beta

Status: **Prepared, not deployed.** The pieces below are in the repo; choosing and paying for a host, the Apple
Developer account and the app's bundle ID are the owner's steps. Plan: [TestFlight master plan](tasks/testflight-beta-launch-master-plan.md).

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
