# Pipeline MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v0 of the clothes-detection pipeline (stages 0-6) with real API providers behind typed interfaces, plus a Streamlit test harness.

**Architecture:** Each stage is a pure async function over pydantic types. Providers (Gemini/Claude/Replicate-SAM) implement thin Protocol interfaces; stages depend only on the Protocol. Orchestrator wires providers to stages, forks per-item work concurrently via asyncio, retries stage4↔stage5 up to 2x, logs every model call.

**Tech Stack:** Python 3.11+, pydantic v2, opencv-python-headless, scikit-image, pytesseract, google-genai, anthropic, replicate, streamlit, pytest + pytest-asyncio.

**Spec:** `docs/superpowers/specs/2026-10-13-pipeline-mvp-design.md`

## Global Constraints

- Python 3.11+ (uses `X | None` unions, `Literal`).
- Every stage function: typed pydantic input → typed pydantic output.
- Providers implement Protocols in `pipeline/providers/base.py`; stage code never imports a concrete provider class.
- Prompts live in `pipeline/prompts/*.txt` files, never inline strings.
- Stage4→stage5 retry loop: max 2 retries (3 attempts total), then stage6 tiers as `low`.
- API keys read only from environment (via `.env` + `python-dotenv`), never hardcoded.
- Original input photos are never modified; all writes go under `runs/`.

## Review Focus

- Missing/invalid API key → fail fast at startup with the missing var name, before processing any photo.
- Photo with zero included items (all excluded, e.g. worn clothing) → pipeline completes, reports 0 items, does not crash.
- Stage4 generate fails all retries → stage6 tiers `low`, run continues (not a crash).
- Corrupted/unreadable image file → stage0 raises a clear error for that photo only; other photos in the batch continue.
- Provider returns malformed/non-schema JSON → logged as `status="error"` in run_log, that item marked failed, other items continue.

---

## Task 1: Project scaffolding

**Files:**
- Create: `pyproject.toml`, `.gitignore`, `.env.example`
- Create: `pipeline/__init__.py`, `pipeline/config.py`
- Test: `tests/test_config.py`

**Interfaces:**
- Produces: `pipeline.config.require_env(name: str) -> str` — raises `RuntimeError(f"missing env var: {name}")` if unset; used by every provider at init.

- [ ] **Step 1: Write failing test**

```python
# tests/test_config.py
import pytest
from pipeline.config import require_env

def test_require_env_missing(monkeypatch):
    monkeypatch.delenv("DOES_NOT_EXIST", raising=False)
    with pytest.raises(RuntimeError, match="missing env var: DOES_NOT_EXIST"):
        require_env("DOES_NOT_EXIST")

def test_require_env_present(monkeypatch):
    monkeypatch.setenv("SOME_VAR", "value")
    assert require_env("SOME_VAR") == "value"
```

Run: `pytest tests/test_config.py -v` → Expected: FAIL (`pipeline.config` doesn't exist)

- [ ] **Step 2: Create scaffolding**

```toml
# pyproject.toml
[project]
name = "my-wardrobe-pipeline"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "pydantic>=2",
  "python-dotenv",
  "opencv-python-headless",
  "numpy",
  "pillow",
  "scikit-image",
  "pytesseract",
  "google-genai",
  "anthropic",
  "replicate",
  "streamlit",
]

[project.optional-dependencies]
dev = ["pytest", "pytest-asyncio"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

```
# .gitignore
.env
runs/
__pycache__/
*.pyc
.venv/
```

```
# .env.example
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
REPLICATE_API_TOKEN=
```

```python
# pipeline/config.py
import os
from dotenv import load_dotenv

load_dotenv()

def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"missing env var: {name}")
    return value
```

```python
# pipeline/__init__.py
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pytest tests/test_config.py -v` → Expected: PASS

- [ ] **Step 4: Install deps and commit**

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
git add pyproject.toml .gitignore .env.example pipeline/__init__.py pipeline/config.py tests/test_config.py
git commit -m "chore: project scaffolding, env config"
```

---

## Task 2: Core types

**Files:**
- Create: `pipeline/types.py`
- Test: `tests/test_types.py`

**Interfaces:**
- Produces: `BBox`, `QualityCheckResult`, `DetectedItem`, `SegmentResult`, `FactField`, `ItemFacts`, `VerificationResult`, `ItemResult`, `RunLogEntry` — all pydantic `BaseModel`, importable from `pipeline.types`.

- [ ] **Step 1: Write failing test**

```python
# tests/test_types.py
import pytest
from pydantic import ValidationError
from pipeline.types import (
    BBox, QualityCheckResult, DetectedItem, SegmentResult,
    FactField, ItemFacts, VerificationResult, ItemResult, RunLogEntry,
)

def test_quality_check_rejects_bad_status():
    with pytest.raises(ValidationError):
        QualityCheckResult(status="maybe")

def test_quality_check_ok():
    r = QualityCheckResult(status="ok")
    assert r.reason is None

def test_detected_item_roundtrip():
    item = DetectedItem(box=BBox(x=0, y=0, width=10, height=10), category="t-shirt", included=True)
    assert DetectedItem.model_validate(item.model_dump()) == item

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

Run: `pytest tests/test_types.py -v` → Expected: FAIL (module not found)

- [ ] **Step 2: Implement types**

```python
# pipeline/types.py
from typing import Literal
from pydantic import BaseModel


class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class QualityCheckResult(BaseModel):
    status: Literal["ok", "retake"]
    reason: Literal["blurry", "too_dark", "low_resolution"] | None = None


class DetectedItem(BaseModel):
    box: BBox
    category: str
    included: bool
    exclusion_reason: str | None = None


class SegmentResult(BaseModel):
    mask_path: str
    crop_path: str
    visible_fraction: float
    occluded_by: list[int] = []


class FactField(BaseModel):
    value: str | list[str]
    confidence: float
    basis: Literal["observed", "inferred"]


class ItemFacts(BaseModel):
    category: FactField
    colors: FactField
    pattern: FactField
    visible_text: FactField
    trims: FactField
    visible_parts: FactField
    occluded_parts: FactField


class VerificationResult(BaseModel):
    status: Literal["pass", "fail"]
    violations: list[str]
    attempt: int


class ItemResult(BaseModel):
    tier: Literal["high", "medium", "low"]
    reason: str
    retake_instruction: str | None = None
    visible_fraction: float


class RunLogEntry(BaseModel):
    stage: str
    model: str
    prompt_version: str
    latency_ms: float
    cost_usd: float | None = None
    status: Literal["ok", "error"]
    error: str | None = None
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/test_types.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/types.py tests/test_types.py
git commit -m "feat: core pydantic types for all stage I/O"
```

---

## Task 3: Run logger

**Files:**
- Create: `pipeline/run_log.py`
- Test: `tests/test_run_log.py`

**Interfaces:**
- Consumes: `RunLogEntry` (Task 2)
- Produces: `RunLogger(path: str)` with `.log(stage, model, prompt_version, latency_ms, status, cost_usd=None, error=None) -> None` and `.read_all() -> list[RunLogEntry]`

- [ ] **Step 1: Write failing test**

```python
# tests/test_run_log.py
from pipeline.run_log import RunLogger

def test_log_and_read_back(tmp_path):
    log_path = tmp_path / "run_log.jsonl"
    logger = RunLogger(str(log_path))
    logger.log(stage="stage0", model="opencv", prompt_version="v1",
                latency_ms=12.5, status="ok")
    logger.log(stage="stage1", model="gemini-2.5-flash", prompt_version="v1",
                latency_ms=300.0, status="error", error="timeout")
    entries = logger.read_all()
    assert len(entries) == 2
    assert entries[0].stage == "stage0" and entries[0].status == "ok"
    assert entries[1].error == "timeout"
```

Run: `pytest tests/test_run_log.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/run_log.py
import json
from pipeline.types import RunLogEntry


class RunLogger:
    def __init__(self, path: str):
        self.path = path

    def log(self, *, stage: str, model: str, prompt_version: str,
             latency_ms: float, status: str, cost_usd: float | None = None,
             error: str | None = None) -> None:
        entry = RunLogEntry(
            stage=stage, model=model, prompt_version=prompt_version,
            latency_ms=latency_ms, cost_usd=cost_usd, status=status, error=error,
        )
        with open(self.path, "a") as f:
            f.write(entry.model_dump_json() + "\n")

    def read_all(self) -> list[RunLogEntry]:
        entries = []
        try:
            with open(self.path) as f:
                for line in f:
                    if line.strip():
                        entries.append(RunLogEntry.model_validate(json.loads(line)))
        except FileNotFoundError:
            pass
        return entries
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/test_run_log.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/run_log.py tests/test_run_log.py
git commit -m "feat: jsonl run logger for model call tracking"
```

---

## Task 4: Provider protocols

**Files:**
- Create: `pipeline/providers/__init__.py`, `pipeline/providers/base.py`
- Test: `tests/providers/test_base.py`

**Interfaces:**
- Consumes: `BBox`, `DetectedItem`, `SegmentResult`, `ItemFacts` (Task 2)
- Produces: `VisionProvider`, `SegmentProvider`, `ImageGenProvider` — `@runtime_checkable` Protocols. All later provider implementations and stage functions type-hint against these.

- [ ] **Step 1: Write failing test**

```python
# tests/providers/test_base.py
from pipeline.providers.base import VisionProvider, SegmentProvider, ImageGenProvider
from pipeline.types import BBox, DetectedItem, SegmentResult, ItemFacts, FactField


class FakeVision:
    async def detect_items(self, image_path): return []
    async def extract_facts(self, crop_path, context_path): raise NotImplementedError
    async def judge(self, crop_path, generated_path, facts): return []


class FakeSegment:
    async def segment(self, image_path, box): raise NotImplementedError


class FakeImageGen:
    async def generate(self, crop_path, facts, violations): raise NotImplementedError


def test_fake_vision_satisfies_protocol():
    assert isinstance(FakeVision(), VisionProvider)

def test_fake_segment_satisfies_protocol():
    assert isinstance(FakeSegment(), SegmentProvider)

def test_fake_imagegen_satisfies_protocol():
    assert isinstance(FakeImageGen(), ImageGenProvider)
```

Run: `pytest tests/providers/test_base.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/providers/__init__.py
```

```python
# pipeline/providers/base.py
from typing import Protocol, runtime_checkable
from pipeline.types import BBox, DetectedItem, SegmentResult, ItemFacts


@runtime_checkable
class VisionProvider(Protocol):
    async def detect_items(self, image_path: str) -> list[DetectedItem]: ...
    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts: ...
    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]: ...


@runtime_checkable
class SegmentProvider(Protocol):
    async def segment(self, image_path: str, box: BBox) -> SegmentResult: ...


@runtime_checkable
class ImageGenProvider(Protocol):
    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str: ...
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/providers/test_base.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
mkdir -p tests/providers && touch tests/providers/__init__.py
git add pipeline/providers/__init__.py pipeline/providers/base.py tests/providers/
git commit -m "feat: provider Protocol interfaces"
```

---

## Task 5: Stage 0 — quality check

**Files:**
- Create: `pipeline/stages/__init__.py`, `pipeline/stages/stage0_quality.py`
- Test: `tests/stages/test_stage0_quality.py`

**Interfaces:**
- Consumes: `QualityCheckResult` (Task 2)
- Produces: `run(image_path: str) -> QualityCheckResult`; raises `ValueError` on unreadable file.

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage0_quality.py
import numpy as np
import cv2
import pytest
from pipeline.stages.stage0_quality import run

def _write(tmp_path, name, arr):
    path = str(tmp_path / name)
    cv2.imwrite(path, arr)
    return path

def test_ok_image(tmp_path):
    arr = (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8)
    path = _write(tmp_path, "ok.png", arr)
    result = run(path)
    assert result.status == "ok"

def test_too_dark(tmp_path):
    arr = np.full((1000, 1000, 3), 5, dtype=np.uint8)
    path = _write(tmp_path, "dark.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "too_dark"

def test_low_resolution(tmp_path):
    arr = (np.random.rand(200, 200, 3) * 255).astype(np.uint8)
    path = _write(tmp_path, "small.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "low_resolution"

def test_blurry(tmp_path):
    arr = np.full((1000, 1000, 3), 128, dtype=np.uint8)
    path = _write(tmp_path, "flat.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "blurry"

def test_unreadable_file_raises(tmp_path):
    path = str(tmp_path / "not_an_image.png")
    with open(path, "w") as f:
        f.write("garbage")
    with pytest.raises(ValueError, match="cannot read image"):
        run(path)
```

Run: `pytest tests/stages/test_stage0_quality.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/__init__.py
```

```python
# pipeline/stages/stage0_quality.py
import cv2
from pipeline.types import QualityCheckResult

BLUR_THRESHOLD = 100.0
DARK_THRESHOLD = 50.0
MIN_RESOLUTION = 800


def run(image_path: str) -> QualityCheckResult:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"cannot read image: {image_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if min(h, w) < MIN_RESOLUTION:
        return QualityCheckResult(status="retake", reason="low_resolution")
    if gray.mean() < DARK_THRESHOLD:
        return QualityCheckResult(status="retake", reason="too_dark")
    if cv2.Laplacian(gray, cv2.CV_64F).var() < BLUR_THRESHOLD:
        return QualityCheckResult(status="retake", reason="blurry")
    return QualityCheckResult(status="ok")
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage0_quality.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
mkdir -p tests/stages && touch tests/stages/__init__.py
git add pipeline/stages/__init__.py pipeline/stages/stage0_quality.py tests/stages/
git commit -m "feat: stage0 quality check (blur/dark/resolution)"
```

---

## Task 6: Stage 1 — detect & scope

**Files:**
- Create: `pipeline/prompts/stage1_detect_v1.txt`, `pipeline/stages/stage1_detect.py`
- Test: `tests/stages/test_stage1_detect.py`

**Interfaces:**
- Consumes: `VisionProvider` (Task 4), `DetectedItem` (Task 2)
- Produces: `run(image_path: str, provider: VisionProvider) -> list[DetectedItem]` — returns only `included=True` items.

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage1_detect.py
import pytest
from pipeline.stages.stage1_detect import run
from pipeline.types import DetectedItem, BBox


class FakeProvider:
    def __init__(self, items):
        self.items = items
    async def detect_items(self, image_path):
        return self.items


@pytest.mark.asyncio
async def test_filters_excluded_items():
    items = [
        DetectedItem(box=BBox(x=0, y=0, width=1, height=1), category="t-shirt", included=True),
        DetectedItem(box=BBox(x=1, y=1, width=1, height=1), category="sandal",
                     included=False, exclusion_reason="worn on feet"),
    ]
    result = await run("photo.jpg", FakeProvider(items))
    assert len(result) == 1
    assert result[0].category == "t-shirt"

@pytest.mark.asyncio
async def test_zero_items_returns_empty_list():
    result = await run("photo.jpg", FakeProvider([]))
    assert result == []
```

Run: `pytest tests/stages/test_stage1_detect.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```
# pipeline/prompts/stage1_detect_v1.txt
You are analyzing a photo of clothing items laid on a bed or floor for a digital wardrobe app.

Return every candidate clothing item visible in the photo as a JSON list. For each item:
- box: pixel bounding box {x, y, width, height}
- category: one short word (t-shirt, shorts, dress, sandal, jacket, etc.)
- included: true only if the item is laid on the capture surface (bed/floor), fully in frame, and is clothing (not an accessory)
- exclusion_reason: if included is false, state why (e.g. "worn on feet", "accessory", "cut off by frame edge", "not clothing")

Exclude: items being worn by a person, accessories (sunglasses, jewelry), non-clothing objects, items cut off by the frame edge.
```

```python
# pipeline/stages/stage1_detect.py
from pipeline.types import DetectedItem
from pipeline.providers.base import VisionProvider


async def run(image_path: str, provider: VisionProvider) -> list[DetectedItem]:
    items = await provider.detect_items(image_path)
    return [item for item in items if item.included]
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage1_detect.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
mkdir -p pipeline/prompts
git add pipeline/prompts/stage1_detect_v1.txt pipeline/stages/stage1_detect.py tests/stages/test_stage1_detect.py
git commit -m "feat: stage1 detect & scope filtering"
```

---

## Task 7: Gemini provider — detect, facts, generate

**Files:**
- Create: `pipeline/providers/gemini.py`
- Create: `pipeline/prompts/stage3_facts_v1.txt`, `pipeline/prompts/stage4_generate_v1.txt`
- Test: `tests/providers/test_gemini.py`

**Interfaces:**
- Consumes: `VisionProvider`, `ImageGenProvider` (Task 4); `require_env` (Task 1); `DetectedItem`, `ItemFacts`, `FactField` (Task 2)
- Produces: `GeminiProvider` class implementing `detect_items`, `extract_facts`, `generate`. `judge` raises `NotImplementedError` (judge is Claude's job per spec — different model than generator).

- [ ] **Step 1: Write failing test**

Mock the SDK client so the test runs without a real key/network:

```python
# tests/providers/test_gemini.py
import json
import pytest
from unittest.mock import MagicMock, patch
from pipeline.types import DetectedItem, BBox


@pytest.mark.asyncio
async def test_detect_items_parses_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from pipeline.providers.gemini import GeminiProvider

    fake_response = MagicMock()
    fake_response.text = json.dumps([
        {"box": {"x": 0, "y": 0, "width": 10, "height": 10},
         "category": "t-shirt", "included": True, "exclusion_reason": None}
    ])

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        instance = MockClient.return_value
        instance.models.generate_content.return_value = fake_response
        provider = GeminiProvider()
        provider._write_tmp_bytes = lambda path: b"fake-bytes"
        items = await provider.detect_items("photo.jpg")

    assert len(items) == 1
    assert items[0].category == "t-shirt"

@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from pipeline.providers.gemini import GeminiProvider
    with pytest.raises(RuntimeError, match="missing env var: GEMINI_API_KEY"):
        GeminiProvider()
```

Run: `pytest tests/providers/test_gemini.py -v` → Expected: FAIL

- [ ] **Step 2: Write prompt files**

```
# pipeline/prompts/stage3_facts_v1.txt
Describe this single clothing item crop using ONLY the closed vocabulary below.
For every field, output: value, confidence (0-1), and basis ("observed" if directly
seen, "inferred" if guessed from partial visibility).

Fields:
- category: one word (t-shirt, shorts, dress, jacket, sandal, etc.)
- colors: list of color names from {black, white, gray, navy, blue, red, pink,
  dusty pink, mint, green, yellow, orange, purple, brown, beige}
- pattern: one of {solid, striped, floral, graphic, plaid, polka-dot}
- visible_text: any printed/embroidered text, read verbatim character by character;
  "" if none visible
- trims: short description of collar/cuff/hem trim details, or "not visible"
- visible_parts: list of parts you can see (front, back, collar, left sleeve, right sleeve, hem)
- occluded_parts: list of parts you cannot see

Do not guess colors or categories outside the closed vocabulary above.
```

```
# pipeline/prompts/stage4_generate_v1.txt
Generate this exact clothing item laid flat, fully visible, on a pure white background,
as if photographed for a catalog.

Binding facts you MUST NOT change in visible regions:
{facts_block}

Only the occluded parts listed above may be completed/inferred. Every visible detail
(colors, text, trims, pattern) must match the input crop exactly — no added trim,
no changed text, no altered colors.
{violations_block}
```

- [ ] **Step 3: Implement provider**

```python
# pipeline/providers/gemini.py
import json
import time
from google import genai
from pipeline.config import require_env
from pipeline.types import DetectedItem, ItemFacts, FactField
from pipeline.run_log import RunLogger

MODEL_VISION = "gemini-2.5-flash"
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

    async def detect_items(self, image_path: str) -> list[DetectedItem]:
        start = time.monotonic()
        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            prompt = _read_prompt("stage1_detect_v1.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, prompt],
            )
            raw = json.loads(response.text)
            items = [DetectedItem.model_validate(i) for i in raw]
            self._log("stage1_detect", "v1", start, "ok")
            return items
        except Exception as e:
            self._log("stage1_detect", "v1", start, "error", str(e))
            raise

    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            prompt = _read_prompt("stage3_facts_v1.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": crop_bytes}}, prompt],
            )
            raw = json.loads(response.text)
            facts = ItemFacts.model_validate(raw)
            self._log("stage3_facts", "v1", start, "ok")
            return facts
        except Exception as e:
            self._log("stage3_facts", "v1", start, "error", str(e))
            raise

    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]:
        raise NotImplementedError("judge is implemented by ClaudeProvider (must differ from generator)")

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

Adjust the mocked test's `_write_tmp_bytes` monkeypatch — simplify by instead patching `open` via `tmp_path` with a real small file:

- [ ] **Step 4: Fix test to use a real temp file instead of monkeypatching internals**

```python
# tests/providers/test_gemini.py (replace the detect test body)
@pytest.mark.asyncio
async def test_detect_items_parses_response(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")  # minimal jpeg-ish bytes, never decoded

    from pipeline.providers.gemini import GeminiProvider

    fake_response = MagicMock()
    fake_response.text = json.dumps([
        {"box": {"x": 0, "y": 0, "width": 10, "height": 10},
         "category": "t-shirt", "included": True, "exclusion_reason": None}
    ])

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        instance = MockClient.return_value
        instance.models.generate_content.return_value = fake_response
        provider = GeminiProvider()
        items = await provider.detect_items(str(img_path))

    assert len(items) == 1 and items[0].category == "t-shirt"
```

- [ ] **Step 5: Run test, verify pass**

Run: `pytest tests/providers/test_gemini.py -v` → Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add pipeline/providers/gemini.py pipeline/prompts/stage3_facts_v1.txt pipeline/prompts/stage4_generate_v1.txt tests/providers/test_gemini.py
git commit -m "feat: Gemini provider for detect/facts/generate"
```

---

## Task 8: Stage 2 — segment

**Files:**
- Create: `pipeline/stages/stage2_segment.py`
- Test: `tests/stages/test_stage2_segment.py`

**Interfaces:**
- Consumes: `SegmentProvider` (Task 4), `DetectedItem`, `SegmentResult` (Task 2)
- Produces: `run(image_path: str, item: DetectedItem, provider: SegmentProvider) -> SegmentResult`

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage2_segment.py
import pytest
from pipeline.stages.stage2_segment import run
from pipeline.types import DetectedItem, BBox, SegmentResult


class FakeSegmentProvider:
    async def segment(self, image_path, box):
        return SegmentResult(mask_path="mask.png", crop_path="crop.png",
                              visible_fraction=0.8, occluded_by=[])


@pytest.mark.asyncio
async def test_segment_delegates_to_provider():
    item = DetectedItem(box=BBox(x=0, y=0, width=5, height=5), category="shirt", included=True)
    result = await run("photo.jpg", item, FakeSegmentProvider())
    assert result.visible_fraction == 0.8
    assert result.crop_path == "crop.png"
```

Run: `pytest tests/stages/test_stage2_segment.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/stage2_segment.py
from pipeline.types import DetectedItem, SegmentResult
from pipeline.providers.base import SegmentProvider


async def run(image_path: str, item: DetectedItem, provider: SegmentProvider) -> SegmentResult:
    return await provider.segment(image_path, item.box)
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage2_segment.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/stages/stage2_segment.py tests/stages/test_stage2_segment.py
git commit -m "feat: stage2 segment wrapper"
```

---

## Task 9: Replicate SAM provider

**Files:**
- Create: `pipeline/providers/replicate_sam.py`
- Test: `tests/providers/test_replicate_sam.py`

**Interfaces:**
- Consumes: `SegmentProvider` (Task 4), `require_env` (Task 1), `BBox`, `SegmentResult` (Task 2)
- Produces: `ReplicateSamProvider` implementing `segment(image_path, box) -> SegmentResult`. Computes `visible_fraction` as mask pixel area / bbox area (computed, not model-guessed — per spec).

- [ ] **Step 1: Write failing test**

```python
# tests/providers/test_replicate_sam.py
import numpy as np
import pytest
from unittest.mock import patch, MagicMock
from pipeline.types import BBox


@pytest.mark.asyncio
async def test_segment_computes_visible_fraction(monkeypatch, tmp_path):
    monkeypatch.setenv("REPLICATE_API_TOKEN", "fake-token")
    from pipeline.providers.replicate_sam import ReplicateSamProvider

    # fake mask: half the bbox area is foreground (255), half background (0)
    mask_path = tmp_path / "mask.png"
    import cv2
    mask = np.zeros((10, 10), dtype=np.uint8)
    mask[:5, :] = 255
    cv2.imwrite(str(mask_path), mask)

    img_path = tmp_path / "photo.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")

    with patch("pipeline.providers.replicate_sam.replicate.run") as mock_run:
        mock_run.return_value = [str(mask_path)]
        provider = ReplicateSamProvider()
        result = await provider.segment(str(img_path), BBox(x=0, y=0, width=10, height=10))

    assert 0.4 < result.visible_fraction < 0.6
    assert result.mask_path == str(mask_path)

@pytest.mark.asyncio
async def test_missing_token_raises(monkeypatch):
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    from pipeline.providers.replicate_sam import ReplicateSamProvider
    with pytest.raises(RuntimeError, match="missing env var: REPLICATE_API_TOKEN"):
        ReplicateSamProvider()
```

Run: `pytest tests/providers/test_replicate_sam.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/providers/replicate_sam.py
import time
import cv2
import numpy as np
import replicate
from pipeline.config import require_env
from pipeline.types import BBox, SegmentResult
from pipeline.run_log import RunLogger

MODEL = "yyyyyyxianzhi/segment-anything-2"  # placeholder model slug — replace with
                                              # the current SAM2 slug from replicate.com
                                              # when wiring real keys


class ReplicateSamProvider:
    def __init__(self, logger: RunLogger | None = None):
        self.token = require_env("REPLICATE_API_TOKEN")
        self.logger = logger

    async def segment(self, image_path: str, box: BBox) -> SegmentResult:
        start = time.monotonic()
        try:
            output = replicate.run(MODEL, input={
                "image": open(image_path, "rb"),
                "box": [box.x, box.y, box.x + box.width, box.y + box.height],
            })
            mask_path = output[0] if isinstance(output, list) else output
            mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
            expected_area = box.width * box.height
            mask_area = float(np.count_nonzero(mask))
            visible_fraction = min(mask_area / expected_area, 1.0) if expected_area else 0.0
            crop_path = str(mask_path).replace("mask", "crop")
            result = SegmentResult(mask_path=str(mask_path), crop_path=crop_path,
                                    visible_fraction=visible_fraction, occluded_by=[])
            if self.logger:
                self.logger.log(stage="stage2_segment", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return result
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage2_segment", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise
```

Note: `MODEL` slug is a placeholder — look up the current SAM2 model slug on replicate.com when real keys are added (replicate slugs/versions change; CLAUDE.md flags every model as a swappable candidate to verify before wiring in).

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/providers/test_replicate_sam.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/providers/replicate_sam.py tests/providers/test_replicate_sam.py
git commit -m "feat: Replicate SAM segment provider"
```

---

## Task 10: Stage 3 — extract facts

**Files:**
- Create: `pipeline/stages/stage3_facts.py`
- Test: `tests/stages/test_stage3_facts.py`

**Interfaces:**
- Consumes: `VisionProvider` (Task 4), `ItemFacts` (Task 2)
- Produces: `run(crop_path: str, context_path: str | None, provider: VisionProvider) -> ItemFacts`

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage3_facts.py
import pytest
from pipeline.stages.stage3_facts import run
from pipeline.types import ItemFacts, FactField


class FakeProvider:
    async def extract_facts(self, crop_path, context_path):
        field = FactField(value="pink", confidence=0.9, basis="observed")
        return ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                          trims=field, visible_parts=field, occluded_parts=field)


@pytest.mark.asyncio
async def test_extract_facts_delegates_to_provider():
    result = await run("crop.png", None, FakeProvider())
    assert result.colors.value == "pink"
```

Run: `pytest tests/stages/test_stage3_facts.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/stage3_facts.py
from pipeline.types import ItemFacts
from pipeline.providers.base import VisionProvider


async def run(crop_path: str, context_path: str | None, provider: VisionProvider) -> ItemFacts:
    return await provider.extract_facts(crop_path, context_path)
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage3_facts.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/stages/stage3_facts.py tests/stages/test_stage3_facts.py
git commit -m "feat: stage3 facts extraction wrapper"
```

---

## Task 11: Claude provider — facts (alt) + judge

**Files:**
- Create: `pipeline/providers/claude.py`
- Create: `pipeline/prompts/stage5_judge_v1.txt`
- Test: `tests/providers/test_claude.py`

**Interfaces:**
- Consumes: `VisionProvider` (Task 4), `require_env` (Task 1), `ItemFacts` (Task 2)
- Produces: `ClaudeProvider` implementing `extract_facts` and `judge`. `detect_items` raises `NotImplementedError` (Claude is not used for stage1 in v0).

- [ ] **Step 1: Write failing test**

```python
# tests/providers/test_claude.py
import json
import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_judge_returns_violations(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
    crop_path = tmp_path / "crop.png"
    crop_path.write_bytes(b"\x89PNGfake")
    gen_path = tmp_path / "generated.png"
    gen_path.write_bytes(b"\x89PNGfake")

    from pipeline.providers.claude import ClaudeProvider
    from pipeline.types import ItemFacts, FactField

    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                       trims=field, visible_parts=field, occluded_parts=field)

    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps(["print text changed from PINK to PINKK"]))]

    with patch("pipeline.providers.claude.Anthropic") as MockClient:
        instance = MockClient.return_value
        instance.messages.create.return_value = fake_message
        provider = ClaudeProvider()
        violations = await provider.judge(str(crop_path), str(gen_path), facts)

    assert violations == ["print text changed from PINK to PINKK"]

@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from pipeline.providers.claude import ClaudeProvider
    with pytest.raises(RuntimeError, match="missing env var: ANTHROPIC_API_KEY"):
        ClaudeProvider()
```

Run: `pytest tests/providers/test_claude.py -v` → Expected: FAIL

- [ ] **Step 2: Write judge prompt**

```
# pipeline/prompts/stage5_judge_v1.txt
You are a QA judge comparing an original clothing item crop (image 1) against a generated
catalog image of the same item (image 2). You are given the facts extracted from the crop.

Facts (binding, must be preserved in visible regions):
{facts_block}

Check the generated image against image 1 ONLY in regions that were visible in the crop
(see visible_parts in the facts). Occluded parts were allowed to be completed and should
NOT be flagged.

Return a JSON list of violation strings — any detail that changed in a visible region
(wrong color, changed/missing text, added trim, different pattern, etc). Return an empty
list if there are no violations.
```

- [ ] **Step 3: Implement**

```python
# pipeline/providers/claude.py
import json
import time
import base64
from anthropic import Anthropic
from pipeline.config import require_env
from pipeline.types import ItemFacts
from pipeline.run_log import RunLogger

MODEL = "claude-sonnet-4-6"
PROMPTS_DIR = __file__.rsplit("/providers/", 1)[0] + "/prompts"


def _read_prompt(name: str) -> str:
    with open(f"{PROMPTS_DIR}/{name}") as f:
        return f.read()


def _b64_image(path: str) -> str:
    with open(path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


class ClaudeProvider:
    def __init__(self, logger: RunLogger | None = None):
        api_key = require_env("ANTHROPIC_API_KEY")
        self.client = Anthropic(api_key=api_key)
        self.logger = logger

    async def detect_items(self, image_path: str):
        raise NotImplementedError("ClaudeProvider is not used for stage1 detect in v0")

    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts:
        start = time.monotonic()
        try:
            prompt = _read_prompt("stage3_facts_v1.txt")
            message = self.client.messages.create(
                model=MODEL, max_tokens=1024,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                  "data": _b64_image(crop_path)}},
                    {"type": "text", "text": prompt + "\n\nRespond with JSON only."},
                ]}],
            )
            raw = json.loads(message.content[0].text)
            facts = ItemFacts.model_validate(raw)
            if self.logger:
                self.logger.log(stage="stage3_facts", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return facts
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage3_facts", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise

    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]:
        start = time.monotonic()
        try:
            template = _read_prompt("stage5_judge_v1.txt")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2))
            message = self.client.messages.create(
                model=MODEL, max_tokens=1024,
                messages=[{"role": "user", "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                  "data": _b64_image(crop_path)}},
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                  "data": _b64_image(generated_path)}},
                    {"type": "text", "text": prompt + "\n\nRespond with JSON only."},
                ]}],
            )
            violations = json.loads(message.content[0].text)
            if self.logger:
                self.logger.log(stage="stage5_judge", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return violations
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage5_judge", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise

    async def generate(self, crop_path: str, facts: ItemFacts, violations):
        raise NotImplementedError("ClaudeProvider does not implement image generation")
```

- [ ] **Step 4: Run test, verify pass**

Run: `pytest tests/providers/test_claude.py -v` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pipeline/providers/claude.py pipeline/prompts/stage5_judge_v1.txt tests/providers/test_claude.py
git commit -m "feat: Claude provider for facts (alt) and verification judge"
```

---

## Task 12: Stage 4 — generate (single attempt)

**Files:**
- Create: `pipeline/stages/stage4_generate.py`
- Test: `tests/stages/test_stage4_generate.py`

**Interfaces:**
- Consumes: `ImageGenProvider` (Task 4), `ItemFacts` (Task 2)
- Produces: `run(crop_path: str, facts: ItemFacts, violations: list[str] | None, provider: ImageGenProvider) -> str` (path to generated image). Retry looping lives in the orchestrator (Task 15), not here — this stage is a single attempt, kept pure per Global Constraints.

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage4_generate.py
import pytest
from pipeline.stages.stage4_generate import run
from pipeline.types import ItemFacts, FactField


class FakeImageGen:
    async def generate(self, crop_path, facts, violations):
        return "generated.png"


@pytest.mark.asyncio
async def test_generate_delegates_to_provider():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                       trims=field, visible_parts=field, occluded_parts=field)
    path = await run("crop.png", facts, None, FakeImageGen())
    assert path == "generated.png"
```

Run: `pytest tests/stages/test_stage4_generate.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/stage4_generate.py
from pipeline.types import ItemFacts
from pipeline.providers.base import ImageGenProvider


async def run(crop_path: str, facts: ItemFacts, violations: list[str] | None,
               provider: ImageGenProvider) -> str:
    return await provider.generate(crop_path, facts, violations)
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage4_generate.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/stages/stage4_generate.py tests/stages/test_stage4_generate.py
git commit -m "feat: stage4 generate wrapper (single attempt)"
```

---

## Task 13: Stage 5 — verify

**Files:**
- Create: `pipeline/stages/stage5_verify.py`
- Test: `tests/stages/test_stage5_verify.py`

**Interfaces:**
- Consumes: `VisionProvider.judge` (Task 4/11), `ItemFacts`, `VerificationResult` (Task 2)
- Produces: `run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int, provider: VisionProvider) -> VerificationResult`

v0 scope: color-distance check + OCR text check (both cheap/code-only, per spec's verify table) + LLM judge. Embedding similarity (DINOv2/CLIP) is deferred — it needs a separate local model download and is out of scope for this pass; documented here as a deliberate cut, not a placeholder.

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage5_verify.py
import numpy as np
import cv2
import pytest
from pipeline.stages.stage5_verify import run
from pipeline.types import ItemFacts, FactField


def _solid_color_image(path, bgr):
    arr = np.full((50, 50, 3), bgr, dtype=np.uint8)
    cv2.imwrite(path, arr)


class FakeProviderNoViolations:
    async def judge(self, crop_path, generated_path, facts):
        return []


class FakeProviderWithViolations:
    async def judge(self, crop_path, generated_path, facts):
        return ["trim added to sleeve"]


def _facts(text=""):
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value=text, confidence=0.9, basis="observed")
    return ItemFacts(category=field, colors=field, pattern=field, visible_text=text_field,
                      trims=field, visible_parts=field, occluded_parts=field)


@pytest.mark.asyncio
async def test_pass_when_colors_match_and_no_judge_violations(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))  # pink-ish BGR
    _solid_color_image(gen_path, (203, 192, 255))
    result = await run(crop_path, gen_path, _facts(), 1, FakeProviderNoViolations())
    assert result.status == "pass"
    assert result.violations == []

@pytest.mark.asyncio
async def test_fail_on_color_shift(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (0, 0, 255))     # red
    _solid_color_image(gen_path, (255, 0, 0))       # blue — big Lab distance
    result = await run(crop_path, gen_path, _facts(), 1, FakeProviderNoViolations())
    assert result.status == "fail"
    assert any("color" in v.lower() for v in result.violations)

@pytest.mark.asyncio
async def test_fail_on_judge_violation(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))
    result = await run(crop_path, gen_path, _facts(), 1, FakeProviderWithViolations())
    assert result.status == "fail"
    assert "trim added to sleeve" in result.violations
```

Run: `pytest tests/stages/test_stage5_verify.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/stage5_verify.py
import cv2
import numpy as np
import pytesseract
from skimage.color import rgb2lab
from pipeline.types import ItemFacts, VerificationResult
from pipeline.providers.base import VisionProvider

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


async def run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int,
               provider: VisionProvider) -> VerificationResult:
    violations: list[str] = []

    distance = _color_distance(crop_path, generated_path)
    if distance > COLOR_DISTANCE_THRESHOLD:
        violations.append(f"color shift detected (Lab distance {distance:.1f})")

    expected_text = facts.visible_text.value
    if expected_text:
        found_text = _ocr_text(generated_path)
        if expected_text not in found_text:
            violations.append(f"expected text '{expected_text}' not found in generated image")

    judge_violations = await provider.judge(crop_path, generated_path, facts)
    violations.extend(judge_violations)

    status = "fail" if violations else "pass"
    return VerificationResult(status=status, violations=violations, attempt=attempt)
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage5_verify.py -v` → Expected: PASS (note: requires `tesseract` binary installed — `brew install tesseract` on macOS)

- [ ] **Step 4: Commit**

```bash
git add pipeline/stages/stage5_verify.py tests/stages/test_stage5_verify.py
git commit -m "feat: stage5 verify (color distance, OCR, judge)"
```

---

## Task 14: Stage 6 — score & tier

**Files:**
- Create: `pipeline/stages/stage6_score.py`
- Test: `tests/stages/test_stage6_score.py`

**Interfaces:**
- Consumes: `VerificationResult`, `ItemResult` (Task 2)
- Produces: `run(verification: VerificationResult | None, visible_fraction: float, max_attempts: int) -> ItemResult`. `verification=None` means stage4 never produced a usable image.

- [ ] **Step 1: Write failing test**

```python
# tests/stages/test_stage6_score.py
from pipeline.stages.stage6_score import run
from pipeline.types import VerificationResult

def test_high_tier_when_verified_and_high_visible_fraction():
    v = VerificationResult(status="pass", violations=[], attempt=1)
    result = run(v, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "high"

def test_medium_tier_when_low_visible_fraction_but_verified():
    v = VerificationResult(status="pass", violations=[], attempt=1)
    result = run(v, visible_fraction=0.4, max_attempts=2)
    assert result.tier == "medium"
    assert "overlapping" in result.reason.lower() or "visible" in result.reason.lower()

def test_low_tier_when_verification_failed_after_all_retries():
    v = VerificationResult(status="fail", violations=["color shift"], attempt=3)
    result = run(v, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "low"
    assert result.retake_instruction is not None

def test_low_tier_when_no_verification_at_all():
    result = run(None, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "low"
    assert result.retake_instruction is not None
```

Run: `pytest tests/stages/test_stage6_score.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/stages/stage6_score.py
from pipeline.types import VerificationResult, ItemResult

VISIBLE_FRACTION_MEDIUM_THRESHOLD = 0.6


def run(verification: VerificationResult | None, visible_fraction: float,
        max_attempts: int) -> ItemResult:
    if verification is None or (verification.status == "fail" and verification.attempt >= max_attempts + 1):
        return ItemResult(
            tier="low",
            reason="verification failed after all retries" if verification else "generation never succeeded",
            retake_instruction="Shoot it alone in better light, spread out flat",
            visible_fraction=visible_fraction,
        )
    if visible_fraction < VISIBLE_FRACTION_MEDIUM_THRESHOLD:
        return ItemResult(
            tier="medium",
            reason=f"low visible fraction ({visible_fraction:.2f}), likely overlapping another item",
            retake_instruction=None,
            visible_fraction=visible_fraction,
        )
    return ItemResult(tier="high", reason="verification passed, fully visible",
                       retake_instruction=None, visible_fraction=visible_fraction)
```

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/stages/test_stage6_score.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/stages/stage6_score.py tests/stages/test_stage6_score.py
git commit -m "feat: stage6 score & tier rules"
```

---

## Task 15: Orchestrator

**Files:**
- Create: `pipeline/orchestrator.py`
- Test: `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: all stage `run()` functions (Tasks 5,6,8,10,12,13,14), all Protocols (Task 4), `RunLogger` (Task 3)
- Produces:
  - `Providers` dataclass: `vision: VisionProvider`, `segment: SegmentProvider`, `imagegen: ImageGenProvider`, `judge: VisionProvider` (separate from `vision`, per spec — judge must differ from generator)
  - `async def run_photo(image_path: str, output_dir: str, providers: Providers, logger: RunLogger, max_attempts: int = 2) -> dict` — returns `{"quality": QualityCheckResult, "items": list[ItemOutcome], "failed": list[str]}`
  - Writes per-item files under `output_dir/item_<n>/{crop.png,generated.png,facts.json,verification.json,result.json}`

- [ ] **Step 1: Write failing test**

```python
# tests/test_orchestrator.py
import pytest
import numpy as np
import cv2
from dataclasses import dataclass
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.types import (
    DetectedItem, BBox, SegmentResult, ItemFacts, FactField, QualityCheckResult,
)


def _write_ok_photo(path):
    arr = (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8)
    cv2.imwrite(path, arr)


def _facts():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    return ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                      trims=field, visible_parts=field, occluded_parts=field)


class FakeVision:
    def __init__(self, items):
        self.items = items
    async def detect_items(self, image_path):
        return self.items
    async def extract_facts(self, crop_path, context_path):
        return _facts()
    async def judge(self, crop_path, generated_path, facts):
        return []


class FakeSegment:
    async def segment(self, image_path, box):
        crop_path = image_path.replace(".png", "_crop.png")
        _write_ok_photo(crop_path)
        return SegmentResult(mask_path="mask.png", crop_path=crop_path,
                              visible_fraction=0.9, occluded_by=[])


class FakeImageGen:
    async def generate(self, crop_path, facts, violations):
        gen_path = crop_path.replace("_crop.png", "_generated.png")
        _write_ok_photo(gen_path)
        return gen_path


@pytest.mark.asyncio
async def test_run_photo_with_one_item_produces_high_tier(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = DetectedItem(box=BBox(x=0, y=0, width=100, height=100), category="t-shirt", included=True)
    providers = Providers(vision=FakeVision([item]), segment=FakeSegment(),
                           imagegen=FakeImageGen(), judge=FakeVision([item]))
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
    providers = Providers(vision=FakeVision([]), segment=FakeSegment(),
                           imagegen=FakeImageGen(), judge=FakeVision([]))
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)
    assert result["items"] == []
    assert result["failed"] == []

@pytest.mark.asyncio
async def test_run_photo_retake_quality_stops_early(tmp_path):
    photo_path = str(tmp_path / "dark.png")
    arr = np.full((1000, 1000, 3), 5, dtype=np.uint8)
    cv2.imwrite(photo_path, arr)
    providers = Providers(vision=FakeVision([]), segment=FakeSegment(),
                           imagegen=FakeImageGen(), judge=FakeVision([]))
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)
    assert result["quality"].status == "retake"
    assert result["items"] == []

@pytest.mark.asyncio
async def test_generate_failure_all_retries_tiers_low(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = DetectedItem(box=BBox(x=0, y=0, width=100, height=100), category="t-shirt", included=True)

    class FailingImageGen:
        async def generate(self, crop_path, facts, violations):
            raise RuntimeError("image gen API error")

    providers = Providers(vision=FakeVision([item]), segment=FakeSegment(),
                           imagegen=FailingImageGen(), judge=FakeVision([item]))
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)

    assert len(result["items"]) == 1
    assert result["items"][0]["result"].tier == "low"
```

Run: `pytest tests/test_orchestrator.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# pipeline/orchestrator.py
import asyncio
import os
import shutil
from dataclasses import dataclass
from pipeline.providers.base import VisionProvider, SegmentProvider, ImageGenProvider
from pipeline.run_log import RunLogger
from pipeline.stages import (
    stage0_quality, stage1_detect, stage2_segment, stage3_facts,
    stage4_generate, stage5_verify, stage6_score,
)


@dataclass
class Providers:
    vision: VisionProvider
    segment: SegmentProvider
    imagegen: ImageGenProvider
    judge: VisionProvider  # must be a different model/provider than `vision`'s generate path


async def _run_item(image_path: str, item, item_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int):
    os.makedirs(item_dir, exist_ok=True)
    segment_result = await stage2_segment.run(image_path, item, providers.segment)
    crop_dest = os.path.join(item_dir, "crop.png")
    shutil.copy(segment_result.crop_path, crop_dest)

    facts = await stage3_facts.run(crop_dest, image_path, providers.vision)
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
        verification = await stage5_verify.run(crop_dest, generated_path, facts, attempt, providers.judge)
        if verification.status == "pass":
            break
        violations = verification.violations

    if generated_path and os.path.exists(generated_path):
        shutil.copy(generated_path, os.path.join(item_dir, "generated.png"))
    if verification:
        with open(os.path.join(item_dir, "verification.json"), "w") as f:
            f.write(verification.model_dump_json(indent=2))

    result = stage6_score.run(verification, segment_result.visible_fraction, max_attempts)
    with open(os.path.join(item_dir, "result.json"), "w") as f:
        f.write(result.model_dump_json(indent=2))

    return {"facts": facts, "verification": verification, "result": result}


async def run_photo(image_path: str, output_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int = 2) -> dict:
    quality = stage0_quality.run(image_path)
    if quality.status == "retake":
        return {"quality": quality, "items": [], "failed": []}

    included_items = await stage1_detect.run(image_path, providers.vision)
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

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/test_orchestrator.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pipeline/orchestrator.py tests/test_orchestrator.py
git commit -m "feat: orchestrator — wires stages, forks per-item, retry loop"
```

---

## Task 16: CLI entrypoint

**Files:**
- Create: `cli.py`
- Test: `tests/test_cli.py`

**Interfaces:**
- Consumes: `orchestrator.run_photo`, `Providers` (Task 15)
- Produces: `main(photos_dir: str, output_root: str = "runs") -> str` (returns run_id) and a `if __name__ == "__main__":` CLI wrapper using `argparse`. Fails fast via `require_env` if any key is missing, before processing any photo.

- [ ] **Step 1: Write failing test**

```python
# tests/test_cli.py
import pytest
from unittest.mock import patch, AsyncMock
from cli import main

@pytest.mark.asyncio
async def test_main_fails_fast_on_missing_key(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    with pytest.raises(RuntimeError, match="missing env var"):
        main(str(photos_dir), str(tmp_path / "runs"))

@pytest.mark.asyncio
async def test_main_processes_each_photo(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setenv("REPLICATE_API_TOKEN", "k")
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
```

Run: `pytest tests/test_cli.py -v` → Expected: FAIL

- [ ] **Step 2: Implement**

```python
# cli.py
import argparse
import asyncio
import os
import time
from pipeline.config import require_env
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.providers.gemini import GeminiProvider
from pipeline.providers.replicate_sam import ReplicateSamProvider
from pipeline.providers.claude import ClaudeProvider


def build_providers(logger: RunLogger) -> Providers:
    require_env("GEMINI_API_KEY")
    require_env("ANTHROPIC_API_KEY")
    require_env("REPLICATE_API_TOKEN")
    gemini = GeminiProvider(logger)
    claude = ClaudeProvider(logger)
    segment = ReplicateSamProvider(logger)
    return Providers(vision=gemini, segment=segment, imagegen=gemini, judge=claude)


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
            await run_photo(photo_path, output_dir, providers, logger)

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

- [ ] **Step 3: Run test, verify pass**

Run: `pytest tests/test_cli.py -v` → Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add cli.py tests/test_cli.py
git commit -m "feat: CLI entrypoint for running the pipeline over a photo folder"
```

---

## Task 17: Streamlit UI

**Files:**
- Create: `ui/__init__.py`, `ui/app.py`

**Interfaces:**
- Consumes: `orchestrator.run_photo`, `Providers`, `cli.build_providers` (Task 15/16)
- Produces: a runnable `streamlit run ui/app.py` single-screen app. No automated test (UI code) — verified manually in Step 3.

- [ ] **Step 1: Implement**

```python
# ui/__init__.py
```

```python
# ui/app.py
import asyncio
import os
import tempfile
import time
import streamlit as st
from pipeline.run_log import RunLogger
from cli import build_providers
from pipeline.orchestrator import run_photo

st.set_page_config(page_title="Wardrobe Pipeline Test Harness", layout="wide")
st.title("Wardrobe Pipeline — Test Harness")

uploaded_files = st.file_uploader("Upload photo(s)", type=["jpg", "jpeg", "png"],
                                   accept_multiple_files=True)

if st.button("Run pipeline", disabled=not uploaded_files):
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join("runs", run_id)
    os.makedirs(run_dir, exist_ok=True)
    logger = RunLogger(os.path.join(run_dir, "run_log.jsonl"))

    try:
        providers = build_providers(logger)
    except RuntimeError as e:
        st.error(f"Setup error: {e}")
        st.stop()

    for uploaded in uploaded_files:
        st.header(uploaded.name)
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(uploaded.name)[1], delete=False) as tmp:
            tmp.write(uploaded.getvalue())
            photo_path = tmp.name

        photo_name = os.path.splitext(uploaded.name)[0]
        output_dir = os.path.join(run_dir, photo_name)
        result = asyncio.run(run_photo(photo_path, output_dir, providers, logger))

        st.write(f"Quality: **{result['quality'].status}**"
                 + (f" ({result['quality'].reason})" if result['quality'].reason else ""))

        if not result["items"]:
            st.info("No items detected (or excluded by scope rules).")

        for i, outcome in enumerate(result["items"]):
            with st.expander(f"Item {i} — tier: {outcome['result'].tier}", expanded=True):
                cols = st.columns(2)
                item_dir = os.path.join(output_dir, f"item_{i}")
                crop_path = os.path.join(item_dir, "crop.png")
                gen_path = os.path.join(item_dir, "generated.png")
                if os.path.exists(crop_path):
                    cols[0].image(crop_path, caption="Crop (source of truth)")
                if os.path.exists(gen_path):
                    cols[1].image(gen_path, caption="Generated")
                st.json(outcome["facts"].model_dump())
                if outcome["verification"]:
                    st.json(outcome["verification"].model_dump())
                st.write(f"Reason: {outcome['result'].reason}")
                if outcome["result"].retake_instruction:
                    st.warning(f"Retake: {outcome['result'].retake_instruction}")

        if result["failed"]:
            st.error(f"Failed items: {', '.join(result['failed'])}")

    st.divider()
    st.subheader("Run log")
    entries = logger.read_all()
    st.dataframe([e.model_dump() for e in entries])
```

- [ ] **Step 2: Manual smoke test**

Run: `streamlit run ui/app.py` → upload a test photo → click "Run pipeline" → confirm it either shows results or a clear "Setup error: missing env var" message if `.env` is still empty.

- [ ] **Step 3: Commit**

```bash
git add ui/__init__.py ui/app.py
git commit -m "feat: Streamlit single-screen pipeline test harness"
```
