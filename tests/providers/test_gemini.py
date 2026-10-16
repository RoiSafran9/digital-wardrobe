import json
import cv2
import numpy as np
import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.asyncio
async def test_detect_items_with_facts_parses_response(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), np.zeros((400, 300, 3), dtype=np.uint8))  # h=400, w=300

    from pipeline.providers.gemini import GeminiProvider

    field = {"value": "pink", "confidence": 0.9, "basis": "observed"}
    fake_response = MagicMock()
    fake_response.text = json.dumps([{
        "box_2d": [250, 0, 750, 500], "included": True, "exclusion_reason": None,
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
    # box_2d is Gemini's native [ymin, xmin, ymax, xmax] on a 0-1000 scale; it must
    # become pixels on the real image (plus padding), not be read as pixels directly.
    box = items[0].box
    assert box.x < 0 + 1 and box.y < 100 and box.x + box.width > 150 and box.y + box.height > 300


@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from pipeline.providers.gemini import GeminiProvider
    with pytest.raises(RuntimeError, match="missing env var: GEMINI_API_KEY"):
        GeminiProvider()


def test_box_2d_to_bbox_scales_normalized_box_to_pixels_with_padding():
    from pipeline.providers.gemini import box_2d_to_bbox
    # [ymin, xmin, ymax, xmax] on 0-1000, image 3000 wide x 4000 tall
    box = box_2d_to_bbox([250, 100, 750, 600], width=3000, height=4000)
    # unpadded: x=300, y=1000, w=1500, h=2000; padding grows it on every side
    assert box.x < 300 and box.y < 1000
    assert box.x + box.width > 1800 and box.y + box.height > 3000
    assert box.width < 1500 * 1.2 and box.height < 2000 * 1.2


def test_box_2d_to_bbox_clamps_padding_to_image():
    from pipeline.providers.gemini import box_2d_to_bbox
    box = box_2d_to_bbox([0, 0, 1000, 1000], width=300, height=400)
    assert (box.x, box.y, box.width, box.height) == (0, 0, 300, 400)


def test_touches_frame_flags_boxes_at_the_photo_edge():
    from pipeline.providers.gemini import touches_frame
    assert touches_frame([163, 0, 902, 1000])      # sleeve cut off on both sides
    assert touches_frame([0, 200, 600, 700])       # top edge
    assert not touches_frame([203, 516, 575, 987])  # close to the edge but inside


@pytest.mark.asyncio
async def test_detection_marks_items_touching_the_frame_as_cut_off(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), np.zeros((400, 300, 3), dtype=np.uint8))
    from pipeline.providers.gemini import GeminiProvider

    field = {"value": "gray", "confidence": 0.9, "basis": "observed"}
    def det(box):
        return {"box_2d": box, "included": True, "cut_off_by_frame": False, "exclusion_reason": None,
                "category": field, "colors": field, "pattern": field,
                "visible_text": {"value": "", "confidence": 0.9, "basis": "observed"}, "trims": field,
                "visible_parts": {"value": ["front"], "confidence": 0.9, "basis": "observed"},
                "occluded_parts": {"value": [], "confidence": 0.9, "basis": "observed"}}
    fake_response = MagicMock()
    fake_response.text = json.dumps([det([163, 0, 902, 1000]), det([203, 516, 575, 987])])

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.return_value = fake_response
        items = await GeminiProvider().detect_items_with_facts(str(img_path))

    assert [i.cut_off_by_frame for i in items] == [True, False]
