# Claude Code — Task 1: Audit + Production-Ready Plan for AI Outfit Builder

Copy the prompt below into Claude Code **after adding this complete doc folder** to the repository at `docs/features/ai-outfit-builder/`.

---

## Prompt

You are working on the existing **Digital Wardrobe / KIPS** iOS application.

We want to add a new **AI Outfit Builder** feature. Before writing any app code, you must audit the current repo and write a precise, small-scope implementation plan based on the supplied specifications.

**Read all six specification files first:**

- `docs/features/ai-outfit-builder/README.md`
- `docs/features/ai-outfit-builder/01-PRD.md`
- `docs/features/ai-outfit-builder/02-UX-FLOWS.md`
- `docs/features/ai-outfit-builder/03-RECOMMENDATION-ENGINE.md`
- `docs/features/ai-outfit-builder/04-API-DATA-AND-SECURITY.md`
- `docs/features/ai-outfit-builder/05-ACCEPTANCE-AND-TESTS.md`

If any is missing, stop and report it. Treat these documents as **proposed feature requirements and architecture**, not a guarantee about which APIs or metadata exist today.

### Product intent

A person selects optional inputs — **occasion, style, vibe, manually chosen weather and optionally colors** — and asks for outfit ideas. Return **up to three distinct, structurally valid looks using only ready/saved garment items belonging to that user**. Render the *existing catalog images*, not newly generated outfit pictures. The user can open a look, tap a specific garment, see compatible replacements from the **same wardrobe only**, and replace that one garment without changing the other pieces.

The app should give a helpful empty/insufficient-wardrobe response if it cannot build a legitimate outfit. Never hallucinate shoes, dresses, jackets or other pieces missing from the account.

### Approved MVP constraints — must not expand scope

- **Weather is a manual user input.** No location/GPS, WeatherKit/Open-Meteo integration, real-time forecast or automatic weather detection.
- No learned personalization, permanent taste profile, outfit history/diary, saved outfits/calendar, long-term feedback or AI training.
- No image generation, composite render from a generative model, try-on, shopping links or external clothing catalogue.
- No chatbot as main UI; use a simple form, result cards, look detail and item swap sheet.
- Do not alter existing upload flows or the First 3 Pieces Onboarding's unlimited photo queue and five generated garments per image-generation round.
- Outfit suggestion should reuse existing item metadata and images. Do not retrain a fashion model or install a vector database by default.
- Product suggests no credits for recommendation/swap in beta, with server rate limiting, but treat **credit/pricing policy as needing approval** rather than silently modifying billing.

### Audit the current repository before designing

Inspect and cite concrete file paths/functions/tables for:

1. App navigation, Home, Closet, Add and item detail screens, current visual/design system.
2. Authentication and how backend requests obtain the signed-in identity.
3. Wardrobe garment model, category/subtype/color fields, fact JSON or metadata enrichment, generated catalog image references, saved/ready/deleted statuses.
4. Backend API conventions, FastAPI routers, schema validation, async job systems and exception handling.
5. Supabase persistence, storage permissions, account isolation and RLS constraints.
6. Any existing outfit/saved-look feature, experimental recommendation code, style metadata, LLM integrations or feature flags — reuse anything relevant instead of duplicating it.
7. Tests, fixtures, credit handling and model/provider cost controls.

### Recommend an implementation strategy

Default architectural direction: a **hybrid recommendation engine**:

1. The server loads the authorized user's real ready wardrobe.
2. Normalize item metadata into structural slots (`top`, `bottom`, `one_piece`, `outerwear`, `footwear`). Be careful: dresses and skirts cannot be treated interchangeably.
3. Form candidate combinations from existing pieces using hard rules. No wardrobe ownership, structural, or item-state violations.
4. Filter and score for the selected occasion/style/vibe/manual weather/colors.
5. Return up to three varied looks; if only one/two exist, return them honestly.
6. Optionally use **Gemini for metadata-only reranking and short explanation** after the backend constructs candidates. Reject fabricated candidate IDs, validate model output, and provide deterministic fallback. Compare value/cost against rule-only scoring before making it mandatory.
7. For `Swap This Piece`, rank alternate **owned** items of the same slot against the unchanged remainder. Do not call a new image generation workflow. Revalidate ownership and state before applying swap.

Keep results transient in screen state. No new persistent `outfits`, `outfit_history` or `style_profile` tables. Propose new fields/endpoints only if missing metadata/current APIs cannot support the feature. Keep it simple enough for our friends-and-family beta.

### Required deliverables (docs only)

Write a single plan at an appropriate existing `docs/superpowers/plans/` filename and, if useful, a short audit companion under `docs/features/ai-outfit-builder/`:

**A. As-built audit** — exact existing code paths and schema, gaps/mismatches against these docs.

**B. UX flow** — where `Build My Look` enters the app, form, result cards, detail and swap sheet, loading/no-items/no-swap/error states, all aligned to current app design.

**C. Recommendation design** — category-to-slot taxonomy, minimal item features, candidate generation strategy, hard vs soft constraints, optional LLM prompt/JSON response, output validation, diversity and deterministic fallback. Address very small wardrobes.

**D. Proposed API contracts** — auth-scoped endpoints, request/response DTOs, rate limiting, error semantics, cache/metadata plan, and exact account-isolation checks.

**E. Implementation milestones / PR breakdown** — files changed, work estimate/complexity, dependencies, tests and acceptance checks per milestone. Keep PRs narrow and reviewable.

**F. Evaluation & rollback** — automated test fixtures, AI vs rules comparison, human fashion-quality evaluation, telemetry, feature flag and cost guardrails.

**G. Decisions needing approval** — only questions the code audit cannot safely resolve; include your recommended default for each. In particular: final navigation entry and whether outfit suggestions are free in the beta.

### Hard rules for this task

- **Do not implement mobile, backend or database code.** No schema migrations, model calls, deployments or paid service usage in this planning task.
- Do not blindly copy placeholder API names from specs; validate against current repo.
- Do not invent current implementation details.
- Do not add product features outside the MVP.
- Preserve existing account privacy/RLS, wallet/credits, garment AI creation and onboarding behavior.
- Document any item metadata that cannot be reliably inferred from catalog photos, especially warmth, fabric and waterproofing.
- Make the recommendation system fail safely and transparently when it can't form a good look.

When finished, summarize: **(1) the recommended architecture, (2) proposed UI entry and screen flow, (3) milestone plan, (4) real blockers, (5) product decisions to approve.**

**STOP. Wait for my approval before beginning implementation.**