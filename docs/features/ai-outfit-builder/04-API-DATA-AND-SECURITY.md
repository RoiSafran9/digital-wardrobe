# API, Data Model & Security — Proposed Contract

**Status:** Illustrative API design; not verified as existing server routes. Claude Code must inspect current auth, garment schema and API patterns first. Keep changes minimal.

## 1. API preference

Use the current backend's authenticated user context. Proposed endpoints; adjust names/shape to existing routing conventions after audit:

- `POST /v1/outfit-suggestions` — receive explicit input selections, build owned-item candidate pool, return up to three validated proposals.
- `POST /v1/outfit-suggestions/swap-options` — return ranked, eligible **owned alternatives** for a target item within a given ephemeral look.
- `POST /v1/outfit-suggestions/apply-swap` — optionally perform server validation for replacement; or have client apply a server-provided verified swap token if architecture supports it. **Do not introduce both endpoints if simpler pattern suffices.**

No saved-outfit CRUD, calendar or history APIs in V1.

## 2. Suggested request schema

```json
{
  "occasion": "work",
  "style": "smart_casual",
  "vibe": "minimal",
  "weather": "warm",
  "colors": "any"
}
```

All enum fields optional and normalized to `any`. **Never** accept a client-supplied user ID, wardrobe owner ID or list of trusted garment IDs to decide ownership. Server queries the authenticated user's ready wardrobe items itself.

## 3. Suggested response schema

```json
{
  "looks": [
    {
      "look_id": "ephemeral_opaque_1",
      "title": "Easy Workday",
      "reason": "A clean pairing suited to a warm workday.",
      "item_ids": ["garment_01", "garment_04"],
      "slots": {"top": "garment_01", "bottom": "garment_04"},
      "completeness": "core_outfit"
    }
  ],
  "applied_filters": {"occasion": "work", "style": "smart_casual", "vibe": "minimal", "weather": "warm", "colors": "any"},
  "limitations": [],
  "used_fallback": false
}
```

Look IDs are in-session, opaque, and **not a persistent outfit history key**. The client resolves item images through the authenticated existing wardrobe view-model or a server-supplied authorized item DTO. Do **not** put private storage object paths or public image URLs into an AI prompt.

`completeness` explicitly reflects owned-item coverage (`core_outfit` or `partial_with_optional_slots_missing`). A look lacking a mandatory bottom / one-piece should **not** be presented as an outfit; return an insufficient-wardrobe state instead.

Model-generated title/reason are strictly bounded length, escaped for UI, and rejected/sanitized when they refer to unknown garments, external purchases or weather facts that were never supplied.

## 4. Swap request / response

Request to `swap-options`:

```json
{
  "look": {
    "slots": {"top": "garment_01", "bottom": "garment_04"},
    "item_ids": ["garment_01", "garment_04"]
  },
  "target_item_id": "garment_04",
  "filters": {"occasion": "work", "style": "smart_casual", "vibe": "minimal", "weather": "warm", "colors": "any"}
}
```

Response:

```json
{
  "target_slot": "bottom",
  "alternatives": [
    {"item_id": "garment_07", "reason": "A similarly polished option."},
    {"item_id": "garment_11", "reason": "A more casual alternative."}
  ]
}
```

Every garment in `look`, `target_item_id`, and `alternatives` is revalidated for current authenticated owner, active/ready state, uniqueness and appropriate slot. Request-supplied look contents are **untrusted data**. Ignore/exclude other-tenant IDs and return a controlled error if stale.

Applying a swap changes exactly one slot in session state and should not mutate real wardrobe item metadata or delete anything.

## 5. Data model changes

**Preferred zero-history design:** Generated look suggestions are ephemeral API output. The frontend holds them in route/provider state and discards them on exit/restart. No persistent `outfits`, `outfit_history`, `daily_outfit` or `user_style_profile` tables required.

**Potential item metadata enrichment** (use existing fields first):

```ts
// Provisional logical schema, not mandated migration
interface GarmentStyleFeatures {
  itemId: string;
  slot: 'top'|'bottom'|'one_piece'|'outerwear'|'footwear'|'unknown';
  subtype?: string;
  colors?: string[];
  formality?: 'casual'|'smart'|'formal'|'unknown';
  warmth?: 'light'|'mid'|'heavy'|'unknown';
  styleTags?: string[];
  confidence?: Record<string, number>;
}
```

If columns don't exist, first examine whether existing garment fact JSON can be read and normalized without a migration. Persist derived metadata only if it lowers cost and doesn't require unapproved user-visible generation. Keep a schema version for future reclassification if necessary.

## 6. Privacy and security invariants

- All wardrobe queries scoped to the authenticated session; Supabase RLS remains enforced.
- Server must never trust client-provided `owner_id`, garment IDs, image URLs, candidate rankings, or model responses.
- No access to another user's photos/items, not even through guessed IDs or cached recommendations.
- Existing private catalog image delivery must remain permission-checked; no global public URL cache.
- User-controlled garment names/notes are untrusted data, never instructions to the LLM. Use strict structured prompt boundaries and response validation.
- Do not send original outfit body photos or private source images to a separate recommendation AI pipeline. Start with available sanitized clothing attributes only.
- No location/IP-based weather inference, GPS, forecasts, current-day behavioral surveillance, body-size inference or protected-characteristic inference.
- Analytics omit image URLs and individual wardrobe item IDs. Aggregate latency, route/source, option chosen, response count, error family, swapped slot and anonymous quality metrics only.
- Follow existing retention/account deletion behavior; do not create new long-lived personalization state.

## 7. Performance / model spend

- Treat generation of outfit *recommendations* as separate from generation of new *images*. No new images produced or user-facing generation credits automatically consumed.
- Model requests happen only on `Generate Looks` (or explicit `Generate Again`) if using AI reranking; never on every slider/chip change or item render.
- Swap alternatives should be ranked deterministically using existing features wherever possible; don't require a new LLM call for every tap.
- Bound candidate combinatorics and model prompt size internally; caching normalized item features is acceptable if account-scoped and existing data model permits it.
- Enforce user/request concurrency controls, sensible per-user rate limits, cost metrics, timeouts and circuit breakers. These are **resource limits**, not a limit on wardrobe size.
- Fallback to valid deterministic results when LLM unavailable; graceful 429/5xx messaging otherwise.

## 8. Error taxonomy (suggested)

| Error type | HTTP / handling suggestion | UX |
|---|---|---|
| No authenticated user | 401 | Existing sign-in flow |
| Missing/invalid enum | 400 or 422 | Keep form, highlight choice |
| No wardrobe items / no valid pair | 200 with empty looks and typed reason (or project convention) | Helpful Add Clothes / adjust |
| Stale/unowned item on swap | 403/404/409 depending project conventions | Refresh this look |
| Service busy/rate-limited | 429 | Retry later; preserve current results |
| LLM unusable | deterministic fallback when safe | Show valid looks; no fabricated data |
| Unexpected server failure | 5xx | Recoverable retry |

## 9. API validation checklist

1. An authenticated user cannot retrieve or swap another account's garment by guessing an ID.
2. LLM response cannot inject a foreign/nonexistent garment ID.
3. A deleted/incomplete item cannot appear in output or swap alternatives.
4. A user can get valid deterministic outfits when LLM is disabled.
5. A request without weather does not make temperature claims.
6. `Rainy` does not imply cold weather or verified waterproof garments.
7. Extra attributes are not guessed if absent; schema and contracts remain backwards compatible.
8. No image generation, new billing holds or paid credits invoked by suggestion/swap.
9. Model outage/timeout avoids uncontrolled retries and user-visible error loops.
10. No unapproved persistent preference/history data created.