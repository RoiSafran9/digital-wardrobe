# Shared Agent Instructions

This repository is the **single source of truth** for Digital Wardrobe code, configuration, architecture and product decisions.

## Before working
1. Read `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`.
2. Inspect the current branch, status and existing changes. Do not overwrite or discard work from another agent.
3. Identify scope; if a proposed feature is outside MVP, raise it rather than implementing it silently.

## Working rules
- Use small scoped branches and pull requests; do not push directly to `main` for normal development.
- Pull latest changes before work. Avoid force pushes.
- TypeScript-first, Expo-native conventions; prefer simple solutions over speculative abstraction.
- Never commit passwords, service role tokens, Apple signing keys, secrets, private clothing photos or generated bundles.
- Respect owner-specific database and storage permissions and validate policies.
- AI garment **image generation is part of MVP**: given a source garment photo, generate a **distinct, full-garment laid-out representative image** isolated on a **solid pure-white (#FFFFFF), non-transparent background**. That generated image, never the input photo, is the Wardrobe/Details primary image. Respect visible colors, cut, texture and pattern; do not invent logos or distinctive decorations. Unseen parts may be inferred and are not guaranteed exact. Keep review and Regenerate/Retake before saving.
- AI metadata recognition is also in MVP: invoke providers only from authenticated server-side code, validate suggested categories, leave brand empty when uncertain and preserve manual category fallback. If **image generation** fails, block Save rather than using the unprocessed source photo. Never expose model credentials or publicize wardrobe/source photos.
- Add tests and explicit verification notes for behavior changes.
- Update PRD, architecture or roadmap when changing an agreed requirement or design.
- Summarize files changed, tests run, open questions and limitations in the PR description.

## Coordination across ChatGPT and Claude Code
Both agents work on the same GitHub repository. Check recent commits and PRs before editing overlapping areas. Prefer separate branches, scoped files and reviewed merges; GitHub is authoritative over remembered chat instructions.
