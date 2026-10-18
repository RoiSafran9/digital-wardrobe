# Pipeline Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the wardrobe pipeline down to a single provider (Gemini) by dropping Replicate SAM segmentation and the Claude judge, and merging stage1 detect + stage3 facts into one Gemini call, to reduce per-item latency and provider fragility.

**Architecture:** Replace the per-item network calls (segment, facts, judge) with: one merged Gemini detect+facts call per photo, a local cv2 crop (no network), and local-only verification (color distance + OCR). Stage4 generate is unchanged. `visible_fraction` (used for tiering) is now derived from the facts call's `visible_parts`/`occluded_parts` counts instead of a pixel mask.

**Tech Stack:** Python 3.12, pydantic v2, pytest + pytest-asyncio, google-genai SDK, cv2, pytesseract, scikit-image.

**Spec:** `docs/superpowers/specs/2026-10-14-pipeline-simplification-design.md`

## Global Constraints

- Only remaining external provider after this work: Gemini (`GEMINI_API_KEY`). `ANTHROPIC_API_KEY` and `REPLICATE_API_TOKEN` are no longer required anywhere.
- `response_schema=<pydantic model>` must be used on every Gemini structured-output call (already proven necessary — weaker models ignore prompt-only schema hints).
- Stage4 generate stays unchanged — the user wants the regenerated image, not the raw crop, as the final output.
- `stage6_score`'s `VISIBLE_FRACTION_MEDIUM_THRESHOLD = 0.6` and its tiering logic are unchanged; only the source of `visible_fraction` changes.
- Follow existing per-task TDD pattern already used in this repo: write failing test, confirm RED, implement, confirm GREEN, commit.

## Review Focus

- A photo whose merged detect+facts call returns items with empty `visible_parts` and empty `occluded_parts` (model omitted the fields) — `visible_fraction` must not divide by zero; it should default to full visibility (1.0). Covered in Task 2.
- An item that is mostly occluded (more `occluded_parts` than `visible_parts`) must still land in the `medium` tier via the new `visible_fraction` source, not silently default to `high`. Covered in Task 7.
- Expected `visible_text` that is present in facts but missing from the generated image must still fail verification now that the judge is gone — this check must not have been accidentally dropped along with the judge call. Covered in Task 5.
- A photo where `GEMINI_API_KEY` is set but `ANTHROPIC_API_KEY`/`REPLICATE_API_TOKEN` are absent must now succeed (previously `cli.main` required all three). Covered in Task 8.
- Deleting `replicate_sam.py`/`claude.py` must not leave dangling imports anywhere in the package (`pipeline/`, `cli.py`, `ui/app.py`) — a stale `from pipeline.providers.claude import ClaudeProvider` would only surface at import time, not at test-collection time for unrelated tests. Covered in Task 9 (final full-suite run + grep check).

---

## Task 1: Core types — `DetectedItemWithFacts` + `as_item_facts`

**Files:**
- Modify: `pipeline/types.py`
- Modify: `tests/test_types.py`

**Interfaces:**
- Produces: `DetectedItemWithFacts` (pydantic model: `box: BBox`, `included: bool`, `exclusion_reason: str | None`, `category: FactField`, `colors: FactField`, `pattern: FactField`, `visible_text: FactField`, `trims: FactField`, `visible_parts: FactField`, `occluded_parts: FactField`); `as_item_facts(item: DetectedItemWithFacts) -> ItemFacts`.
- Consumes: existing `BBox`, `FactField`, `ItemFacts` (unchanged, already in this file).

- [ ] **Step 1: Write the failing test**

Replace `test_detected_item_roundtrip` in `tests/test_types.py` and drop the now-invalid `DetectedItem`/`SegmentResult` import:

```python
import pytest
from pydantic import ValidationError
from pipeline.types import (
    BBox, QualityCheckResult, DetectedItemWithFacts, as_item_facts,
    FactField, ItemFacts, VerificationResult, ItemResult, RunLogEntry,
)


def test_quality_check_rejects_bad_status():
    with pytest.raises(ValidationError):
        QualityCheckResult(status="maybe")


def test_quality_check_ok():
    r = QualityCheckResult(status="ok")
    assert r.reason is None


def test_detected_item_with_facts_roundtrip():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    item = DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=10, height=10), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    assert DetectedItemWithFacts.model_validate(item.model_dump()) == item


def test_as_item_facts_extracts_facts_fields():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    item = DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=10, height=10), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    facts = as_item_facts(item)
    assert isinstance(facts, ItemFacts)
    assert facts.colors.value == "pink"


def test_item_facts_fields():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(
        category=field, colors=field, pattern=field, visible_text=field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    assert facts.colors.basis == "observed"


def test_item_result_tier_literal():
    with pytest.raises(ValidationError):
        ItemResult(tier="super", reason="x", visible_fraction=1.0)


def test_run_log_entry_defaults():
    entry = RunLogEntry(stage="stage0", model="none", prompt_version="v1",
                         latency_ms=1.0, status="ok")
    assert entry.cost_usd is None and entry.error is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_types.py -v`
Expected: FAIL — `ImportError: cannot import name 'DetectedItemWithFacts' from 'pipeline.types'`

- [ ] **Step 3: Write minimal implementation**

In `pipeline/types.py`, replace the `DetectedItem` and `SegmentResult` classes with:

```python
class DetectedItemWithFacts(BaseModel):
    box: BBox
    included: bool
    exclusion_reason: str | None = None
    category: FactField
    colors: FactField
    pattern: FactField
    visible_text: FactField
    trims: FactField
    visible_parts: FactField
    occluded_parts: FactField
```

Note: `FactField` is defined further down in the current file (after `DetectedItem`/`SegmentResult`); move the `FactField` class definition above `DetectedItemWithFacts` so it's defined before use.

Add, after the `ItemFacts` class:

```python
def as_item_facts(item: DetectedItemWithFacts) -> ItemFacts:
    return ItemFacts(category=item.category, colors=item.colors, pattern=item.pattern,
                      visible_text=item.visible_text, trims=item.trims,
                      visible_parts=item.visible_parts, occluded_parts=item.occluded_parts)
```

Final file order: `BBox`, `QualityCheckResult`, `FactField`, `DetectedItemWithFacts`, `ItemFacts`, `as_item_facts`, `VerificationResult`, `ItemResult`, `RunLogEntry`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_types.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/types.py tests/test_types.py
git commit -m "refactor: replace DetectedItem/SegmentResult with merged DetectedItemWithFacts"
```

---

## Task 2: `visible_fraction` helper + merged stage module skeleton

**Files:**
- Create: `pipeline/stages/stage1_detect_facts.py`
- Create: `tests/stages/test_stage1_detect_facts.py`

**Interfaces:**
- Consumes: `DetectedItemWithFacts` (Task 1), `VisionProvider.detect_items_with_facts` (defined in Task 3 — this task's `run()` calls it by name/shape only, Task 3 implements the protocol).
- Produces: `run(image_path: str, provider) -> list[DetectedItemWithFacts]` (filtered to `included`); `visible_fraction(item: DetectedItemWithFacts) -> float`.

- [ ] **Step 1: Write the failing test**

```python
import pytest
from pipeline.stages.stage1_detect_facts import run, visible_fraction
from pipeline.types import DetectedItemWithFacts, BBox, FactField


def _item(included=True, visible_parts=None, occluded_parts=None, exclusion_reason=None):
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=1, height=1), included=included, exclusion_reason=exclusion_reason,
        category=field, colors=field, pattern=field, visible_text=text_field, trims=field,
        visible_parts=FactField(value=visible_parts or [], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=occluded_parts or [], confidence=0.9, basis="observed"),
    )


class FakeProvider:
    def __init__(self, items):
        self.items = items

    async def detect_items_with_facts(self, image_path):
        return self.items


@pytest.mark.asyncio
async def test_filters_excluded_items():
    items = [_item(True), _item(False, exclusion_reason="worn on feet")]
    result = await run("photo.jpg", FakeProvider(items))
    assert len(result) == 1
    assert result[0].included


@pytest.mark.asyncio
async def test_zero_items_returns_empty_list():
    result = await run("photo.jpg", FakeProvider([]))
    assert result == []


def test_visible_fraction_from_parts_ratio():
    item = _item(visible_parts=["front", "collar"], occluded_parts=["back"])
    assert visible_fraction(item) == pytest.approx(2 / 3)


def test_visible_fraction_defaults_to_full_when_no_parts_listed():
    item = _item(visible_parts=[], occluded_parts=[])
    assert visible_fraction(item) == 1.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/stages/test_stage1_detect_facts.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.stages.stage1_detect_facts'`

- [ ] **Step 3: Write minimal implementation**

```python
from pipeline.types import DetectedItemWithFacts


async def run(image_path: str, provider) -> list[DetectedItemWithFacts]:
    items = await provider.detect_items_with_facts(image_path)
    return [item for item in items if item.included]


def visible_fraction(item: DetectedItemWithFacts) -> float:
    visible = len(item.visible_parts.value)
    occluded = len(item.occluded_parts.value)
    total = visible + occluded
    return visible / total if total else 1.0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/stages/test_stage1_detect_facts.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/stages/stage1_detect_facts.py tests/stages/test_stage1_detect_facts.py
git commit -m "feat: merged stage1 detect+facts module with visible_fraction helper"
```

---

## Task 3: Provider protocols — merge `VisionProvider`, drop `SegmentProvider`

**Files:**
- Modify: `pipeline/providers/base.py`
- Modify: `tests/providers/test_base.py`

**Interfaces:**
- Produces: `VisionProvider.detect_items_with_facts(image_path: str) -> list[DetectedItemWithFacts]`; `ImageGenProvider` unchanged.
- Removes: `VisionProvider.detect_items`, `.extract_facts`, `.judge`; `SegmentProvider` protocol entirely.

- [ ] **Step 1: Write the failing test**

```python
from pipeline.providers.base import VisionProvider, ImageGenProvider


class FakeVision:
    async def detect_items_with_facts(self, image_path): return []


class FakeImageGen:
    async def generate(self, crop_path, facts, violations): raise NotImplementedError


def test_fake_vision_satisfies_protocol():
    assert isinstance(FakeVision(), VisionProvider)


def test_fake_imagegen_satisfies_protocol():
    assert isinstance(FakeImageGen(), ImageGenProvider)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/providers/test_base.py -v`
Expected: FAIL — `isinstance(FakeVision(), VisionProvider)` is `False` (old protocol still requires `detect_items`/`extract_facts`/`judge`)

- [ ] **Step 3: Write minimal implementation**

Replace `pipeline/providers/base.py` entirely:

```python
from typing import Protocol, runtime_checkable
from pipeline.types import DetectedItemWithFacts, ItemFacts


@runtime_checkable
class VisionProvider(Protocol):
    async def detect_items_with_facts(self, image_path: str) -> list[DetectedItemWithFacts]: ...


@runtime_checkable
class ImageGenProvider(Protocol):
    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str: ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/providers/test_base.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/providers/base.py tests/providers/test_base.py
git commit -m "refactor: merge VisionProvider interface, drop SegmentProvider"
```

---

## Task 4: Merged prompt + Gemini provider

**Files:**
- Create: `pipeline/prompts/stage1_detect_facts_v1.txt`
- Delete: `pipeline/prompts/stage1_detect_v1.txt`, `pipeline/prompts/stage3_facts_v1.txt`
- Modify: `pipeline/providers/gemini.py`
- Modify: `tests/providers/test_gemini.py`

**Interfaces:**
- Consumes: `DetectedItemWithFacts` (Task 1).
- Produces: `GeminiProvider.detect_items_with_facts(image_path: str) -> list[DetectedItemWithFacts]`. `GeminiProvider.generate(...)` unchanged (still `-> str`).
- Removes: `GeminiProvider.detect_items`, `.extract_facts`, `.judge`.

- [ ] **Step 1: Write the failing test**

Replace `tests/providers/test_gemini.py`:

```python
import json
import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.asyncio
async def test_detect_items_with_facts_parses_response(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")  # minimal jpeg-ish bytes, never decoded

    from pipeline.providers.gemini import GeminiProvider

    field = {"value": "pink", "confidence": 0.9, "basis": "observed"}
    fake_response = MagicMock()
    fake_response.text = json.dumps([{
        "box": {"x": 0, "y": 0, "width": 10, "height": 10}, "included": True, "exclusion_reason": None,
        "category": {"value": "t-shirt", "confidence": 0.9, "basis": "observed"},
        "colors": field, "pattern": field,
        "visible_text": {"value": "", "confidence": 0.9, "basis": "observed"},
        "trims": field,
        "visible_parts": {"value": ["front"], "confidence": 0.9, "basis": "observed"},
        "occluded_parts": {"value": [], "confidence": 0.9, "basis": "observed"},
    }])

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        instance = MockClient.return_value
        instance.models.generate_content.return_value = fake_response
        provider = GeminiProvider()
        items = await provider.detect_items_with_facts(str(img_path))

    assert len(items) == 1
    assert items[0].category.value == "t-shirt"
    assert items[0].visible_parts.value == ["front"]


@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from pipeline.providers.gemini import GeminiProvider
    with pytest.raises(RuntimeError, match="missing env var: GEMINI_API_KEY"):
        GeminiProvider()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/providers/test_gemini.py -v`
Expected: FAIL — `AttributeError: 'GeminiProvider' object has no attribute 'detect_items_with_facts'`

- [ ] **Step 3: Write minimal implementation**

Create `pipeline/prompts/stage1_detect_facts_v1.txt`:

```
You are analyzing a photo of clothing items laid on a bed or floor for a digital wardrobe app.

Return every candidate clothing item visible in the photo as a JSON list. For each item, output ALL of the following:
- box: pixel bounding box {x, y, width, height}
- included: true only if the item is laid on the capture surface (bed/floor), fully in frame, and is clothing (not an accessory)
- exclusion_reason: if included is false, state why (e.g. "worn on feet", "accessory", "cut off by frame edge", "not clothing")

For every field below, output: value, confidence (0-1), and basis ("observed" if directly
seen, "inferred" if guessed from partial visibility):
- category: one word (t-shirt, shorts, dress, jacket, sandal, etc.)
- colors: list of color names from {black, white, gray, navy, blue, red, pink,
  dusty pink, mint, green, yellow, orange, purple, brown, beige}
- pattern: one of {solid, striped, floral, graphic, plaid, polka-dot}
- visible_text: any printed/embroidered text, read verbatim character by character;
  "" if none visible
- trims: short description of collar/cuff/hem trim details, or "not visible"
- visible_parts: list of parts you can see (front, back, collar, left sleeve, right sleeve, hem)
- occluded_parts: list of parts you cannot see

Exclude: items being worn by a person, accessories (sunglasses, jewelry), non-clothing objects,
items cut off by the frame edge.
Do not guess colors or categories outside the closed vocabulary above.
```

Delete `pipeline/prompts/stage1_detect_v1.txt` and `pipeline/prompts/stage3_facts_v1.txt`.

Replace `pipeline/providers/gemini.py`:

```python
import json
import time
from google import genai
from google.genai import types
from pipeline.config import require_env
from pipeline.types import DetectedItemWithFacts, ItemFacts
from pipeline.run_log import RunLogger

MODEL_VISION = "gemini-3.1-flash-lite"
MODEL_IMAGE = "gemini-2.5-flash-image"

PROMPTS_DIR = __file__.rsplit("/providers/", 1)[0] + "/prompts"


def _read_prompt(name: str) -> str:
    with open(f"{PROMPTS_DIR}/{name}") as f:
        return f.read()


class GeminiProvider:
    def __init__(self, logger: RunLogger | None = None):
        api_key = require_env("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self.logger = logger

    def _log(self, stage, prompt_version, start, status, error=None):
        if self.logger:
            self.logger.log(stage=stage, model=MODEL_VISION, prompt_version=prompt_version,
                             latency_ms=(time.monotonic() - start) * 1000,
                             status=status, error=error)

    async def detect_items_with_facts(self, image_path: str) -> list[DetectedItemWithFacts]:
        start = time.monotonic()
        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            prompt = _read_prompt("stage1_detect_facts_v1.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json",
                                                    response_schema=list[DetectedItemWithFacts]),
            )
            raw = json.loads(response.text)
            items = [DetectedItemWithFacts.model_validate(i) for i in raw]
            self._log("stage1_detect_facts", "v1", start, "ok")
            return items
        except Exception as e:
            self._log("stage1_detect_facts", "v1", start, "error", str(e))
            raise

    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            template = _read_prompt("stage4_generate_v1.txt")
            violations_block = ("\nPrevious attempt violations to fix:\n" + "\n".join(violations)
                                 if violations else "")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2),
                                      violations_block=violations_block)
            response = self.client.models.generate_content(
                model=MODEL_IMAGE,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": crop_bytes}}, prompt],
            )
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            image_bytes = response.candidates[0].content.parts[0].inline_data.data
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate", "v1", start, "ok")
            return out_path
        except Exception as e:
            self._log("stage4_generate", "v1", start, "error", str(e))
            raise
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/providers/test_gemini.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/prompts/stage1_detect_facts_v1.txt pipeline/providers/gemini.py tests/providers/test_gemini.py
git rm pipeline/prompts/stage1_detect_v1.txt pipeline/prompts/stage3_facts_v1.txt
git commit -m "feat: merge detect+facts into one Gemini call with merged prompt"
```

---

## Task 5: Local crop utility — drop Replicate SAM

**Files:**
- Create: `pipeline/stages/crop_item.py`
- Create: `tests/stages/test_crop_item.py`
- Delete: `pipeline/stages/stage2_segment.py`, `pipeline/providers/replicate_sam.py`
- Delete: `tests/stages/test_stage2_segment.py`, `tests/providers/test_replicate_sam.py`

**Interfaces:**
- Produces: `crop(image_path: str, box: BBox) -> str` (writes a cropped file next to the source image, returns its path).

- [ ] **Step 1: Write the failing test**

```python
import numpy as np
import cv2
from pipeline.stages.crop_item import crop
from pipeline.types import BBox


def test_crop_writes_file_of_expected_size(tmp_path):
    img = np.zeros((20, 20, 3), dtype=np.uint8)
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), img)

    crop_path = crop(str(img_path), BBox(x=2, y=3, width=10, height=5))

    result = cv2.imread(crop_path)
    assert result.shape[:2] == (5, 10)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/stages/test_crop_item.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'pipeline.stages.crop_item'`

- [ ] **Step 3: Write minimal implementation**

```python
import cv2
from pipeline.types import BBox


def crop(image_path: str, box: BBox) -> str:
    image = cv2.imread(image_path)
    x, y, w, h = int(box.x), int(box.y), int(box.width), int(box.height)
    cropped = image[y:y + h, x:x + w]
    crop_path = image_path.rsplit(".", 1)[0] + f"_crop_{x}_{y}.png"
    cv2.imwrite(crop_path, cropped)
    return crop_path
```

Delete `pipeline/stages/stage2_segment.py`, `pipeline/providers/replicate_sam.py`,
`tests/stages/test_stage2_segment.py`, `tests/providers/test_replicate_sam.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/stages/test_crop_item.py -v`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add pipeline/stages/crop_item.py tests/stages/test_crop_item.py
git rm pipeline/stages/stage2_segment.py pipeline/providers/replicate_sam.py \
       tests/stages/test_stage2_segment.py tests/providers/test_replicate_sam.py
git commit -m "feat: local bbox crop replaces Replicate SAM segmentation"
```

---

## Task 6: Delete `stage3_facts` (superseded by merged stage1)

**Files:**
- Delete: `pipeline/stages/stage3_facts.py`, `tests/stages/test_stage3_facts.py`

**Interfaces:**
- None — this stage's responsibility was absorbed into `stage1_detect_facts.run` (Task 2) and `as_item_facts` (Task 1).

- [ ] **Step 1: Confirm nothing still imports it**

Run: `grep -rn "stage3_facts" pipeline/ cli.py ui/`
Expected: no matches (orchestrator is updated in Task 8, which happens after this — if orchestrator.py still references it at this point, that's fine, Task 8 fixes it next; this task only removes the now-redundant module and its test).

- [ ] **Step 2: Delete the files**

```bash
git rm pipeline/stages/stage3_facts.py tests/stages/test_stage3_facts.py
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove stage3_facts, superseded by merged stage1_detect_facts"
```

---

## Task 7: Local-only verification — drop Claude judge

**Files:**
- Modify: `pipeline/stages/stage5_verify.py`
- Modify: `tests/stages/test_stage5_verify.py`
- Delete: `pipeline/providers/claude.py`, `pipeline/prompts/stage5_judge_v1.txt`
- Delete: `tests/providers/test_claude.py`

**Interfaces:**
- Produces: `run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int) -> VerificationResult` (drops the `provider` parameter).

- [ ] **Step 1: Write the failing test**

Replace `tests/stages/test_stage5_verify.py`:

```python
import numpy as np
import cv2
import pytest
from pipeline.stages.stage5_verify import run
from pipeline.types import ItemFacts, FactField


def _solid_color_image(path, bgr):
    arr = np.full((50, 50, 3), bgr, dtype=np.uint8)
    cv2.imwrite(path, arr)


def _facts(text=""):
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value=text, confidence=0.9, basis="observed")
    return ItemFacts(category=field, colors=field, pattern=field, visible_text=text_field,
                      trims=field, visible_parts=field, occluded_parts=field)


@pytest.mark.asyncio
async def test_pass_when_colors_match_and_no_text_expected(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))  # pink-ish BGR
    _solid_color_image(gen_path, (203, 192, 255))
    result = await run(crop_path, gen_path, _facts(), 1)
    assert result.status == "pass"
    assert result.violations == []


@pytest.mark.asyncio
async def test_fail_on_color_shift(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (0, 0, 255))     # red
    _solid_color_image(gen_path, (255, 0, 0))       # blue — big Lab distance
    result = await run(crop_path, gen_path, _facts(), 1)
    assert result.status == "fail"
    assert any("color" in v.lower() for v in result.violations)


@pytest.mark.asyncio
async def test_fail_on_missing_expected_text(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))  # no text rendered in the image
    result = await run(crop_path, gen_path, _facts(text="LOGO"), 1)
    assert result.status == "fail"
    assert any("LOGO" in v for v in result.violations)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/stages/test_stage5_verify.py -v`
Expected: FAIL — `TypeError: run() missing 1 required positional argument` (current `run` still requires `provider`)

- [ ] **Step 3: Write minimal implementation**

Replace `pipeline/stages/stage5_verify.py`:

```python
import cv2
import numpy as np
import pytesseract
from skimage.color import rgb2lab
from pipeline.types import ItemFacts, VerificationResult

COLOR_DISTANCE_THRESHOLD = 20.0


def _mean_lab(image_path: str):
    img = cv2.imread(image_path)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) / 255.0
    lab = rgb2lab(rgb)
    return lab.reshape(-1, 3).mean(axis=0)


def _color_distance(crop_path: str, generated_path: str) -> float:
    lab_a = _mean_lab(crop_path)
    lab_b = _mean_lab(generated_path)
    return float(np.linalg.norm(lab_a - lab_b))


def _ocr_text(image_path: str) -> str:
    img = cv2.imread(image_path)
    return pytesseract.image_to_string(img).strip()


async def run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int) -> VerificationResult:
    violations: list[str] = []

    distance = _color_distance(crop_path, generated_path)
    if distance > COLOR_DISTANCE_THRESHOLD:
        violations.append(f"color shift detected (Lab distance {distance:.1f})")

    expected_text = facts.visible_text.value
    if expected_text:
        found_text = _ocr_text(generated_path)
        if expected_text not in found_text:
            violations.append(f"expected text '{expected_text}' not found in generated image")

    status = "fail" if violations else "pass"
    return VerificationResult(status=status, violations=violations, attempt=attempt)
```

Delete `pipeline/providers/claude.py`, `pipeline/prompts/stage5_judge_v1.txt`, `tests/providers/test_claude.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/stages/test_stage5_verify.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/stages/stage5_verify.py tests/stages/test_stage5_verify.py
git rm pipeline/providers/claude.py pipeline/prompts/stage5_judge_v1.txt tests/providers/test_claude.py
git commit -m "feat: drop Claude judge, verify locally with color distance + OCR only"
```

---

## Task 8: Orchestrator — wire the simplified pipeline together

**Files:**
- Modify: `pipeline/orchestrator.py`
- Modify: `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `stage1_detect_facts.run`/`.visible_fraction` (Task 2), `crop_item.crop` (Task 5), `as_item_facts` (Task 1), `stage4_generate.run` (unchanged), `stage5_verify.run` (Task 7, no `provider` param), `stage6_score.run` (unchanged).
- Produces: `Providers(vision: VisionProvider, imagegen: ImageGenProvider)` (drops `segment`, `judge`); `run_photo(...)` same return shape as before (`{"quality", "items", "failed"}`).

- [ ] **Step 1: Write the failing test**

Replace `tests/test_orchestrator.py`:

```python
import pytest
import numpy as np
import cv2
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.types import DetectedItemWithFacts, BBox, FactField


def _write_ok_photo(path):
    arr = (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8)
    cv2.imwrite(path, arr)


def _item(visible_parts=None, occluded_parts=None):
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=100, height=100), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field, trims=field,
        visible_parts=FactField(value=visible_parts or ["front"], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=occluded_parts or [], confidence=0.9, basis="observed"),
    )


class FakeVision:
    def __init__(self, items):
        self.items = items

    async def detect_items_with_facts(self, image_path):
        return self.items


class FakeImageGen:
    async def generate(self, crop_path, facts, violations):
        gen_path = crop_path.replace("crop.png", "generated.png")
        _write_ok_photo(gen_path)
        return gen_path


@pytest.mark.asyncio
async def test_run_photo_with_one_item_produces_high_tier(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = _item()
    providers = Providers(vision=FakeVision([item]), imagegen=FakeImageGen())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    output_dir = str(tmp_path / "out")

    result = await run_photo(photo_path, output_dir, providers, logger)

    assert result["quality"].status == "ok"
    assert len(result["items"]) == 1
    assert result["items"][0]["result"].tier == "high"
    assert result["failed"] == []


@pytest.mark.asyncio
async def test_run_photo_with_zero_included_items(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    providers = Providers(vision=FakeVision([]), imagegen=FakeImageGen())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)
    assert result["items"] == []
    assert result["failed"] == []


@pytest.mark.asyncio
async def test_run_photo_retake_quality_stops_early(tmp_path):
    photo_path = str(tmp_path / "dark.png")
    arr = np.full((1000, 1000, 3), 5, dtype=np.uint8)
    cv2.imwrite(photo_path, arr)
    providers = Providers(vision=FakeVision([]), imagegen=FakeImageGen())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)
    assert result["quality"].status == "retake"
    assert result["items"] == []


@pytest.mark.asyncio
async def test_generate_failure_all_retries_tiers_low(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = _item()

    class FailingImageGen:
        async def generate(self, crop_path, facts, violations):
            raise RuntimeError("image gen API error")

    providers = Providers(vision=FakeVision([item]), imagegen=FailingImageGen())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)

    assert len(result["items"]) == 1
    assert result["items"][0]["result"].tier == "low"


@pytest.mark.asyncio
async def test_medium_tier_when_item_mostly_occluded(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = _item(visible_parts=["front"], occluded_parts=["back", "left sleeve", "right sleeve"])
    providers = Providers(vision=FakeVision([item]), imagegen=FakeImageGen())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)
    assert result["items"][0]["result"].tier == "medium"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_orchestrator.py -v`
Expected: FAIL — `TypeError: Providers.__init__() got an unexpected keyword argument` (current `Providers` still requires `segment`/`judge`)

- [ ] **Step 3: Write minimal implementation**

Replace `pipeline/orchestrator.py`:

```python
import asyncio
import os
import shutil
from dataclasses import dataclass
from pipeline.providers.base import VisionProvider, ImageGenProvider
from pipeline.run_log import RunLogger
from pipeline.stages import (
    stage0_quality, stage1_detect_facts, crop_item, stage4_generate, stage5_verify, stage6_score,
)
from pipeline.types import as_item_facts


@dataclass
class Providers:
    vision: VisionProvider
    imagegen: ImageGenProvider


async def _run_item(image_path: str, item, item_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int):
    os.makedirs(item_dir, exist_ok=True)
    crop_path = crop_item.crop(image_path, item.box)
    crop_dest = os.path.join(item_dir, "crop.png")
    shutil.copy(crop_path, crop_dest)

    facts = as_item_facts(item)
    with open(os.path.join(item_dir, "facts.json"), "w") as f:
        f.write(facts.model_dump_json(indent=2))

    verification = None
    generated_path = None
    violations: list[str] | None = None
    for attempt in range(1, max_attempts + 2):
        try:
            generated_path = await stage4_generate.run(crop_dest, facts, violations, providers.imagegen)
        except Exception:
            verification = None
            break
        verification = await stage5_verify.run(crop_dest, generated_path, facts, attempt)
        if verification.status == "pass":
            break
        violations = verification.violations

    if generated_path and os.path.exists(generated_path):
        shutil.copy(generated_path, os.path.join(item_dir, "generated.png"))
    if verification:
        with open(os.path.join(item_dir, "verification.json"), "w") as f:
            f.write(verification.model_dump_json(indent=2))

    visible_fraction = stage1_detect_facts.visible_fraction(item)
    result = stage6_score.run(verification, visible_fraction, max_attempts)
    with open(os.path.join(item_dir, "result.json"), "w") as f:
        f.write(result.model_dump_json(indent=2))

    return {"facts": facts, "verification": verification, "result": result}


async def run_photo(image_path: str, output_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int = 2) -> dict:
    quality = stage0_quality.run(image_path)
    if quality.status == "retake":
        return {"quality": quality, "items": [], "failed": []}

    included_items = await stage1_detect_facts.run(image_path, providers.vision)
    if not included_items:
        return {"quality": quality, "items": [], "failed": []}

    os.makedirs(output_dir, exist_ok=True)

    async def _safe_run_item(i, item):
        item_dir = os.path.join(output_dir, f"item_{i}")
        try:
            return await _run_item(image_path, item, item_dir, providers, logger, max_attempts)
        except Exception as e:
            logger.log(stage="orchestrator", model="n/a", prompt_version="v1",
                        latency_ms=0.0, status="error", error=str(e))
            return None

    outcomes = await asyncio.gather(*[
        _safe_run_item(i, item) for i, item in enumerate(included_items)
    ])

    items = [o for o in outcomes if o is not None]
    failed = [f"item_{i}" for i, o in enumerate(outcomes) if o is None]
    return {"quality": quality, "items": items, "failed": failed}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_orchestrator.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add pipeline/orchestrator.py tests/test_orchestrator.py
git commit -m "refactor: wire orchestrator to merged detect+facts and local crop/verify"
```

---

## Task 9: CLI — drop Claude/Replicate env requirements

**Files:**
- Modify: `cli.py`
- Modify: `tests/test_cli.py`

**Interfaces:**
- Produces: `build_providers(logger: RunLogger) -> Providers` (now requires only `GEMINI_API_KEY`, builds `Providers(vision=gemini, imagegen=gemini)`).

- [ ] **Step 1: Write the failing test**

Replace `tests/test_cli.py`:

```python
import pytest
from unittest.mock import patch, AsyncMock
from cli import main


def test_main_fails_fast_on_missing_key(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    with pytest.raises(RuntimeError, match="missing env var"):
        main(str(photos_dir), str(tmp_path / "runs"))


def test_main_processes_each_photo(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    (photos_dir / "a.jpg").write_bytes(b"fake")
    (photos_dir / "b.jpg").write_bytes(b"fake")

    with patch("cli.build_providers") as mock_build, \
         patch("cli.run_photo", new_callable=AsyncMock) as mock_run:
        mock_build.return_value = object()
        mock_run.return_value = {"quality": None, "items": [], "failed": []}
        run_id = main(str(photos_dir), str(tmp_path / "runs"))

    assert mock_run.await_count == 2
    assert run_id


def test_main_continues_after_one_photo_fails(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    (photos_dir / "a.jpg").write_bytes(b"fake")
    (photos_dir / "b.jpg").write_bytes(b"fake")

    with patch("cli.build_providers") as mock_build, \
         patch("cli.run_photo", new_callable=AsyncMock) as mock_run:
        mock_build.return_value = object()
        mock_run.side_effect = [ValueError("cannot read image: a.jpg"),
                                 {"quality": None, "items": [], "failed": []}]
        run_id = main(str(photos_dir), str(tmp_path / "runs"))

    assert mock_run.await_count == 2
    assert run_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_cli.py -v`
Expected: FAIL on `test_main_processes_each_photo` and `test_main_continues_after_one_photo_fails` with
`TypeError: Providers.__init__() got an unexpected keyword argument 'vision'` (current `cli.build_providers`
still calls `Providers(vision=gemini, segment=segment, imagegen=gemini, judge=claude)`, which no longer
matches the `Providers(vision, imagegen)` shape from Task 8).

- [ ] **Step 3: Write minimal implementation**

Replace `cli.py`:

```python
import argparse
import asyncio
import os
import time
from pipeline.config import require_env
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.providers.gemini import GeminiProvider


def build_providers(logger: RunLogger) -> Providers:
    require_env("GEMINI_API_KEY")
    gemini = GeminiProvider(logger)
    return Providers(vision=gemini, imagegen=gemini)


def main(photos_dir: str, output_root: str = "runs") -> str:
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join(output_root, run_id)
    os.makedirs(run_dir, exist_ok=True)
    logger = RunLogger(os.path.join(run_dir, "run_log.jsonl"))
    providers = build_providers(logger)

    photos = sorted(
        f for f in os.listdir(photos_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )

    async def _run_all():
        for photo in photos:
            photo_path = os.path.join(photos_dir, photo)
            photo_name = os.path.splitext(photo)[0]
            output_dir = os.path.join(run_dir, photo_name)
            try:
                await run_photo(photo_path, output_dir, providers, logger)
            except Exception as e:
                logger.log(stage="cli", model="n/a", prompt_version="v1",
                            latency_ms=0.0, status="error", error=f"{photo}: {e}")

    asyncio.run(_run_all())
    return run_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["run"])
    parser.add_argument("photos_dir")
    parser.add_argument("--output", default="runs")
    args = parser.parse_args()
    run_id = main(args.photos_dir, args.output)
    print(f"run complete: {args.output}/{run_id}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_cli.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add cli.py tests/test_cli.py
git commit -m "feat: cli only requires GEMINI_API_KEY after provider simplification"
```

---

## Task 10: Full-suite verification + dangling-import check

**Files:**
- None created/modified unless a gap is found (see Step 3).

**Interfaces:**
- None — this task verifies Tasks 1–9 compose correctly.

- [ ] **Step 1: Run the full test suite**

Run: `pytest tests/ -v`
Expected: PASS, every test in `tests/` (no skips, no errors). If any test file still imports a deleted symbol (`DetectedItem`, `SegmentResult`, `ClaudeProvider`, `ReplicateSamProvider`, `SegmentProvider`), it will fail collection — fix the stale import in that test file using the equivalent from Tasks 1–9 above.

- [ ] **Step 2: Grep for dangling references to deleted modules**

Run: `grep -rn "replicate_sam\|providers.claude\|ClaudeProvider\|ReplicateSamProvider\|SegmentProvider\|stage2_segment\|stage3_facts\b" pipeline/ cli.py ui/ tests/`
Expected: no matches. If `ui/app.py` or any file matches, update it to the new `Providers(vision, imagegen)` shape / merged stage names.

- [ ] **Step 3: Manually verify `ui/app.py` needs no change**

Confirm `ui/app.py` only calls `build_providers(logger)` and `run_photo(...)` (both already updated in Tasks 8–9) — per the design spec, no edits are expected here. If the grep in Step 2 found something here, fix it now.

- [ ] **Step 4: Confirm env vars dropped from `.env.example` are consistent**

Run: `grep -n "ANTHROPIC_API_KEY\|REPLICATE_API_TOKEN\|GEMINI_API_KEY" .env.example`
If `ANTHROPIC_API_KEY`/`REPLICATE_API_TOKEN` are listed, remove those two lines (keep `GEMINI_API_KEY`) since they're no longer read anywhere.

- [ ] **Step 5: Commit (only if Steps 1–4 required changes)**

```bash
git add -A
git commit -m "chore: final cleanup after pipeline simplification"
```

If no changes were needed, skip this step — Task 9's commit is the last one.
