# KIPS — Unified Add Clothes UX

**Status:** Approved direction / implementation-ready specification. Documentation only — no app code has been changed by this commit.  
**Date:** 2026-11-05  
**Source inspected:** `main` at `04788789334038622bfbe2c1c66a795a72482230`. Claude must pull current `main` again before coding.  
**Purpose:** Remove confusing/doubled Flat Lay / Worn / Garments / Outfit choices ahead of the first-five Friends & Family TestFlight pilot.

## Status: hanging garments (2026-11-06)

**Implemented in prompts, not yet verified.** Garment-photo detection and generation now use `pipeline/prompts/stage1_detect_facts_v6.txt` and `stage4_generate_v6.txt` (logged as `v6`): v5 plus unworn garments on a hanger, hook, rail or door, box on the garment only, hanger/clips removed in the catalog image, hidden parts never invented. Footwear (`stage4_generate_footwear_v1`) and outfit prompts are unchanged; no new model call, schema or migration. Automated tests (faked model calls) prove only prompt selection and logging. The real-photo QA (H01–H06 in [03-ACCEPTANCE-AND-QA.md](03-ACCEPTANCE-AND-QA.md) §D) has **not** run yet, so hanging support must not be called verified or advertised as proven until it passes. If a case fails, set `DETECT_PROMPT` / `GENERATE_PROMPT` in `pipeline/providers/gemini.py` back to v5.

## Approved UX decision

- **One primary Add Clothes entry on Home.** The existing Add tab remains the canonical add hub, not another competing onboarding strategy.
- **One explicit photo-type choice** in the journey, phrased in terms of *what is visible in the photo*, not AI implementation terminology:
  1. **Clothes by themselves** — clothes laid out, spread, hanging; shoes by themselves.
  2. **Someone wearing them** — photo of a person wearing clothing/shoes.
- **Both types offer Take Photo and Choose from Library.** Choose type first, then source; never force a source based on type.
- **No Garments / Outfit mode switch inside the camera.** The selected type is already known.
- **Correct wrong type with the same photo** at pre-generation stages. Re-scanning must be deliberate and cost confirmation unchanged.
- **Keep two existing scan/generate backend flows.** Do not introduce automatic AI photo-type recognition, new endpoints, a new model, or a new product tab in this MVP.
- **First 3 Pieces remains guided** with its existing multi-photo tray, cap, resume and analytics; align the wording and type choice with the add hub.
- If `WARDROBE_OUTFIT` is off, worn import is not offered and no dead navigation is exposed.
- **Hanging clothes:** currently promised in UI but excluded/underspecified by the garment detection prompt. Add narrowly scoped, versioned prompt support and real-photo verification, with no new model call.

## Files

1. [01-PRODUCT-UX-SPEC.md](01-PRODUCT-UX-SPEC.md) — user journeys, wire-level behavior, copy, error/recovery states.
2. [02-ENGINEERING-IMPLEMENTATION.md](02-ENGINEERING-IMPLEMENTATION.md) — actual repo paths, routing, scope, state/analytics, safety.
3. [03-ACCEPTANCE-AND-QA.md](03-ACCEPTANCE-AND-QA.md) — automated and manual tests, acceptance gate.
4. [04-CLAUDE-CODE-PROMPT.md](04-CLAUDE-CODE-PROMPT.md) — complete copy/paste implementation request.

## Scope boundary

This is a **pre-pilot UX cleanup**, not an AI architecture redesign. The server and AI Worker remain on the owner's **Mac** behind Cloudflare Tunnel; Supabase retains accounts/storage. No server deployment, config/flag changes, App Store submission, sending invitations, new monitoring vendor, credit-policy changes, or migration to cloud compute without explicit approval.

Review first on a device. Open PR to `main`; **do not merge or deploy** until approved. Existing `AGENTS.md` favors direct-to-main by default, but this explicit handoff requests a reviewable PR for this change.

## Source-of-truth precedence

`AGENTS.md` / `CLAUDE.md` / current repository and product specifications still apply. These files govern only the UX change and its minimal hanging-garment compatibility. Preserve existing privacy/account isolation, cost confirmations, free scan, idempotent generation and both execution modes.
