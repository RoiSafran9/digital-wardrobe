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
async def test_raises_clear_error_on_unreadable_generated_image(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    _solid_color_image(crop_path, (203, 192, 255))
    gen_path_missing = str(tmp_path / "missing.png")  # never written
    with pytest.raises(ValueError, match="cannot read image"):
        await run(crop_path, gen_path_missing, _facts(), 1)


@pytest.mark.asyncio
async def test_fail_on_missing_expected_text(tmp_path):
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))  # no text rendered in the image
    result = await run(crop_path, gen_path, _facts(text="LOGO"), 1)
    assert result.status == "fail"
    assert any("LOGO" in v for v in result.violations)
