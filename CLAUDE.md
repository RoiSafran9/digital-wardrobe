# Claude Code — Digital Wardrobe

Read `AGENTS.md` first. It holds the shared rules for **all** AI coding agents.

## At session start
- Run `git status` and `git branch --show-current`; `git pull --ff-only` when a tracking branch exists and it is safe.
- Read `README.md`, `PRODUCT.md`, `docs/PRD.md` and `docs/ARCHITECTURE.md`. Read `DESIGN.md` before any UI work and the matching spec in `docs/superpowers/specs/` before changing a feature.

## Implementation guidelines
- Stack as built: Expo Go iPhone app (`mobile/`, Expo Router, TypeScript) → FastAPI (`api/`) on the owner's Mac over the LAN → Python pipeline (`pipeline/`) calling Gemini. Account mode adds Supabase Auth (6-digit email code), Postgres with RLS, a private Storage bucket and a Postgres job queue with an in-process worker; local mode (default) keeps everything as files under `runs/`.
- Layout: routes in `mobile/app/` (`sign-in.tsx`, `(tabs)/` for Home, Closet, Add, Account), app logic in `mobile/src/` (`api/`, `auth/`, `components/`), HTTP routes in `api/routes/` (`v1.py` for account mode), auth/store/worker/credits in `api/`, pipeline stages in `pipeline/stages/`, prompts in `pipeline/prompts/` (versioned files, never edited in place), model calls in `pipeline/providers/`, database in `supabase/migrations/` with pgTAP tests in `supabase/tests/`. (`mobile/AGENTS.md` is Expo boilerplate; its `src/app/` route path does not apply here.)
- Never put a secret or service-role key in `mobile/`; the user ID comes only from the verified token. See `AGENTS.md` → Privacy.
- **Garment fidelity comes first**: the catalog image must match the real photographed piece — colors, wash, texture, prints, text, trims, proportions. Unfold and smooth it; do not invent logos, details or "nicer" versions. Anything generated rather than photographed (the 360 view) is labelled as AI.
- The closet shows the transparent cutout on a neutral tile; the white-background generated image is the fallback, then the photo crop. No tints, filters or glows on garment images.
- No extra paid model calls or added waiting beyond what a feature needs. Paid, slow features (the 360 view) run only when the user asks.
- Expo Go only: new native dependencies must be ones bundled in Expo Go, or raise it with the owner first.
- Commit directly to `main` (the owner's chosen workflow); use a branch or PR only when the owner asks. Never force-push.
- After code changes run the checks in `AGENTS.md` and say which could not run.
- Out of scope unless the owner asks: outfit features, payments, a cloud host (see "Next" and "Later" in `docs/ROADMAP.md`).

## Expected handoff
Summarize purpose, what changed, how it was verified (tests run, manual steps on the phone), risks, and doc updates.

## AI Credits
- Approved product direction: each account gets a single AI Credits balance; Account shows remaining credits and an in-app price list for all billable AI actions. Only the M5 hooks exist (billing off).
- Credit amounts, F&F grants and purchase packs are unapproved. Do not hardcode example values as launch prices or claim wallets/balances exist.
- Credits must be enforced by the trusted server with an append-only ledger, transaction safety and idempotent jobs. Read `docs/CREDITS.md` before implementing monetization.
