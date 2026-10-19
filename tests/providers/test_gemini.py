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


from unittest.mock import AsyncMock


def _image_response(data=b"png-bytes"):
    part = MagicMock()
    part.inline_data.data = data
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content.parts = [part]
    return response


def _png(path):
    cv2.imwrite(str(path), np.full((20, 20, 3), 200, dtype=np.uint8))
    return str(path)


def _refs(tmp_path, back=True):
    from pipeline.turn import SideRef, TurnRefs
    front = SideRef(catalog=_png(tmp_path / "f.png"), photo=_png(tmp_path / "fc.png"), text="90 EASTERN DIVISION")
    if not back:
        return TurnRefs(front=front, back=None)
    return TurnRefs(front=front, back=SideRef(catalog=_png(tmp_path / "b.png"), photo=_png(tmp_path / "bc.png"),
                                             text="DOME 90 EASTERN DIVISION"))


async def _call(tmp_path, refs, view, anchors, retry_note=None):
    from pipeline.providers.gemini import GeminiProvider
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        call = AsyncMock(return_value=_image_response(b"view"))
        MockClient.return_value.aio.models.generate_content = call
        data = await GeminiProvider().generate_view(refs, view, anchors, retry_note)
    assert call.call_args.kwargs["model"] == "gemini-2.5-flash-image"
    contents = call.call_args.kwargs["contents"]
    return data, [c for c in contents[:-1] if isinstance(c, str)], contents[-1], contents


@pytest.mark.asyncio
async def test_the_front_view_sees_only_the_front(monkeypatch, tmp_path):
    # Each view sees only its own side: given both, the model copied the wrong side.
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    data, labels, prompt, contents = await _call(tmp_path, _refs(tmp_path), "front", {})
    assert data == b"view"
    assert sum(isinstance(c, dict) for c in contents) == 1
    assert any("FRONT" in l and "catalog" in l for l in labels)
    assert not any("BACK" in l for l in labels)
    assert "GHOST MANNEQUIN" in prompt
    assert "never a photo background" in prompt
    assert "no mannequin neck" in prompt


@pytest.mark.asyncio
async def test_the_back_view_sees_every_back_image_and_nothing_of_the_front(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    _, labels, prompt, contents = await _call(tmp_path, _refs(tmp_path), "back", {})
    assert sum(isinstance(c, dict) for c in contents) == 2
    assert any("BACK" in l and "catalog" in l for l in labels)
    assert any("BACK" in l and "photo" in l for l in labels)
    assert not any("FRONT" in l for l in labels)
    assert "DOME 90 EASTERN DIVISION" in prompt
    assert "BACK" in prompt.split("VIEW:")[1]


@pytest.mark.asyncio
async def test_side_views_never_copy_a_print_onto_the_side(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    anchors = {"front": _png(tmp_path / "gf.png")}
    _, labels, prompt, _ = await _call(tmp_path, _refs(tmp_path), "right", anchors)
    assert sum("already rendered" in l.lower() for l in labels) == 1
    assert not any("BACK" in l for l in labels)
    assert "RIGHT" in prompt.split("VIEW:")[1]
    assert "never copy a print onto the sleeve or side" in prompt


@pytest.mark.asyncio
async def test_generate_view_without_back_says_so(monkeypatch, tmp_path):
    from pipeline.providers.gemini import NO_BACK_BLOCK
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    _, labels, prompt, contents = await _call(tmp_path, _refs(tmp_path, back=False), "back", {"front": _png(tmp_path / "g.png")})
    assert not any("BACK" in l and "catalog" in l for l in labels)
    assert any("FRONT" in l and "catalog" in l for l in labels)       # the plain back follows the front
    assert NO_BACK_BLOCK.strip() in prompt
    assert "no prints, text or details" in prompt.split("VIEW:")[1]
    assert "back reference" not in prompt


@pytest.mark.asyncio
async def test_a_retry_note_is_added_to_the_prompt(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    _, _, prompt, _ = await _call(tmp_path, _refs(tmp_path), "back", {}, retry_note="The back print is missing.")
    assert prompt.rstrip().endswith("The back print is missing.")


@pytest.mark.asyncio
async def test_detect_outfit_uses_the_versioned_worn_prompt(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), np.zeros((1000, 800, 3), dtype=np.uint8))
    from pipeline.providers.gemini import GeminiProvider
    from pipeline import outfit

    fake_response = MagicMock()
    fake_response.text = json.dumps({"scene_kind": "worn", "person_count": 1, "candidates": [{
        "box_2d": [100, 100, 500, 900], "category": "jacket", "layer": "outer", "colors": ["navy"],
        "pattern": "solid", "visible_text": "", "description": "navy jacket", "visible_parts": ["front"],
        "hidden_parts": [], "visibility": "full", "uncertainty": ""}]})
    fake_response.usage_metadata = None
    seen = {}

    async def generate_content(model, contents, config=None):
        seen["model"], seen["prompt"] = model, contents[-1]
        return fake_response

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        MockClient.return_value.aio.models.generate_content = generate_content
        scan = await GeminiProvider().detect_outfit(str(img_path))

    assert [c.category for c in scan.candidates] == ["jacket"]
    assert seen["prompt"] == open(f"pipeline/prompts/{outfit.DETECT_PROMPT}").read()
    assert "stage1_detect_facts" not in outfit.DETECT_PROMPT


@pytest.mark.asyncio
async def test_front_generation_reads_the_image_even_when_text_comes_first(monkeypatch, tmp_path):
    # Newer image models may answer with a short text part before the image.
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from pipeline.providers.gemini import GeminiProvider
    from pipeline.types import FactField, ItemFacts
    f = FactField(value="gray", confidence=0.9, basis="observed")
    facts = ItemFacts(category=f, colors=f, pattern=f, visible_text=f, trims=f, visible_parts=f, occluded_parts=f)
    text_part = MagicMock()
    text_part.inline_data = None
    image_part = MagicMock()
    image_part.inline_data.data = b"front-png"
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content.parts = [text_part, image_part]
    crop = _png(tmp_path / "crop.png")

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        MockClient.return_value.aio.models.generate_content = AsyncMock(return_value=response)
        out = await GeminiProvider().generate(crop, facts, None)

    assert open(out, "rb").read() == b"front-png"



# --- image model fallback: 2.5 first, 3.1 once Google retires 2.5 ---

@pytest.fixture(autouse=True)
def _fresh_image_model():
    from pipeline.providers import gemini
    gemini._image_model_gone = False
    yield
    gemini._image_model_gone = False


def _gone():
    from google.genai import errors
    return errors.ClientError(404, {"error": {"code": 404, "status": "NOT_FOUND",
                                              "message": "models/gemini-2.5-flash-image is not found for API version v1beta"}})


@pytest.mark.asyncio
async def test_images_fall_back_to_3_1_when_google_retires_2_5(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        call = AsyncMock(side_effect=[_gone(), _image_response(b"from-3.1")])
        MockClient.return_value.aio.models.generate_content = call
        from pipeline.providers.gemini import GeminiProvider
        data = await GeminiProvider().generate_view(_refs(tmp_path), "front", {})
    assert data == b"from-3.1"
    assert [c.kwargs["model"] for c in call.call_args_list] == ["gemini-2.5-flash-image", "gemini-3.1-flash-image"]


@pytest.mark.asyncio
async def test_after_falling_back_later_images_go_straight_to_3_1(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        call = AsyncMock(side_effect=[_gone(), _image_response(), _image_response()])
        MockClient.return_value.aio.models.generate_content = call
        from pipeline.providers.gemini import GeminiProvider
        provider = GeminiProvider()
        await provider.generate_view(_refs(tmp_path), "front", {})
        await provider.generate_view(_refs(tmp_path), "back", {})
    assert [c.kwargs["model"] for c in call.call_args_list][-1] == "gemini-3.1-flash-image"
    assert call.call_count == 3


@pytest.mark.asyncio
async def test_other_errors_do_not_switch_models(monkeypatch, tmp_path):
    from google.genai import errors
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    quota = errors.ClientError(429, {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "quota"}})
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        call = AsyncMock(side_effect=quota)
        MockClient.return_value.aio.models.generate_content = call
        from pipeline.providers.gemini import GeminiProvider
        with pytest.raises(errors.ClientError):
            await GeminiProvider().generate_view(_refs(tmp_path), "front", {})
    assert call.call_count == 1


@pytest.mark.asyncio
async def test_outfit_images_use_the_same_fallback(monkeypatch, tmp_path):
    from pipeline import outfit
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(side_effect=[_gone(), _image_response(b"outfit")])
    response = await outfit.image_content(client, ["prompt"])
    assert response.candidates[0].content.parts[0].inline_data.data == b"outfit"
    assert client.aio.models.generate_content.call_args.kwargs["model"] == "gemini-3.1-flash-image"
