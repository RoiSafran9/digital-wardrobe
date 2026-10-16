import os
import numpy as np
import cv2
import pytest
from pipeline.back import BackPhotoRejected, run_back
from pipeline.orchestrator import Providers
from pipeline.run_log import RunLogger
from pipeline.types import BBox, DetectedItemWithFacts, FactField


def _photo(path):
    cv2.imwrite(path, (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8))


def _item(category, box, cut_off=False, text=""):
    f = FactField(value="gray", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=box, included=True, cut_off_by_frame=cut_off, exclusion_reason=None,
        category=FactField(value=category, confidence=0.9, basis="observed"), colors=f, pattern=f,
        visible_text=FactField(value=text, confidence=0.9, basis="observed"), trims=f,
        visible_parts=FactField(value=["back"], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=["front"], confidence=0.9, basis="observed"),
    )


class FakeVision:
    def __init__(self, items):
        self.items = items

    async def detect_items_with_facts(self, image_path):
        return self.items


class FakeImageGen:
    def __init__(self):
        self.back_calls = []

    async def generate(self, crop_path, facts, violations):
        raise AssertionError("front generation must not run for a back photo")

    async def generate_back(self, crop_path, front_image_path, facts, violations):
        self.back_calls.append((crop_path, front_image_path, facts))
        out = crop_path.replace(".png", "_generated.png")
        cv2.imwrite(out, cv2.imread(crop_path))
        return out


@pytest.fixture
def setup(tmp_path):
    photo = str(tmp_path / "back.jpg")
    _photo(photo)
    front = str(tmp_path / "front_generated.png")
    _photo(front)
    return photo, front, str(tmp_path / "out"), RunLogger(str(tmp_path / "log.jsonl"))


@pytest.mark.asyncio
async def test_back_photo_is_cropped_generated_against_the_front_and_saved(setup):
    photo, front, out, logger = setup
    gen = FakeImageGen()
    vision = FakeVision([_item("sock", BBox(x=0, y=0, width=50, height=50)),
                         _item("hoodie", BBox(x=100, y=100, width=600, height=700), text="TEAM 9")])

    facts = await run_back(photo, front, out, Providers(vision=vision, imagegen=gen), logger)

    assert facts.category.value == "hoodie"            # the largest garment wins
    assert facts.visible_text.value == "TEAM 9"
    assert gen.back_calls[0][1] == front                 # front image is the reference
    for name in ("crop.png", "generated.png", "facts.json", "result.json"):
        assert os.path.exists(os.path.join(out, name)), name


@pytest.mark.asyncio
async def test_back_photo_cut_off_by_frame_is_rejected(setup):
    photo, front, out, logger = setup
    vision = FakeVision([_item("hoodie", BBox(x=0, y=0, width=900, height=900), cut_off=True)])
    with pytest.raises(BackPhotoRejected, match="step back"):
        await run_back(photo, front, out, Providers(vision=vision, imagegen=FakeImageGen()), logger)
    assert not os.path.exists(out)


@pytest.mark.asyncio
async def test_back_photo_without_a_garment_is_rejected(setup):
    photo, front, out, logger = setup
    with pytest.raises(BackPhotoRejected, match="no garment"):
        await run_back(photo, front, out, Providers(vision=FakeVision([]), imagegen=FakeImageGen()), logger)


@pytest.mark.asyncio
async def test_blurry_back_photo_is_rejected(setup, tmp_path):
    _, front, out, logger = setup
    flat = str(tmp_path / "flat.jpg")
    cv2.imwrite(flat, np.full((1000, 1000, 3), 128, dtype=np.uint8))  # no detail at all
    vision = FakeVision([_item("hoodie", BBox(x=100, y=100, width=600, height=700))])
    with pytest.raises(BackPhotoRejected):
        await run_back(flat, front, out, Providers(vision=vision, imagegen=FakeImageGen()), logger)
