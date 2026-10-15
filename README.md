# Digital Wardrobe

A private, personal iPhone wardrobe catalog built with **Expo / React Native / TypeScript**. Capture clothes, browse your closet, and grow the product iteratively.

> Status: **planning / foundation**. No mobile app has been scaffolded yet.

## MVP

- Sign in to a private wardrobe
- Add a clothing item from a source photo; AI generates a **separate, fully spread-out garment image on white/transparent background** for the catalog and suggests category/color/name; the user reviews and may regenerate or correct suggestions before saving
- Browse a photo-first grid and filter by category
- View and edit item details (category, color, brand, notes)
- Delete clothing items

**AI-generated standardized garment imagery and editable metadata suggestions ARE part of MVP.** The original photo is the input and **not the image displayed in the wardrobe**. Outfit recommendations and social features are later.

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

## Next

Review the planning documents, resolve the [open product decisions](docs/PRD.md#open-decisions), then scaffold the Expo application on a separate branch.
