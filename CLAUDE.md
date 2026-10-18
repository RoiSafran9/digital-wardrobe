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
- **AI garment image generation IS part of MVP**: source camera/gallery photo → secure image editing/generation that reconstructs a neatly laid-out full garment on a **solid white (#FFFFFF), non-transparent background** → preview the **generated image by default**, with **Original / Generated** toggle for pre-save comparison and editable category/color/name suggestions → allow **pre-save-only** Regenerate/Retake and explicit Save Item → show the generated image in Wardrobe. Never present the original input image as the saved catalog image. Avoid fabricated distinctive details and explain uncertainty of unseen portions.
- Every saved garment must have **two private files and two associated paths**: retained `source_image_path` (original) and `display_image_path` (AI-generated). Wardrobe and Item Details render only `display_image_path`. In pre-save Review, Original may be viewed temporarily via a private toggle, but the saved display is always the generated image. Both are owner-restricted; on item deletion clean up both. Saving confirms both objects and metadata; preserve the original for future regeneration. **Do not implement Regenerate in saved Item Details/Edit in the MVP**; it is definitively deferred.
- The metadata stage must validate category, keep uncertain brands blank, allow manual category correction, and block saving if **image generation** fails. Run AI from an authenticated server-side handler; keep secrets out of the app and private input/output images protected.
- Defer other AI features such as outfit recommendations until after MVP.

## Expected handoff
In each PR provide purpose, implementation summary, manual verification steps, risks, and documentation updates.

## Future AI Credits
- Approved product direction: each user gets a single AI Credits balance; the Account screen shows remaining credits and an in-app price list for all billable AI creation actions.
- Actual credit amounts, F&F grants and purchase packs remain unapproved. Do not hardcode example values as launch prices or claim the current local application already supports accounts/wallets.
- Credits must be enforced by a trusted server with an append-only ledger, transaction safety and idempotent generation operations. Read `docs/CREDITS.md` before implementing monetization.
