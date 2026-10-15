# Claude Code — Digital Wardrobe

Read `AGENTS.md` first. It contains the shared rules for **all** AI coding agents.

## At session start
- Run `git status`, `git branch --show-current` and `git pull --ff-only` (when safe and tracking branch exists).
- Read `README.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`.
- Review open branches / pull requests if connected to GitHub.

## Implementation guidelines
- Use Expo + React Native + TypeScript as the proposed stack; resolve open architecture decisions with the owner instead of treating drafts as immutable.
- Keep navigation in `app/`, business logic in `features/`, reusable primitives in `components/`, integrations in `lib/`.
- Use Supabase RLS and private image storage. Never ship service-role credentials to the client.
- Work in feature branches and open PRs rather than pushing to main.
- After code changes run available type checks, lint/tests, and describe any checks that could not run.
- **AI visual metadata suggestion is part of the MVP**: after selecting a photo, infer category/color and optionally descriptive name, show an editable single review form, and support manual category fallback. Call the vision model securely from a server-side handler; keep model secrets out of the app.
- Defer other AI features such as outfit recommendations and background removal until after MVP.

## Expected handoff
In each PR provide purpose, implementation summary, manual verification steps, risks, and documentation updates.
