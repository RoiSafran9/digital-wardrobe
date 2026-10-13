# Digital Wardrobe — Pipeline MVP Design

## Context

Core pipeline for a digital wardrobe app: photo of clothes on a bed/floor →
one clean per-item image + structured facts + confidence tier. This spec
covers the v0 build: all 6 pipeline stages wired to real APIs (no training),
plus a 1-screen Streamlit UI to run and inspect the pipeline manually, before
any eval set exists. Full stage specs are in `CLAUDE.md` at project root;
this document covers the implementation architecture, not re-deriving the
pipeline design.

## Decisions

- **Language:** Python.
- **Eval set:** deferred. v0 is tested manually via the UI first; eval set
  (30-50 labeled photos) comes after v0 runs end-to-end.
- **API keys:** Gemini, Claude (Anthropic), Replicate (hosts SAM) — none
  provisioned yet. Code is written against all three provider interfaces;
  user adds keys to `.env` before first real run.
- **UI:** Streamlit — single screen, python-only, built-in image/JSON
  rendering, fastest to iterate on.

## Project structure

```
my_wardrobe/
├── .env                     # API keys, gitignored
├── .gitignore
├── pyproject.toml
├── CLAUDE.md                 # pipeline spec (already exists)
├── pipeline/
│   ├── __init__.py
│   ├── types.py              # pydantic models for all stage I/O
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py           # VisionProvider, SegmentProvider, ImageGenProvider interfaces
│   │   ├── gemini.py
│   │   ├── claude.py
│   │   └── replicate_sam.py
│   ├── stages/
│   │   ├── __init__.py
│   │   ├── stage0_quality.py
│   │   ├── stage1_detect.py
│   │   ├── stage2_segment.py
│   │   ├── stage3_facts.py
│   │   ├── stage4_generate.py
│   │   ├── stage5_verify.py
│   │   └── stage6_score.py
│   ├── prompts/
│   │   ├── stage1_detect_v1.txt
│   │   ├── stage3_facts_v1.txt
│   │   ├── stage4_generate_v1.txt
│   │   └── stage5_verify_v1.txt
│   ├── orchestrator.py       # run_photo(path) -> per-item results
│   └── run_log.py            # append-only jsonl logger for every model call
├── cli.py                    # `python cli.py run <photos_dir> <output_dir>`
├── ui/
│   └── app.py                # streamlit single-screen test harness
└── runs/
    └── <run_id>/
        └── <photo_name>/
            └── item_<n>/
                ├── crop.png
                ├── generated.png
                ├── facts.json
                ├── verification.json
                └── result.json
```

## Data models (`pipeline/types.py`)

Pydantic models, one per stage boundary, matching CLAUDE.md fields exactly:

- `QualityCheckResult`: `status: Literal["ok","retake"]`, `reason: str | None`
- `DetectedItem`: `box: BBox`, `category: str`, `included: bool`, `exclusion_reason: str | None`
- `SegmentResult`: `mask_path: str`, `crop_path: str`, `visible_fraction: float`, `occluded_by: list[int]`
- `ItemFacts`: fields from CLAUDE.md's facts table (`category`, `colors`, `pattern`, `visible_text`, `trims`, `visible_parts`, `occluded_parts`), each wrapped with `confidence: float` and `basis: Literal["observed","inferred"]`
- `VerificationResult`: `status: Literal["pass","fail"]`, `violations: list[str]`, `attempt: int`
- `ItemResult`: `tier: Literal["high","medium","low"]`, `reason: str`, `retake_instruction: str | None`, `visible_fraction: float`
- `RunLogEntry`: `stage: str`, `model: str`, `prompt_version: str`, `latency_ms: float`, `cost_usd: float | None`, `status: Literal["ok","error"]`, `error: str | None`

Every stage function signature: `def run(input: TypedModel, ...) -> TypedModel`.

## Provider interface (`pipeline/providers/base.py`)

Three thin abstract interfaces, one per capability actually needed:

```python
class VisionProvider(Protocol):
    async def detect_items(self, image_path: str) -> list[DetectedItem]: ...
    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts: ...
    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]: ...

class SegmentProvider(Protocol):
    async def segment(self, image_path: str, box: BBox) -> SegmentResult: ...

class ImageGenProvider(Protocol):
    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str: ...
```

`gemini.py` implements `VisionProvider` (stage 1, 3) + `ImageGenProvider` (stage 4).
`claude.py` implements `VisionProvider` for `extract_facts` (stage 3 alt) and
`judge` (stage 5 — must differ from stage 4's generator model, per CLAUDE.md).
`replicate_sam.py` implements `SegmentProvider` (stage 2).

Stage code depends only on the Protocol, never a concrete provider — swapping
stage 3's provider from Gemini to Claude is a one-line change in the
orchestrator's wiring, not a stage code change.

## Orchestration (`pipeline/orchestrator.py`)

```
run_photo(photo_path) ->
    stage0: quality check -> if "retake", stop, return early
    stage1: detect items -> list[DetectedItem] (included only)
    stage2: segment each box -> list[SegmentResult]   # sequential, cheap
    fork: for each item, asyncio.gather(
        stage3 -> stage4 (-> stage5 -> retry stage4 up to N=2 on fail) -> stage6
    )
    write per-item outputs to runs/<run_id>/<photo_name>/item_<n>/
    append every model call to run_log.jsonl via run_log.py
```

Each per-item pipeline (stage3-6) is one `asyncio` task; items run concurrently.
Retry loop: stage5 failure feeds `violations` back into stage4's next call,
up to 2 retries total, then stage6 scores as `low` regardless.

## Error handling

- Provider call failure (network/API error): caught at the provider layer,
  logged to `run_log.jsonl` with `status="error"`, propagates as an exception
  that fails that item's pipeline only — other items in the same photo
  continue. The photo-level result includes a `failed` list.
- Missing API key: fail fast at startup with a clear message naming the
  missing env var, before any photo is processed.

## UI (`ui/app.py`)

Single screen, Streamlit:
- File uploader (one or more photos)
- "Run pipeline" button → calls `orchestrator.run_photo()` per photo
- Per photo: show quality check result; if items found, one expandable section
  per item showing: crop thumbnail, generated image, facts JSON, verification
  violations (if any), tier + reason
- Bottom: run log table (stage, model, latency, cost, status) for the session

No separate business logic in the UI — it only calls the orchestrator and
renders results, so CLI and UI stay in sync by construction.

## Testing

- Each stage function is unit-testable with fixture inputs/outputs (typed
  pydantic models make this straightforward — no mocking the whole pipeline).
- Providers are mocked in stage tests; a small number of integration tests
  hit real APIs once keys exist, marked separately (e.g. `@pytest.mark.integration`)
  so unit tests run without keys/network.
- No eval-set-based testing yet (deferred per Decisions above) — manual
  verification via the UI is the v0 acceptance method.

## Out of scope for this spec

Eval set + labeling format, app/UI beyond the test harness, auth, database,
deployment. Matches CLAUDE.md's "Out of scope for now" section.
