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
    text_field = FactField(value="", confidence=0.9, basis="observed")
    return ItemFacts(category=field, colors=field, pattern=field, visible_text=text_field,
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
