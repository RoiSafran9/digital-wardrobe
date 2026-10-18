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

To sign in against a local Supabase stack (needs Docker):

1. `npx supabase start` from the repo root. It prints the API URL and the publishable key; sign-in emails land in Mailpit at http://127.0.0.1:54324.
2. Copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_SUPABASE_URL=http://<your-Mac-LAN-IP>:54321` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>`.
3. Restart Expo (`npx expo start -c`) so it picks up the env.

For a hosted project, use its Project URL and **publishable** key instead, and put `{{ .Token }}` in the Magic Link email template (see `supabase/templates/magic_link.html`). Never put a secret or service-role key in `mobile/`.

## Next

Review the planning documents, resolve the [open product decisions](docs/PRD.md#open-decisions), then scaffold the Expo application on a separate branch.
