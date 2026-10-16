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
async def test_missing_text_is_noted_but_does_not_fail(tmp_path):
    # Local OCR can't read most real prints, so a miss must not trigger retakes or regeneration.
    crop_path = str(tmp_path / "crop.png")
    gen_path = str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))  # no text rendered in the image
    result = await run(crop_path, gen_path, _facts(text="LOGO"), 1)
    assert result.status == "pass"
    assert result.violations == []
    assert any("LOGO" in n for n in result.notes)


NAVY = (90, 40, 30)          # BGR
LIGHT_DENIM = (200, 170, 130)
BED_WHITE = (245, 245, 245)
BED_STRIPE = (200, 200, 200)


def _pile_crop(path):
    # Navy garment in the middle, a neighbouring light-blue garment on the left,
    # striped bedding everywhere else — what a crop from a pile looks like.
    img = np.full((200, 200, 3), BED_WHITE, dtype=np.uint8)
    img[::8] = BED_STRIPE
    img[:, :50] = LIGHT_DENIM
    img[40:170, 70:180] = NAVY
    cv2.imwrite(path, img)


def _garment_on_white(path, bgr):
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[50:150, 60:140] = bgr  # garment surrounded by lots of white, like real output
    cv2.imwrite(path, img)


@pytest.mark.asyncio
async def test_pile_crop_passes_when_garment_color_matches(tmp_path):
    crop_path, gen_path = str(tmp_path / "crop.png"), str(tmp_path / "gen.png")
    _pile_crop(crop_path)
    _garment_on_white(gen_path, NAVY)
    result = await run(crop_path, gen_path, _facts(), 1)
    assert result.status == "pass", result.violations


@pytest.mark.asyncio
async def test_pile_crop_still_fails_on_a_real_color_shift(tmp_path):
    crop_path, gen_path = str(tmp_path / "crop.png"), str(tmp_path / "gen.png")
    _pile_crop(crop_path)
    _garment_on_white(gen_path, (40, 40, 200))  # red garment: not in the crop
    result = await run(crop_path, gen_path, _facts(), 1)
    assert result.status == "fail"
    assert any("color" in v.lower() for v in result.violations)


@pytest.mark.asyncio
async def test_finds_vertical_text_by_rotating(tmp_path, monkeypatch):
    from pipeline.stages import stage5_verify
    crop_path, gen_path = str(tmp_path / "crop.png"), str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))
    reads = iter(["", "DEFT\n", ""])  # upright, rotated clockwise, counter-clockwise
    monkeypatch.setattr(stage5_verify.pytesseract, "image_to_string", lambda img: next(reads, ""))
    result = await run(crop_path, gen_path, _facts(text="DEFT"), 1)
    assert result.status == "pass", result.violations
    assert result.notes == []


@pytest.mark.asyncio
async def test_text_match_ignores_case_and_spaces(tmp_path, monkeypatch):
    from pipeline.stages import stage5_verify
    crop_path, gen_path = str(tmp_path / "crop.png"), str(tmp_path / "gen.png")
    _solid_color_image(crop_path, (203, 192, 255))
    _solid_color_image(gen_path, (203, 192, 255))
    monkeypatch.setattr(stage5_verify.pytesseract, "image_to_string", lambda img: "d e f t")
    result = await run(crop_path, gen_path, _facts(text="DEFT"), 1)
    assert result.status == "pass", result.violations
    assert result.notes == []
