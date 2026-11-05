# Claude Code — Implement Unified Add Clothes UX

Copy/paste this entire request into Claude Code from the repository root:

---

# IMPLEMENT: KIPS Unified Add Clothes UX (first-five beta priority)

Work in `RoiSafran9/digital-wardrobe`. **Start implementing now; this is a coding task, not just a plan.**

## Read first

1. Inspect `git status`, current branch, recent commits and any parallel agent work. Pull latest `main` safely; do not discard uncommitted work.
2. Read `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, `README.md`, `docs/PRD.md` and `docs/ARCHITECTURE.md`.
3. Read every document in `docs/features/unified-add-clothes/`:
   - `README.md` — decisions and constraints
   - `01-PRODUCT-UX-SPEC.md` — user-facing flows and copy
   - `02-ENGINEERING-IMPLEMENTATION.md` — file-by-file implementation requirements
   - `03-ACCEPTANCE-AND-QA.md` — exact acceptance / QA coverage
4. Inspect the **actual latest code**, including Home, Add tab, camera, garment preview, worn detect/pick, First 3 Pieces, photo picker, analytics allow-list, and scanner/generator prompt dispatch. Where the docs and newer code differ, respect actual code and explain the deviation.

## Goal — one obvious way to add clothing

Users can add clothes/shoes with photos:
- Clothes laid out, spread, **hung unworn** or shoes by themselves.
- A photo of a person **wearing** the clothes/shoes.
- For either type, **take a new photo** or **choose from the photo library**.

The current UI confusingly offers Flat Lay / Worn on Home, Garments / Outfit again in camera, two method cards on Add, and near/not-near language in onboarding. **Fix this.**

### Required UX

1. **Home:** one clear `Add Clothes` CTA to the existing Add hub for populated wardrobes; no Flat Lay/Worn dual card. Signed-in empty Home retains one guided First 3 Pieces entry, not redundant add rows. Preserve Home's other widgets.
2. **Add hub:** two visually understandable *photo-type* options:
   - `Clothes by themselves` — `Laid out, hanging, or shoes together.`
   - `Someone wearing them` — `A person wearing the clothes or shoes.`
   Selecting either offers the **same** source choice: `Take Photo` or `Choose from Library`.
3. **Camera:** **remove GARMENTS / OUTFIT mode tabs entirely**. Accept a route mode already selected, show only mode-specific capture guidance, and preserve shutter, safe areas, permissions and same-type photo-library fallback.
4. **Recovery:** enable `Change Photo Type` on pre-generation scan/selection screens, using the **same local photo URI**, in both directions. Provide a strong contextual suggestion when the current free scan recognized the wrong photo kind. Never charge automatically or reuse stale scan selections/prices; do not let async scans/timers cause back-stack loops.
5. **First 3 Pieces:** use the same user-facing type/source vocabulary without losing the special multi-photo tray, five-piece cap, account-bound progress, `onboarding=1`, near/not-near internal analytics compatibility or existing results/celebration.
6. **Feature flag:** if outfit import is off, do not show a worn-type action that leads to a disabled route.
7. **Hanging garments:** the existing flat scanner's prompt does not currently permit clothes on hangers reliably. Create a *versioned* garment detection prompt (v6) and garment generation prompt (v6) that support unworn hanging garments without treating them as worn. Update Gemini adapter version selection/logging; preserve garment fidelity and the separate **approved footwear-specific prompt/camera angle**. No new model service or automatic scene-classification call. If real-photo QA reveals limitations, report them rather than claiming success.

## Engineering and guardrails

- Implement using existing Expo Router, theme, photoPicker and camera/preview/outfit screens; no new top-level navigation tab or duplicate add hub.
- Keep current `/v1` endpoints, auth, Supabase user ownership, private image URLs, free scan, selection, cost confirmation, billing, idempotent queue jobs, retry behavior and creation limits unchanged.
- Keep First 3 Pieces, the shoe-pair-is-one-item invariant, Build My Look, outfit review/keep flow and current error states functioning.
- Add only minimal privacy-safe launch telemetry to understand type selection and correction (fixed enums). If adding events, update both `mobile/src/activity/track.ts` and `api/activity.py` plus privacy category registry and tests. Never log photo URI or user images.
- The first-five beta uses FastAPI and AI Worker on the **owner's Mac** via Cloudflare Tunnel, with hosted Supabase. **No migration to cloud hosting, no new vendor, no new credits/pricing, no server config changes, no Mac service restart or TestFlight deployment** without explicit approval.
- Keep scope focused on the photo add journey. Do not develop automatic Gemini type routing, a third backend pipeline, generalized computer vision infrastructure or redesign unrelated screens.

## Implementation sequence

1. Build reusable photo-type cards and a consistent source chooser.
2. Refactor Home and Add tab navigation; keep empty-closet onboarding entry.
3. Refactor camera into fixed-mode capture and direct library routes.
4. Implement safe pre-generation photo-type correction in both directions.
5. Harmonize First 3 Pieces path/copy and preserve all state/analytics.
6. Add hanging-specific **versioned** prompt support and targeted adapter tests without affecting footwear.
7. Instrument privacy-safe events and run regression, type and backend tests.
8. Prepare a short manual iPhone QA list and real hanging-garment photo evaluation. Do not label physical-device testing PASS unless executed.

## Verification

At minimum run the checks from `AGENTS.md`:

```bash
PYTHONPATH=$PWD .venv/bin/pytest -q
cd mobile && npx jest && npx tsc --noEmit
```

Run Supabase and integration checks if available. Add/update tests in `HomeScreen.test.tsx`, `AddScreen.test.tsx`, `CaptureFlow.test.tsx`, `FirstPiecesStart/Photos.test.tsx`, `OutfitScreens.test.tsx`, activity tests and the Gemini/pipeline prompt tests. **Replace outdated UX expectations rather than disabling tests.**

Demonstrate **all four combinations** (laid-out/worn × camera/library), correct a wrongly chosen type without a new photo and without a paid job, and show how the app handles outfit disabled, library cancellation and denied camera permission.

The product acceptance checklist is `docs/features/unified-add-clothes/03-ACCEPTANCE-AND-QA.md`.

## Git and handoff

Use a dedicated feature branch, make focused commits and open a PR against `main`. Do not automatically merge, deploy, restart the live Mac service or submit an EAS/TestFlight build.

In your final report include: PR link, user-visible behavior, changed code paths, prompt versions, automated test results, manual-device / real-photo QA status (PASS/FAIL/BLOCKED/NOT RUN), billing/privacy regressions checked, and any blocker.

**Do not stop at an implementation proposal. Build the change and prepare the PR.**

---
