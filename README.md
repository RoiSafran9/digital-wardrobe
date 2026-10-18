# Digital Wardrobe

A private, personal iPhone wardrobe catalog built with **Expo / React Native / TypeScript**. Capture clothes, browse your closet, and grow the product iteratively.

> Status: **working single-owner app, moving to multiple users.** An Expo app (`mobile/`) talks to a local FastAPI server (`api/`) that runs the Gemini pipeline (`pipeline/`). Accounts are being added in milestones — see the [multi-user design](docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md). Older planning docs below predate the built app; where they disagree, the design's "discrepancies" section explains which is current.

## MVP

- Sign in to a private wardrobe
- Add a clothing item from a source photo; AI generates a **separate, fully spread-out garment image on a solid white background** for the catalog and suggests category/color/name; the user reviews and may regenerate or correct suggestions **before first save only**
- Browse a photo-first grid and filter by category
- View and edit item details (category, color, brand, notes)
- Delete clothing items

**AI-generated standardized garment imagery and editable metadata suggestions ARE part of MVP.** Each item retains **two separate private images**: the original source photo (for future regeneration) and the AI-generated white-background catalog image. **Only the generated image is displayed in the wardrobe.** Regenerate from a saved item is deferred until after MVP; only unsaved previews can be regenerated in V1. Outfit recommendations and social features are later.

## Project source of truth

- [Product requirements](docs/PRD.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Shared AI agent instructions](AGENTS.md)
- [Claude Code instructions](CLAUDE.md)

GitHub is the authoritative source for **code and project decisions**. User clothing photos belong in private object storage, **not Git**.

## Intended stack (proposed)

Expo (React Native + TypeScript), Expo Router, Supabase (Auth/Postgres/private Storage plus secure server-side **image generation/editing and vision metadata** inference), and EAS Build → App Store Connect → TestFlight.

## Working agreement

1. Read the project documents before changing behavior or architecture.
2. Work in small branches with focused pull requests; `main` reflects reviewed decisions.
3. Document material product/architecture changes alongside the code.
4. Never commit credentials, tokens, personal photos, or generated build artifacts.

## Accounts (multi-user, in progress)

Milestone 1 adds email-code sign-in (Supabase Auth) to the app. Without Supabase settings, development builds run in **local mode** exactly like before.

The hosted project's settings live in `mobile/.env` (git-ignored, publishable key only). Until the hosted project has custom SMTP (needed for the 6-digit code email), sign in against a local Supabase stack instead (needs Docker):

1. `npx supabase start` from the repo root. It prints the API URL and the publishable key; sign-in emails land in Mailpit at http://127.0.0.1:54324.
2. Create `mobile/.env.local` (git-ignored; it overrides `mobile/.env`) with `EXPO_PUBLIC_SUPABASE_URL=http://<your-Mac-LAN-IP>:54321` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>`.
3. Restart Expo (`npx expo start -c`) so it picks up the env.

**Database (M2):** migrations live in `supabase/migrations/` and are applied by `npx supabase start` / `npx supabase db reset` (reset wipes local test data, including local test accounts). Run the isolation tests with `npx supabase test db`. Regenerate app types with `npx supabase gen types typescript --local > mobile/src/api/database.types.ts`. Applying the migrations to the hosted project is an owner step: `npx supabase link --project-ref xdzqwkqwfqvpovoftlyl` then `npx supabase db push` (asks for the database password).

**Backend (M3a):** the API stays in local mode unless `WARDROBE_AUTH=on`. With it on (plus `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and, for the phone, `SUPABASE_PUBLIC_URL` — see `.env.example`), it serves only the token-checked `/v1` API (`/v1/jobs`, `/v1/items`, back and 360 jobs) and runs the job worker in the same process; the local `runs/` routes aren't mounted. Run the store/API integration tests against the local stack with `SUPABASE_TEST_URL`, `SUPABASE_TEST_SECRET_KEY` and `SUPABASE_TEST_PUBLISHABLE_KEY` set: `pytest tests/integration`. Move your existing items with `python -m scripts.migrate_runs` (dry run; add `--email <account> --apply` to upload).

**App on accounts (M3b):** when signed in, the app sends its Supabase token to the `/v1` API; captures, back photos and 360s become server jobs it polls, so they finish even if the phone drops the connection. Without Supabase settings (local mode) the app uses today's endpoints. To try it on the phone with the server on your Mac:

1. `npx supabase start`; `mobile/.env.local` as above.
2. Start the API in account mode (one terminal, repo root): `WARDROBE_AUTH=on SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=<local secret key> SUPABASE_PUBLIC_URL=http://<your-Mac-LAN-IP>:54321 uvicorn api.main:app --host 0.0.0.0 --port 8000`. `SUPABASE_PUBLIC_URL` is what the phone uses to load your private images through signed links.
3. Sign in on the phone and add a piece. Move your existing closet in with `python -m scripts.migrate_runs --email <you> --apply` (against the same Supabase).

Away from home Wi-Fi: point `EXPO_PUBLIC_API_URL` at a tunnel to the Mac's port 8000 (e.g. Cloudflare Tunnel or ngrok), and use a Supabase URL the phone can reach (the hosted project, or a second tunnel for the local stack) for both `EXPO_PUBLIC_SUPABASE_URL` and the server's `SUPABASE_PUBLIC_URL`. Not set up yet.

To use the hosted project: configure custom SMTP in Supabase (Auth → SMTP), put `{{ .Token }}` in its Magic Link email template (see `supabase/templates/magic_link.html`), then delete `mobile/.env.local`. Never put a secret or service-role key in `mobile/`.

## Next

Review the planning documents, resolve the [open product decisions](docs/PRD.md#open-decisions), then scaffold the Expo application on a separate branch.
