# Claude Code Task — Outfit Photo Import: Research, Design and Staged Implementation

**Repository:** `RoiSafran9/digital-wardrobe`  
**Status:** New feature, NOT built; start with technical research and a measured proof of concept.  
**Product spec (read first):** [Two Input Flows — Garment Photo and Worn Outfit Photo](../superpowers/specs/2026-10-19-outfit-photo-two-step-design.md)

## Your role

Act as Senior AI Product Engineer, Computer Vision Engineer and Full-Stack Software Architect. Work in the existing repo; favor the smallest credible implementation and real evidence over optimistic demos.

**The owner has approved the two-mode direction and the two-stage Outfit flow.** Many technical decisions are proposals, not approval to build a major new subsystem or enable billing.

Your mission:

1. Inspect the current code and all relevant source-of-truth docs.
2. Perform a concise, source-backed technical feasibility study.
3. Present an architecture, initial hypotheses, measurable evaluation plan and staged implementation tasks.
4. Build a **minimal off-by-default experimental proof of concept** only where feasible without external configuration, secrets or unapproved paid calls; otherwise prepare a reproducible harness and explicitly state the blocker.
5. Submit reviewable documentation/experimental changes via a PR. **Do not implement or ship the full phone experience without owner approval of POC results.**

## Product requirement (non-negotiable)

Digital Wardrobe must support **two distinct input contexts**:

### A. Garment-only image (the existing path)

Photo of one garment or several garments laid on bed/floor → current quality/detection/cropping → high-quality AI front catalog generation → saved items in personal closet.

**Keep this working as is.** Avoid adding a new external model call to every photo unless benchmarking proves it necessary. The existing detector explicitly excludes worn clothing; don't loosen its prompt in place.

### B. Photo of a person wearing garments (new path)

**Stage 1: Detect → preview → user confirms.**
- Identify separable garment candidates from the worn outfit.
- Show low-cost previews (prefer an original-photo crop plus box/mask/overlay, not full AI generation).
- User may select only trousers, only shirt, several garments, or none.
- Offer correction/retry for a mistaken candidate and make uncertainty legible.
- Stage 1 consumes **no user credits**; it still has real provider costs to measure.

**Stage 2: Confirm price → generate selected only → review/save.**
- Display selected count and exact server-authoritative price before any expensive final generation.
- High-quality generation recreates a *complete flat-lay version of the same physical clothing piece*, inferring missing areas when necessary.
- Generate **only** selected candidates.
- Allow per-item review / quality feedback and save; an unsuccessful item must not block others.
- Charge the **existing** shared AI Credits wallet only for successful user-approved final-front-image actions. Auto retries are not separate charges; the billing policy for subjective dissatisfaction/manual regeneration remains to be decided.
- After save, existing independent back-image and four-view 360 actions remain available, with their existing prices.

Both routes should be reachable from existing Add / quick-add entry points, with automatic routing and a user override if reliable; if ambiguous, ask the user. Explicit mode choice may be preferable for the first test.

## Read and inspect before proposing edits

Start with:
- `AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`.
- `docs/PRD.md`, `docs/SCREENS.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/CREDITS.md`.
- The linked outfit spec above.
- `pipeline/orchestrator.py`, `pipeline/providers/gemini.py`, `pipeline/stages/stage0_quality.py`, `pipeline/stages/crop_item.py`.
- `pipeline/prompts/stage1_detect_facts_v4.txt` and `pipeline/prompts/stage4_generate_v5.txt` (currently for flat garment photographs).
- `api/routes/v1.py`, `api/worker.py`, `api/store.py`, `api/credits.py`, all relevant Supabase migrations and tests.
- `mobile/src/useCapture.ts`, `mobile/src/components/FrontsPicker.tsx`, `mobile/src/credits/CreditsProvider.tsx`, `mobile/src/api/v1.ts` and current screen components.

**Beware stale documentation:** The latest code already has the **wallet, ledger, admin grants, per-action max_fronts billing behind `WARDROBE_BILLING=on` (OFF by default), reconciliation and credits UI**. Do not describe them as hypothetical or rebuild them. `main` may evolve while you work; verify actual code/branches/PRs, and reconcile any documents that are lagging.

The pipeline's worn-photo route is not yet present: existing stage-1 prompt literally excludes items worn by a person. Existing `garment` jobs do not have a user-confirmed detected-candidate selection phase.

## Research assignment (before implementing)

Research using **current official/paper/project sources**, and link the evidence:

1. **Multi-garment detection on people:** How reliably does Gemini Vision return *instance-level* candidate objects and per-item boxes for tops, jackets, pants, dresses, skirts and shoes, especially overlap/layering?
2. **Preview crops vs segmentation:** Benchmark simple cropping/box overlays first. Evaluate whether human parsing or instance masking materially helps distinct garment selection, especially jacket over shirt. Check model licenses, privacy, GPU/CPU requirements and serving cost.
3. **Worn garment → complete isolated flat-lay:** Compare (a) current Gemini image model + new prompt + crop/context and (b) one credible dedicated virtual try-off/reconstruction option. Verify that **virtual try-on (garment → person)** is NOT the same task as **virtual try-off (person → garment)**; do not use irrelevant model claims.
4. **Fidelity failure modes:** Occluded hems, collars, layered upper garments, printed graphics/text, fabric shade, camera pose, shoe pairs. What can the model honestly infer? How to flag uncertain or unacceptable outputs?
5. **Routing strategy:** Up-front explicit user mode vs cheap classifier vs using an existing vision call. Quantify added latency, AI tokens, and risk of classifying normal garment photos incorrectly.
6. **Two-stage jobs + storage:** Reuse existing authenticated Supabase rows / jobs / signed URLs where possible. Compare lightweight scan-session metadata in a job JSONB result to a dedicated `outfit_scan_candidates` table. Discuss re-entry after app restart, expiration of person photos, authorization, and cleanup.
7. **Integration with existing wallet:** Stage 1 is free for users. Stage 2 occurs only after selected IDs and credit quote; avoid reservation before approval and prevent replay, double debit and per-user data leakage.

Potential research reference, **not a required dependency**:
- https://github.com/fashn-AI/fashn-human-parser (human-semantic parsing; assess suitability for instance-level selection and license before incorporating).
- https://huggingface.co/fashn-ai/fashn-human-parser (model labels and limitations; shoes/layered items may not be distinct).
- https://github.com/fashn-AI/fashn-vton-1.5 (**this is try-on, not inverse try-off**; don't confuse them).

Prefer a **Gemini-only baseline** first before adding a new heavyweight provider or model. Limit research to decisions that matter to a 1–2 person team.

## Proof of concept and evaluation

A POC should run from a **local dev script or test harness** before changing product UX or billing.

### Proposed eval dataset

Aim for **30–50 consented person/outfit photos**. Include simple outfits, layered jackets, tuck-ins, partial occlusion, skirts/dresses, shoe visibility, different lighting, prints and text. Acquire reference laid-flat photos of the same actual garment wherever possible. **Do not assume such a dataset exists** or collect images from strangers without permissions.

Respect the user's privacy: no private person photos in Git, issue comments, PR screenshots or unprotected logs. Use a gitignored fixture directory or non-identifying synthetic/mock data for committed tests.

### Experiments

- Run candidate detection with a separately versioned worn-person prompt, returning stable candidate IDs, boxes and descriptions.
- Show example **original crops / bounding boxes** with labels in a local report. Measure whether the intended garment can be selected unambiguously.
- Optionally compare a segmentation parser; do not install heavy GPU packages or download large model weights without explaining costs/resources.
- On consented selected candidates, try the new worn-garment-to-flat-lay generation prompt (also separately versioned) and compare to reference clothes.
- Record latency, model calls, actual provider cost (where known), per-class detection precision/recall, number of false candidate merges/splits, reconstruction detail fidelity and accepted generated outputs.

**Do not perform a large volume of paid AI calls without explicit owner budget/approval.** If images, credentials or budget are missing, build reproducible fixtures and the harness, write the required manual steps, and do not fabricate measurements or claim successful reconstruction.

### POC artifact

Create a concise evaluation report (e.g. `docs/superpowers/specs/outfit-import-evaluation.md`) that clearly distinguishes:
- Measurements genuinely executed
- Assumptions / expected issues
- Tests still requiring owner-provided photos or credentials
- Recommendations and unresolved product decisions

Do not check in original or generated private person photos.

## Architecture to propose (not automatically lock in)

Draw a concrete route/state diagram, API contracts and typed candidate records. Cover:
- Intake classification or explicit selected mode; fallback / manual override.
- `outfit_scan` (detected, awaiting selection, generating, completed, expired/failed), stable candidate IDs and private crop previews.
- Per-user ownership and RLS; signed URLs and storage lifecycle, especially face-containing originals.
- Candidate selection + quote + confirmation; versioned prices and feature flags.
- Generation job reuse and per-candidate retries/idempotency.
- Quality failures, per-item partial success, user corrections and post-generation review.
- Storage provenance for items from worn photos without breaking existing `source_kind` constraints.
- Abort, cancel, no candidates, multiple people, ambiguous images, stale scans, app termination and account switch.
- Error/recovery states and how you prevent duplicates or accidental charges.
- Distinguish what to build now from infrastructure that should be deferred.

Keep existing `pipeline/prompts/stage1_detect_facts_v4.txt` and `stage4_generate_v5.txt` unchanged; create new versioned prompts for worn-person photos. Preserve the existing normal photo flow and credit semantics.

## Proposed milestones (implementation after POC review)

**M0 — Research and offline POC (start now).**
- Inspect code, confirm actual capabilities.
- Short current research report, cited evidence, architecture tradeoffs.
- Versioned candidate-detection prompt + simple offline detector/crop experiment **only if safe, funded and inputs available**; otherwise harness with mocks.
- Concrete acceptance criteria and owner-dependent next steps.
- No mobile production UI or billing changes.

**M1 — Candidate detection / private preview session.**
- Add an authenticated, resumable scan request/lookup API.
- Store source and previews privately, expiry and cleanup; return candidate IDs with preview URLs.
- Test two-account isolation, errors, retake and idempotency.

**M2 — Selection and final generation.**
- Submit selected candidate IDs from same user's scan, enforce validation and user quote.
- Extend job worker and worn-garment prompt for selected pieces, review and save outputs.
- Reuse wallet/ledger to settle only successful selected front-image actions after approval.
- No change to back/360 costs or automatic extra generation.
- Add partial success and retry recovery tests.

**M3 — Native mobile experience.**
- Input routing / manual override.
- Candidate preview picker, correct/exclude/retry, count and price, progress, final review.
- Follow DESIGN.md, dark mode, VoiceOver, dynamic text.
- Existing capture flow must regress cleanly.

**M4 — F&F limited beta.**
- Feature flag, cost budget and rate limits for free detection, accurate metrics.
- Verify with actual people/outfits and photographs of the same garments, not just mocks.

## Required first outputs

1. **Research brief** (links and technical conclusions).
2. **Side-by-side options analysis** (Gemini-only vs parser-assisted; input routing).
3. **Proposed API, storage and state machine**, with privacy/credit integration.
4. **Evaluation plan** with measurable acceptance indicators and uncertainty about reconstruction.
5. **Small POC or reproducible harness**, clearly documenting what actually ran.
6. **Focused PR** with research, spec updates, mocks/POC and tests; no production feature flag enabled and no automatic merge.
7. A short handoff in Hebrew for the owner, including what requires explicit decision before M1/M2.

## Guardrails

- Do not call the garment catalog model in Stage 1 merely to create pretty previews. Prefer crops from the original image; generation happens only for selected candidates.
- Do not infer face identity, gender, age, ethnicity or other personal traits. Ignore people as subjects; only process garment regions.
- Don't send person images to a new vendor without discussing privacy/licensing terms first.
- Keep source-person photos private, avoid long-lived public URLs, define explicit retention/deletion, never add raw images to git.
- Do not invent success rates, test runs, approval, screenshots, data, AI spend or implementation completeness.
- Do not replace or rewrite the current garment-only pipeline.
- Do not change billing defaults or enable `WARDROBE_BILLING` or introduce a second credit wallet.
- Inspect Git status/branches/PRs, work in a focused branch based on latest `main`, run relevant `pytest`/Jest/TypeScript/pgTAP tests as applicable, report any unavailable environment and open an **unmerged PR**.

**Success for this task is a credible, testable path to the feature backed by real engineering evidence — not pretending the whole worn-outfit flow is already production-ready.**
