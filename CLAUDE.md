# Claude Code — Digital Wardrobe

Read `AGENTS.md` first. It holds the shared rules for **all** AI coding agents.

## At session start
- Run `git status` and `git branch --show-current`; `git pull --ff-only` when a tracking branch exists and it is safe.
- Read `README.md`, `PRODUCT.md`, `docs/PRD.md` and `docs/ARCHITECTURE.md`. Read `DESIGN.md` before any UI work and the matching spec in `docs/superpowers/specs/` before changing a feature.

## Implementation guidelines
- Stack as built: iPhone app **KIPS** (`mobile/`, Expo Router, TypeScript; Expo Go in development, EAS builds for TestFlight) → FastAPI (`api/`) on the owner's Mac (home Wi-Fi in development; public HTTPS at `api.kipscloset.com` through a Cloudflare Tunnel) → Python pipeline (`pipeline/`) calling Gemini. Account mode adds Supabase Auth (6-digit email code), Postgres with RLS, a private Storage bucket and a Postgres job queue with an in-process worker; local mode (default) keeps everything as files under `runs/`.
- Layout: routes in `mobile/app/` (`sign-in.tsx`, `(tabs)/` for Home, Closet, Add, Account), app logic in `mobile/src/` (`api/`, `auth/`, `components/`), HTTP routes in `api/routes/` (`v1.py` for account mode), auth/store/worker/credits in `api/`, pipeline stages in `pipeline/stages/`, prompts in `pipeline/prompts/` (versioned files, never edited in place), model calls in `pipeline/providers/`, database in `supabase/migrations/` with pgTAP tests in `supabase/tests/`. (`mobile/AGENTS.md` is Expo boilerplate; its `src/app/` route path does not apply here.)
- Never put a secret or service-role key in `mobile/`; the user ID comes only from the verified token. See `AGENTS.md` → Privacy.
- **Garment fidelity comes first**: the catalog image must match the real photographed piece — colors, wash, texture, prints, text, trims, proportions. Unfold and smooth it; do not invent logos, details or "nicer" versions. Anything generated rather than photographed (the 360 view) is labelled as AI.
- The closet shows the transparent cutout on a neutral tile; the white-background generated image is the fallback, then the photo crop. No tints, filters or glows on garment images.
- No extra paid model calls or added waiting beyond what a feature needs. Paid, slow features (the 360 view) run only when the user asks.
- Expo Go only: new native dependencies must be ones bundled in Expo Go, or raise it with the owner first.
- Commit directly to `main` (the owner's chosen workflow); use a branch or PR only when the owner asks. Never force-push.
- After code changes run the checks in `AGENTS.md` and say which could not run.
- Two capture flows are built and must both keep working: **garment photo** (laid flat or on a hanger; free pre-scan, pick the pieces, then generate) and **outfit photo** (someone wearing the clothes; free scan → pick garments → generate → review before the closet), the outfit flow behind `WARDROBE_OUTFIT=on`.
- Out of scope unless the owner asks: outfit recommendations/styling, payments and purchases, a cloud host (see "Next" and "Later" in `docs/ROADMAP.md`).

## Expected handoff
Summarize purpose, what changed, how it was verified (tests run, manual steps on the phone), risks, and doc updates.

## AI Credits
- Approved product direction: each account gets a single AI Credits balance. **Charge for distinct user-requested AI generation actions, not the number of garments stored.** Front, optional back and bundled 360 creation have separate action prices. Account shows the remaining balance and an in-app price list. **Built:** wallet + append-only ledger, per-action billing (off unless `WARDROBE_BILLING=on`), in-app balance, price list, activity and cost confirmations, and a one-time welcome grant (`WARDROBE_WELCOME_CREDITS`).
- Approved for the F&F beta: provisional prices front 1 / back 1 / 360 3 and a 40-credit welcome grant, set only through server env (see `docs/DEPLOY.md`). Public prices and purchase packs are unapproved; never hardcode credit amounts in code or the app.
- Credits must be enforced by the trusted server with an append-only ledger, transaction safety and idempotent jobs. Read `docs/CREDITS.md` before implementing monetization.
