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
