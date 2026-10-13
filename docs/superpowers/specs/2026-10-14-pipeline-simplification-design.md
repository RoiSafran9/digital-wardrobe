# Pipeline Simplification — Design

## Context

Current pipeline (stage0-stage6) hits a real API per item, per stage: Gemini
detect (1/photo) → Replicate SAM segment (1/item) → Gemini facts (1/item) →
Gemini generate (1/item, retried) → Claude judge (1/item, retried). Live
testing surfaced it as slow (many sequential network hops per item) and
fragile (three separate providers, each with its own failure modes: Gemini
model deprecation/quota, Replicate billing/timeout/404, Claude judge).

Goal: cut model/provider dependencies and per-item latency, while keeping
the regenerated "clean" image output (stage4 stays).

## Decisions

- Keep stage4 generate (user wants a regenerated version of the item, not
  just the raw crop).
- Drop Replicate SAM entirely. Crop to the detected bbox locally with cv2 —
  no segmentation call.
- Merge stage1 (detect) + stage3 (facts) into a single Gemini call per
  photo. Already proven that `response_schema` enforces nested schema
  regardless of model strength, so the merged schema is low risk.
- Drop the Claude judge from stage5 verify. Keep the two local,
  deterministic checks (Lab color distance, OCR text match) as the only
  verification signal.
- Net result: the only remaining API provider is Gemini (vision + image
  generation). `ANTHROPIC_API_KEY` and `REPLICATE_API_TOKEN` are no longer
  required.

## Architecture

```
photo
  │
  ▼
stage0_quality (local, unchanged)
  │
  ▼
stage1_detect_facts (ONE Gemini call per photo)
  → list[DetectedItemWithFacts]  (box, category, included, exclusion_reason,
                                   colors, pattern, visible_text, trims,
                                   visible_parts, occluded_parts)
  │
  ▼ (per included item, parallel via asyncio.gather — unchanged pattern)
crop_to_box (local cv2, no network)
  │
  ▼
stage4_generate (Gemini image-gen, retried up to max_attempts)
  │
  ▼
stage5_verify (LOCAL ONLY: color distance + OCR, no judge call)
  │
  ▼
stage6_score (unchanged threshold logic, new visible_fraction source)
```

## Components

### `pipeline/types.py`
- New `DetectedItemWithFacts` model: union of current `DetectedItem` fields
  (`box`, `category`, `included`, `exclusion_reason`) and `ItemFacts` fields
  (`colors`, `pattern`, `visible_text`, `trims`, `visible_parts`,
  `occluded_parts`) — `category` appears once, as a `FactField` (facts side
  wins, since it carries confidence/basis).
- `ItemFacts` stays as-is (still the type `stage4`/`stage5`/`stage6` consume);
  a helper extracts an `ItemFacts` from a `DetectedItemWithFacts`.
- `DetectedItem` and `SegmentResult` types are removed (no longer produced
  by any stage).

### `pipeline/providers/base.py`
- `VisionProvider` protocol: replace `detect_items` + `extract_facts` +
  `judge` with a single `detect_items_with_facts(image_path: str) ->
  list[DetectedItemWithFacts]`.
- `SegmentProvider` protocol: deleted.
- `ImageGenProvider`: unchanged.

### `pipeline/providers/gemini.py`
- Replace `detect_items` and `extract_facts` with
  `detect_items_with_facts`, using a new merged prompt and
  `response_schema=list[DetectedItemWithFacts]`.
- `generate` unchanged.
- `judge` method removed (was already a stub raising `NotImplementedError`
  here; the real implementation being deleted is in `ClaudeProvider`).

### `pipeline/providers/replicate_sam.py`, `pipeline/providers/claude.py`
- Both deleted. `claude.py`'s `extract_facts` is superseded by the merged
  Gemini call; its `judge` is dropped per decision above.

### `pipeline/prompts/`
- New `stage1_detect_facts_v1.txt`: merges `stage1_detect_v1.txt` and
  `stage3_facts_v1.txt` into one prompt producing one JSON list where each
  element carries both detection and facts fields.
- `stage1_detect_v1.txt`, `stage3_facts_v1.txt`, `stage5_judge_v1.txt`:
  deleted.

### `pipeline/stages/`
- `stage1_detect.py` → renamed `stage1_detect_facts.py`. `run(image_path,
  provider)` calls `provider.detect_items_with_facts` and filters to
  `included` items (same filter logic as today).
- `stage2_segment.py` → replaced by a local-only `crop_item.py` util:
  `crop(image_path: str, box: BBox) -> str` (cv2 crop, writes crop file,
  returns path). No provider parameter, no `SegmentResult`.
- `stage3_facts.py` → deleted (facts now come from stage1's merged result).
- `stage4_generate.py` → unchanged signature; still takes `ItemFacts`
  extracted from the merged item.
- `stage5_verify.py` → drop `provider: VisionProvider` param and the
  `provider.judge(...)` call. Keep `_color_distance` and `_ocr_text`
  local checks, built from the same two violations as today minus the
  judge's.
- `stage6_score.py` → unchanged thresholds/logic. Only its caller changes
  how `visible_fraction` is computed (see below).

### `visible_fraction` (new source)
No pixel mask exists anymore. Compute from the merged facts call's part
lists:
```python
total = len(visible_parts) + len(occluded_parts)
visible_fraction = len(visible_parts) / total if total else 1.0
```
Feeds into the same `stage6_score` 0.6 threshold unchanged.

### `pipeline/orchestrator.py`
- `Providers` dataclass: drop `segment` and `judge` fields. Becomes
  `vision: VisionProvider` (detect+facts+generate... no, imagegen stays
  separate) → `Providers(vision, imagegen)`.
- `run_photo`: stage1 call now returns items with facts attached; no
  separate `stage1_detect.run` + per-item `stage3_facts.run`.
- `_run_item`: replace `stage2_segment.run(...)` with `crop_item.crop(...)`
  (sync, local, no await needed but kept async-compatible for consistency
  if other stages are async); drop the `providers.judge` wiring into
  `stage5_verify.run`; compute `visible_fraction` from parts lists instead
  of `segment_result.visible_fraction`.

### `cli.py`
- `build_providers`: drop `require_env("ANTHROPIC_API_KEY")` and
  `require_env("REPLICATE_API_TOKEN")`, drop `ClaudeProvider` and
  `ReplicateSamProvider` construction, return
  `Providers(vision=gemini, imagegen=gemini)`.

### `ui/app.py`
- No changes needed. It only calls `build_providers(logger)` and
  `run_photo(...)` — both stay generic across this refactor.

## Data Flow (per photo, detailed)

1. `stage0_quality.run(photo)` — unchanged, local blur/brightness check.
2. One `provider.detect_items_with_facts(photo)` call — returns all
   candidate items (included and excluded) with facts. Filter to
   `included`.
3. For each included item, in parallel (`asyncio.gather`, same pattern as
   today):
   a. `crop_item.crop(photo, item.box)` — local, instant.
   b. Compute `visible_fraction` from `item.visible_parts`/`occluded_parts`.
   c. Retry loop (`max_attempts`, unchanged count): `stage4_generate.run` →
      `stage5_verify.run` (local-only) → break on pass or exhaust retries.
   d. `stage6_score.run(verification, visible_fraction, max_attempts)`.
4. Same per-item isolation (`_safe_run_item` try/except → `failed` list)
   and same output file layout (`crop.png`, `generated.png`,
   `verification.json`, `result.json`) — unchanged.

## Error Handling

- Fewer failure classes: no more Replicate 404/402/429/timeout, no more
  Claude judge errors. Remaining failure surface: Gemini quota/model
  errors (detect+facts call, generate call), local cv2/OCR errors.
- A failed merged detect+facts call fails the whole photo (same as today's
  stage1 failure behavior — no items, no partial results).
- Per-item isolation in `_safe_run_item` unchanged: a crop/generate/verify
  exception for one item doesn't block others.
- `stage6_score`'s "verification failed after all retries" / "generation
  never succeeded" → `tier: low` paths unchanged.

## Testing

- Delete: `tests/providers/test_replicate_sam.py`,
  `tests/providers/test_claude.py` (judge/facts tests), any
  `tests/stages/test_stage2_segment.py`, `tests/stages/test_stage3_facts.py`.
- New/updated: `tests/providers/test_gemini.py` — test
  `detect_items_with_facts` returns `list[DetectedItemWithFacts]` via mocked
  `response_schema` call, same pattern as current `detect_items`/
  `extract_facts` tests.
- New: `tests/stages/test_crop_item.py` — cv2 crop produces a file at
  expected size, given a box.
- Update: `tests/stages/test_stage1_detect.py` → rename/retest for merged
  method + included-filter.
- Update: `tests/stages/test_stage5_verify.py` — remove judge mock/param,
  keep color-distance and OCR cases.
- Update: `tests/test_orchestrator.py` — `FakeVision.detect_items_with_facts`
  returns merged items; `Providers(vision=..., imagegen=...)` only; assert
  `visible_fraction` comes from parts-list ratio in a fixture where
  `occluded_parts` is non-empty (to confirm the new source actually drives
  the `medium` tier threshold, not just a hardcoded 1.0).
- Existing tier assertions (`test_run_photo_with_one_item_produces_high_tier`,
  `test_generate_failure_all_retries_tiers_low`) adapted to the new fake
  shape but keep the same assertions.

## Out of Scope

- The step-gated debug UI (per-stage approval walkthrough) requested
  earlier is a separate, unresolved thread — not addressed by this design.
- No change to stage0 quality check, stage4 generate retry mechanics, or
  stage6 score thresholds beyond the `visible_fraction` source swap.
