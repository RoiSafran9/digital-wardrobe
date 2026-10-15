# Digital Wardrobe

A private, personal iPhone wardrobe catalog built with **Expo / React Native / TypeScript**. Capture clothes, browse your closet, and grow the product iteratively.

> Status: **planning / foundation**. No mobile app has been scaffolded yet.

## MVP

- Sign in to a private wardrobe
- Add a clothing item using the camera or photo library
- Browse a photo-first grid and filter by category
- View and edit item details (category, color, brand, notes)
- Delete clothing items

AI item recognition, automatic background removal, outfit recommendations, and social features are **later**, not part of MVP.

## Project source of truth

- [Product requirements](docs/PRD.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Shared AI agent instructions](AGENTS.md)
- [Claude Code instructions](CLAUDE.md)

GitHub is the authoritative source for **code and project decisions**. User clothing photos belong in private object storage, **not Git**.

## Intended stack (proposed)

Expo (React Native + TypeScript), Expo Router, Supabase (Auth/Postgres/private Storage), and EAS Build → App Store Connect → TestFlight.

## Working agreement

1. Read the project documents before changing behavior or architecture.
2. Work in small branches with focused pull requests; `main` reflects reviewed decisions.
3. Document material product/architecture changes alongside the code.
4. Never commit credentials, tokens, personal photos, or generated build artifacts.

## Next

Review the planning documents, resolve the [open product decisions](docs/PRD.md#open-decisions), then scaffold the Expo application on a separate branch.
