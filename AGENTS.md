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
- AI clothing recognition is in MVP: invoke the vision model through authenticated server-side code, validate suggestions, keep brand empty if uncertain and preserve the manual correction/fallback path. Never expose model credentials or publicize wardrobe photos.
- Add tests and explicit verification notes for behavior changes.
- Update PRD, architecture or roadmap when changing an agreed requirement or design.
- Summarize files changed, tests run, open questions and limitations in the PR description.

## Coordination across ChatGPT and Claude Code
Both agents work on the same GitHub repository. Check recent commits and PRs before editing overlapping areas. Prefer separate branches, scoped files and reviewed merges; GitHub is authoritative over remembered chat instructions.
