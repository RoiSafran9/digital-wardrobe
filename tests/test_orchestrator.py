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


class FakeImageGenOnWhite:
    async def generate(self, crop_path, facts, violations):
        gen_path = crop_path.replace("crop.png", "generated.png")
        img = np.full((300, 300, 3), 255, dtype=np.uint8)
        img[80:220, 60:240] = (90, 60, 40)
        cv2.imwrite(gen_path, img)
        return gen_path


@pytest.mark.asyncio
async def test_run_photo_writes_transparent_cutout_next_to_generated(tmp_path):
    import os
    from PIL import Image
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    providers = Providers(vision=FakeVision([_item()]), imagegen=FakeImageGenOnWhite())
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))

    await run_photo(photo_path, str(tmp_path / "out"), providers, logger)

    item_dir = tmp_path / "out" / "item_0"
    assert os.path.exists(item_dir / "generated.png")
    cut = Image.open(item_dir / "cutout.png")
    assert cut.mode == "RGBA"


class CountingImageGen:
    def __init__(self):
        self.calls = 0

    async def generate(self, crop_path, facts, violations):
        self.calls += 1
        gen_path = crop_path.replace("crop.png", "generated.png")
        _write_ok_photo(gen_path)
        return gen_path


@pytest.mark.asyncio
async def test_item_cut_off_by_frame_skips_generation_and_asks_for_retake(tmp_path):
    import os
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = _item()
    item.cut_off_by_frame = True
    imagegen = CountingImageGen()
    providers = Providers(vision=FakeVision([item]), imagegen=imagegen)
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))

    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)

    assert imagegen.calls == 0
    item_result = result["items"][0]["result"]
    assert item_result.tier == "low"
    assert "frame" in item_result.retake_instruction
    item_dir = tmp_path / "out" / "item_0"
    assert os.path.exists(item_dir / "crop.png")
    assert os.path.exists(item_dir / "result.json")
    assert not os.path.exists(item_dir / "generated.png")
