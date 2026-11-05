"""Hanging garments: garment detect/generate read and log the v6 prompts; footwear and outfit prompts stay put.

Prompt text only. Whether the model really catalogs a hanging garment faithfully is the real-photo
QA in docs/features/unified-add-clothes/03-ACCEPTANCE-AND-QA.md (H01-H06), not these tests."""
import difflib
import json
from unittest.mock import MagicMock, patch
import cv2
import numpy as np
import pytest
from pipeline import outfit
from pipeline.run_log import RunLogger
from tests.providers.test_footwear_prompts import PROMPTS, _facts, _generate


def _read(name):
    return open(f"{PROMPTS}/{name}").read()


def _removed_lines(old, new):
    """The lines of `old` that `new` drops or rewrites (added lines are not counted)."""
    return [line[2:] for line in difflib.ndiff(_read(old).splitlines(), _read(new).splitlines())
            if line.startswith("- ")]


# --- Selection and logging ------------------------------------------------------------------

def test_garment_prompts_point_at_v6_and_footwear_and_outfit_prompts_are_unchanged():
    from pipeline.providers import gemini
    assert (gemini.DETECT_PROMPT, gemini.DETECT_VERSION) == ("stage1_detect_facts_v6.txt", "v6")
    assert (gemini.GENERATE_PROMPT, gemini.GENERATE_VERSION) == ("stage4_generate_v6.txt", "v6")
    assert (gemini.FOOTWEAR_GENERATE_PROMPT, gemini.FOOTWEAR_GENERATE_VERSION) == (
        "stage4_generate_footwear_v1.txt", "footwear_v1")
    assert outfit.DETECT_PROMPT == "outfit_detect_v3.txt"
    assert outfit.GENERATE_PROMPT == "outfit_generate_v3.txt"
    assert outfit.FOOTWEAR_GENERATE_PROMPT == "outfit_generate_footwear_v1.txt"


async def test_a_hanging_shirt_is_detected_with_the_v6_prompt_and_logged_as_v6(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from pipeline.providers.gemini import GeminiProvider
    img = tmp_path / "hanging.jpg"
    cv2.imwrite(str(img), np.zeros((400, 300, 3), dtype=np.uint8))
    field = {"value": "white", "confidence": 0.9, "basis": "observed"}
    response = MagicMock()
    response.text = json.dumps([{
        "box_2d": [150, 200, 900, 800], "included": True, "exclusion_reason": None,
        "category": {"value": "shirt", "confidence": 0.9, "basis": "observed"},
        "colors": field, "pattern": field, "visible_text": {"value": "", "confidence": 0.9, "basis": "observed"},
        "trims": field, "visible_parts": {"value": ["front", "collar", "left sleeve", "right sleeve", "hem"],
                                          "confidence": 0.9, "basis": "observed"},
        "occluded_parts": {"value": ["back (faces the wall)"], "confidence": 0.9, "basis": "observed"},
    }])
    logger = RunLogger(str(tmp_path / "log.jsonl"))
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.return_value = response
        items = await GeminiProvider(logger).detect_items_with_facts(str(img))
        sent = MockClient.return_value.models.generate_content.call_args.kwargs["contents"][-1]
    assert sent == _read("stage1_detect_facts_v6.txt")
    assert "hanger" in sent and "garment only" in sent
    [entry] = logger.read_all()
    assert (entry.stage, entry.prompt_version) == ("stage1_detect_facts", "v6")
    # Same output schema as v5: the item comes through exactly like a laid-flat one.
    assert len(items) == 1 and items[0].included and items[0].occluded_parts.value == ["back (faces the wall)"]


@pytest.mark.parametrize("category", ["shirt", "dress", "jacket", "jeans"])
async def test_garments_are_generated_with_the_v6_prompt_and_logged_as_v6(monkeypatch, tmp_path, category):
    facts = _facts(category, ["front"])
    prompt, entry = await _generate(monkeypatch, tmp_path, facts)
    assert prompt == _read("stage4_generate_v6.txt").format(
        facts_block=facts.model_dump_json(indent=2), violations_block="", edges_block="")
    assert (entry.stage, entry.prompt_version) == ("stage4_generate", "v6")
    assert "remove the hanger" in prompt


@pytest.mark.parametrize("category", ["sneakers", "boots", "sandals"])
async def test_footwear_still_uses_its_own_prompt_not_v6(monkeypatch, tmp_path, category):
    prompt, entry = await _generate(monkeypatch, tmp_path, _facts(category, ["pair (both shoes)"]))
    assert entry.prompt_version == "footwear_v1"
    assert prompt.startswith(_read("stage4_generate_footwear_v1.txt").split("{")[0])
    assert "hanger" not in prompt.lower()


# --- v6 is a narrow change of v5 --------------------------------------------------------------

def test_detection_v6_rewrites_only_the_surface_only_lines_of_v5():
    # Every other v5 line — footwear grouping, box, fields, closed vocabulary — is kept verbatim.
    assert _removed_lines("stage1_detect_facts_v5.txt", "stage1_detect_facts_v6.txt") == [
        "You are analyzing a photo of clothing and footwear laid on a bed, floor or other surface for a",
        "digital wardrobe app.",
        "- included: true only if the item is laid on the capture surface (bed/floor), fully in frame, and",
        "  is clothing or footwear (not an accessory)",
        '  by frame edge", "not clothing")',
        "Exclude: items being worn by a person (including shoes on feet), accessories (bags, belts,",
        "sunglasses, jewelry, hats, socks), non-clothing objects, items mostly outside the frame. An item",
    ]


def test_detection_v6_accepts_hanging_garments_but_not_worn_ones():
    prompt = _read("stage1_detect_facts_v6.txt")
    assert "hanging on a hanger, hook, rail or door" in prompt
    assert "box encloses the garment only" in prompt
    assert "occluded_parts" in prompt and "never describe them as seen" in prompt
    assert "items being worn by a person (including shoes on feet" in prompt
    assert '"too little visible"' in prompt  # retake when too little of the garment shows
    assert "Never list the left and the right shoe as two items" in prompt


def test_generation_v6_rewrites_only_the_input_and_hanger_lines_of_v5():
    # Colors, fabric, silhouette, details, prints, white background and the "do not add" rules stay verbatim.
    assert _removed_lines("stage4_generate_v5.txt", "stage4_generate_v6.txt") == [
        "wrinkled, folded, bunched up, or partly covered, lying on a bed or floor. Edges of other",
        "garments or the surface underneath may also appear in the crop.",
        "- Show a hanger, mannequin, person, props, or a second garment.",
    ]


def test_generation_v6_removes_the_hanger_without_inventing_what_it_hid():
    prompt = _read("stage4_generate_v6.txt")
    assert "hanging vertically" in prompt
    assert "remove the hanger, clips, hook and rail" in prompt
    assert "Show a hanger, clip, hook, rail" in prompt
    assert "a collar, print, texture or shape you cannot see" in prompt and "never a guess" in prompt
    assert "pure white (#FFFFFF)" in prompt
