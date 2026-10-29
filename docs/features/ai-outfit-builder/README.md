# KIPS / Digital Wardrobe — AI Outfit Builder MVP

**Document status:** Product-spec draft v1.0 for review; **not authorization to implement**  
**Prepared:** 2026-10-29  
**Language of UI:** English  
**Target:** Existing iOS digital-wardrobe app (Expo/React Native frontend, Python/FastAPI and Supabase architecture to be confirmed against current repository)

## Read in order

1. [01-PRD.md](01-PRD.md) — user problem, goals, scope, product decisions, success criteria.
2. [02-UX-FLOWS.md](02-UX-FLOWS.md) — entry point, input form, suggestion cards, item swapping, loading/empty/error states, copy and accessibility.
3. [03-RECOMMENDATION-ENGINE.md](03-RECOMMENDATION-ENGINE.md) — item enrichment, deterministic filtering, candidate construction, optional LLM reranking, diversity, fallbacks, safety.
4. [04-API-DATA-AND-SECURITY.md](04-API-DATA-AND-SECURITY.md) — **proposed** request/response contracts, validation, auth and privacy, cost and latency safeguards; not claims about existing endpoints.
5. [05-ACCEPTANCE-AND-TESTS.md](05-ACCEPTANCE-AND-TESTS.md) — acceptance criteria, test fixtures, evaluation, rollout gates.
6. [06-CLAUDE-CODE-HANDOFF.md](06-CLAUDE-CODE-HANDOFF.md) — copy/paste prompt for an audit-and-implementation-plan task; no app code in that task.

## Explicitly agreed scope

- New app screen/feature for generating looks from **the signed-in user's own wardrobe items only**.
- User-chosen parameters: occasion, style, vibe, **manually selected weather**, optionally color preference.
- Return **up to three** coherent, meaningfully different looks using existing clothing images. When fewer valid looks exist, be truthful; never pad results with invented products.
- Tapping any displayed item opens **Swap This Piece**, suggesting fitting alternatives from the same user's wardrobe. The user may choose an alternative and return to the updated look.
- No weather service, GPS, forecast integration, learning/personalization, outfit diary/history, purchase suggestions, generated try-on images, or new image generation.
- No persistent saved-looks feature in this MVP; generated suggestions and swaps can live in current screen/session state.

## Proposed defaults requiring confirmation / engineering audit

- Entry point: a prominent card/button on Home or Closet; **not** a new fifth tab.
- Optional inputs have `Any`/`No preference` defaults; only one tap to generate is needed.
- V1 presentation: three look cards → look detail/edit view, with optional `Generate Again`.
- Outfit recommendations and swaps **proposed free in beta**, with server rate limiting. This is a recommendation, not a pricing decision already approved.
- No persistent outfit or taste profile. Aggregated usage telemetry may be collected for performance and quality **without** profiling individuals.
- Simple category/subtype-based rules and optional metadata-only LLM reranking; no training or vector search required for V1.
- Category coverage: use only supported wearable slots found in wardrobe data (top/bottom/one-piece/outerwear/footwear), skipping unavailable optional slots rather than inventing items.

## Key distinction from other roadmap work

**First 3 Pieces Onboarding** creates the user's initial wardrobe. **AI Outfit Builder** uses that wardrobe. These are separate features: do not alter onboarding photo collection, the agreed five generated garments per round, or credit/image generation behavior for this project.

## Source-of-truth notice

Current repo code and feature flags were **not revalidated for this document version**. File paths, metadata fields and architecture named here are conceptual until Claude Code inspects latest code and migrations. Do not hardcode nonexistent endpoints or assume all garment metadata exists. The Claude task begins with a repository audit and stops for approval before coding.