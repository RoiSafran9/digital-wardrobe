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
    async def generate(self, crop_path, facts, violations, complete_edges=False):
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
        async def generate(self, crop_path, facts, violations, complete_edges=False):
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
    async def generate(self, crop_path, facts, violations, complete_edges=False):
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
        self.calls = []

    async def generate(self, crop_path, facts, violations, complete_edges=False):
        self.calls.append(complete_edges)
        gen_path = crop_path.replace("crop.png", "generated.png")
        img = np.full((300, 300, 3), 255, dtype=np.uint8)
        img[80:220, 60:240] = (90, 60, 40)
        cv2.imwrite(gen_path, img)
        return gen_path


@pytest.mark.asyncio
async def test_item_touching_the_frame_is_completed_not_rejected(tmp_path):
    import os
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    item = _item()
    item.cut_off_by_frame = True
    imagegen = CountingImageGen()
    providers = Providers(vision=FakeVision([item]), imagegen=imagegen)
    logger = RunLogger(str(tmp_path / "run_log.jsonl"))

    result = await run_photo(photo_path, str(tmp_path / "out"), providers, logger)

    assert imagegen.calls and all(imagegen.calls)          # generated, asked to complete the edges
    assert os.path.exists(tmp_path / "out" / "item_0" / "generated.png")


def test_scoring_marks_frame_touching_items_ok_with_a_soft_tip():
    from pipeline.stages import stage6_score
    from pipeline.types import VerificationResult
    passed = VerificationResult(status="pass", violations=[], attempt=1)
    result = stage6_score.run(passed, 1.0, 2, cut_off=True)
    assert result.tier == "medium"
    assert "step back" in result.retake_instruction


@pytest.mark.asyncio
async def test_run_photo_makes_at_most_max_items_fronts_largest_first(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    small, big, medium = _item(), _item(), _item()
    small.box = BBox(x=0, y=0, width=50, height=50)
    big.box = BBox(x=100, y=0, width=400, height=400)
    medium.box = BBox(x=600, y=0, width=200, height=200)
    small.colors = FactField(value="small", confidence=0.9, basis="observed")
    big.colors = FactField(value="big", confidence=0.9, basis="observed")
    medium.colors = FactField(value="medium", confidence=0.9, basis="observed")
    providers = Providers(vision=FakeVision([small, big, medium]), imagegen=FakeImageGen())

    result = await run_photo(photo_path, str(tmp_path / "out"), providers, RunLogger(str(tmp_path / "log.jsonl")), max_items=2)

    assert [i["facts"].colors.value for i in result["items"]] == ["big", "medium"]  # photo order kept
    assert result["over_limit"] == 1


@pytest.mark.asyncio
async def test_run_photo_without_a_cap_makes_every_piece(tmp_path):
    photo_path = str(tmp_path / "photo.png")
    _write_ok_photo(photo_path)
    providers = Providers(vision=FakeVision([_item(), _item(), _item()]), imagegen=FakeImageGen())
    result = await run_photo(photo_path, str(tmp_path / "out"), providers, RunLogger(str(tmp_path / "log.jsonl")))
    assert len(result["items"]) == 3 and result["over_limit"] == 0
