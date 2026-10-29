# Acceptance Criteria, QA & Evaluation Plan — AI Outfit Builder

**Status:** Draft v1.0 | Test first against fixture wardrobes and beta volunteers; do not infer fashion-quality success merely from valid JSON.

## 1. Delivery acceptance checklist

- [ ] A visible `Build My Look` entry in existing app navigation opens a dedicated builder screen.
- [ ] User selects/clears occasion, style, vibe, manual weather and optional colors. No GPS, weather permission or weather provider request is made.
- [ ] One tap on `Generate Looks` requests suggestions using the authenticated user's current saved/ready items.
- [ ] Response shows **1 to 3 distinct, structurally valid outfits** with exact owned catalog photos; no external/stock/generated images and no invented garment IDs.
- [ ] When wardrobe cannot form any core outfit, UI shows a helpful explanation and Add Clothes action.
- [ ] User can open an outfit and tap an item to view compatible alternatives from the **same user's closet only**.
- [ ] Choosing an alternative changes **exactly one** item/slot and keeps all other garments unchanged.
- [ ] No alternatives sheet is handled gracefully; user can dismiss without losing look.
- [ ] Works without any saved-style profile, automatic weather, diary, outfit history, save-look persistence or image generation.
- [ ] Backend verifies authenticated ownership + item status independently for look construction, alternative listing and swap apply.
- [ ] No existing front/back/360 image creation, free scan billing, welcome-credit or First 3 Pieces onboarding behavior changes.
- [ ] Service errors/LLM failure have bounded retries or deterministic fallback and user-readable recovery paths.
- [ ] iPhone small-screen / Dynamic Type / VoiceOver / dark mode verified.

## 2. Required fixture wardrobes

Use **synthetic, explicitly consented or developer-owned test items**, never data copied from another customer account.

| Fixture | Contents | Expected |
|---|---|---|
| A — Empty | 0 ready garments | No recommendations; `Add Clothes` |
| B — Only tops | 5 tops, no bottoms/one-piece | No fabricated full look; explain missing slot |
| C — Minimal | 1 top + 1 bottom | Exactly 1 core outfit, not 3 copies |
| D — A few | 3 tops + 2 bottoms | Up to 3 different coherent looks |
| E — Dress | 2 dresses + 2 cardigans | One-piece template; never treat dress as bottom |
| F — Broad | 30 mixed garments, footwear optional | 3 diverse suggestions without duplicates |
| G — Large | 150+ garments | Bounded CPU/model calls; reasonable latency |
| H — Unknown metadata | Correct images but absent fabrics/warmth | Conservative suggestions, no invented properties |
| I — Manual hot | Heavy coats + linen shirts + shorts | Avoid heavy layers where possible |
| J — Rainy | Several garments, no verified water resistance | Don't claim waterproof or specific temperature |
| K — Work Formal | Mostly casual clothes | Honest no-exact-match or clear partial fit |
| L — Stale | Item deleted after suggestion | Reject swap/apply safely |
| M — Cross-account | User A and B own similarly named items | Never recommend/swap B's items for A |
| N — Many duplicates | Multiple near-identical basic tops | Do not return near-identical top+bottom combinations as 3 distinct ideas |
| O — Outfit swap | Current top, bottom and shoes; multiple valid bottom options | Replacing bottom leaves top/shoes exactly the same |

## 3. Deterministic unit tests

- Category-to-slot mapping, especially dress vs skirt and coat vs shirt.
- Candidate generation for `top+bottom`, `one_piece`, optional outerwear/footwear.
- No duplicate IDs inside a look or duplicate compositions across results.
- Manual weather behavior and no hidden service/location reads.
- Exclusion of wrong-owner, deleted, not-ready and image-less items.
- Stable deterministic scoring/fallback with seeded fixture inputs.
- Diversity selection produces up to three genuinely different proposals.
- Swap requires same slot, new item not already in look, correct owner.
- Swap changes only target slot and can always be dismissed with no mutation.
- `Any`/missing filters normalized safely; unexpected input enum rejected.

## 4. API / integration tests

- Signed-in user with correct wardrobe → 1–3 owned-item suggestions.
- Same request for another signed-in account → only that account's items.
- Client supplies foreign `item_id` in swap request → unauthorized/stale handling, never returns foreign image.
- LLM returns bogus candidate or garment ID → rejected before response.
- LLM returns invalid JSON / times out → bounded deterministic fallback.
- Deleted item between suggest and swap → stale refresh, no assertion crash.
- Missing metadata allowed without fabricated formality/material claims.
- Rate limiting protects resource spend without hiding valid saved items.
- No server-side saved-outfit/history artifacts or profile writes from suggest/swap.
- No credit debit or generative-image endpoint invoked by look recommendation.

## 5. Manual iOS UX test journeys

1. Open `Build My Look` from Home/Closet; use defaults; generate; open first look; swap top; back; no unexpected UI reset.
2. Set `Work`, `Smart Casual`, `Warm`; explain generated fit without claiming real weather lookup.
3. Set `Rainy` and compare results; copy doesn't say weather was checked.
4. Set contradictory inputs, adjust after no-exact-match state.
5. 1–2 results only: grid/list remains polished and count accurate.
6. Empty closet → Add Clothes → back to normal app; no fabricated sample closet.
7. Swap options empty; `Keep This Piece`/dismiss works.
8. Network disconnect before generation; retry without duplicate image generation.
9. LLM failure with valid deterministic fallback; results still owned and viable.
10. Sign out and switch accounts mid-screen; no previous user's photos visible.
11. VoiceOver and font scaling; each garment can be selected without needing to infer from picture.

## 6. Recommendation quality evaluation

Technical validity is necessary but not sufficient. Before release, use a small human evaluation set with varied wardrobes and input combinations. Ask reviewers to rate each recommendation on:

- **Would you actually wear it?** yes/no/unsure.
- Occasion match (1–5).
- Weather preference match (1–5) given the **manually selected** condition.
- Visual/style coherence (1–5).
- Diversity of a three-look set (1–5).
- Swap alternatives helpfulness (1–5).

Compare basic heuristic vs optional LLM-reranked outputs on the **same** anonymous/approved fixtures, with randomized order. Avoid making precise efficacy claims until data exists.

### Product metrics (first beta)

- Suggestion request success rate with ≥1 valid result.
- Validation failures by reason and wardrobe coverage.
- P50/P90 time-to-first-look and median model cost.
- Look opening rate; swap-sheet opening rate; swap acceptance rate.
- Small user-reported willingness-to-wear rating from voluntary evaluation.

Suggested initial quality gate: all ownership and structural tests pass; human reviewers prefer/rate produced looks at least comparably to a simple manually curated baseline; performance/cost remains acceptable. **Do not invent percentage targets before observing beta data.**

## 7. Release gates / non-regression

1. Engineering audit reconciles proposed taxonomy/endpoints with actual migrations and APIs.
2. Product approves UI entry, pricing/free-with-rate-limit decision, optional model budget.
3. Deterministic engine unit tests pass on fixture wardrobes.
4. Auth/RLS isolation and malicious-ID scenarios pass.
5. Real on-device UI and error/empty states verified.
6. Beta quality/cost evaluation passes; behind feature flag until then.
7. Normal Add, Capture, Outfit Photo, wallet and First 3 onboarding all pass smoke tests.

## 8. Scope-control checkpoints for Claude Code

**Reject scope creep** into auto-weather, daily push suggestions, user-preference learning, image generation/try-on, saved-outfit model, purchase links, general chatbot and vector database unless separately approved. This project delivers *recommendation + in-session swap* only.