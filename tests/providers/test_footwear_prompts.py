"""Shoes go to the versioned footwear prompts; garments keep the exact prompts they had."""
import json
from unittest.mock import MagicMock, patch
import cv2
import numpy as np
import pytest
from pipeline import footwear, outfit
from pipeline.outfit import Usage, parse_scan
from pipeline.run_log import RunLogger
from pipeline.types import FactField, ItemFacts

PROMPTS = "pipeline/prompts"


def _facts(category, parts):
    f = FactField(value="white", confidence=0.9, basis="observed")
    return ItemFacts(category=FactField(value=category, confidence=0.9, basis="observed"), colors=f, pattern=f,
                     visible_text=FactField(value="", confidence=0.9, basis="observed"), trims=f,
                     visible_parts=FactField(value=parts, confidence=0.9, basis="observed"),
                     occluded_parts=FactField(value=[], confidence=0.9, basis="observed"))


def _image_response():
    part = MagicMock()
    part.inline_data.data = b"png"
    response = MagicMock()
    response.candidates = [MagicMock()]
    response.candidates[0].content.parts = [part]
    response.usage_metadata.prompt_token_count = 10
    response.usage_metadata.candidates_token_count = 10
    return response


async def _generate(monkeypatch, tmp_path, facts, complete_edges=False):
    """The prompt text the image model was sent, and the run-log entry."""
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from pipeline.providers import gemini
    crop = tmp_path / "crop.png"
    crop.write_bytes(b"x")
    logger = RunLogger(str(tmp_path / "log.jsonl"))
    sent = {}
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        async def answer(model, contents):
            sent["prompt"] = contents[-1]
            return _image_response()
        MockClient.return_value.aio.models.generate_content = answer
        await gemini.GeminiProvider(logger).generate(str(crop), facts, None, complete_edges=complete_edges)
    [entry] = logger.read_all()
    return sent["prompt"], entry


async def test_a_pair_of_sneakers_uses_the_footwear_prompt_and_says_two(monkeypatch, tmp_path):
    prompt, entry = await _generate(monkeypatch, tmp_path, _facts("sneakers", ["pair (both shoes)", "toe"]))
    assert entry.prompt_version == "footwear_v1" and entry.stage == "stage4_generate"
    assert footwear.COUNT_BLOCKS["pair"] in prompt
    assert "Unfold it and lay it flat" not in prompt and "three-dimensional" in prompt
    assert "{" not in prompt.split("Facts about this footwear")[0]  # every placeholder filled


async def test_a_single_shoe_is_never_asked_for_a_partner(monkeypatch, tmp_path):
    prompt, _ = await _generate(monkeypatch, tmp_path, _facts("boots", ["single shoe", "shaft"]))
    assert footwear.COUNT_BLOCKS["single"] in prompt
    assert footwear.COUNT_BLOCKS["pair"] not in prompt


async def test_an_unsaid_count_asks_for_only_the_shoes_in_the_photo(monkeypatch, tmp_path):
    prompt, _ = await _generate(monkeypatch, tmp_path, _facts("loafers", ["toe", "heel"]))
    assert footwear.COUNT_BLOCKS["unknown"] in prompt


async def test_a_shoe_at_the_photo_edge_is_completed_as_a_shoe_not_a_sleeve(monkeypatch, tmp_path):
    from pipeline.providers.gemini import EDGES_BLOCK
    prompt, _ = await _generate(monkeypatch, tmp_path, _facts("sandals", ["pair (both shoes)"]), complete_edges=True)
    assert footwear.EDGES_BLOCK in prompt and EDGES_BLOCK not in prompt


async def test_garments_keep_the_v5_prompt_unchanged(monkeypatch, tmp_path):
    from pipeline.providers.gemini import EDGES_BLOCK
    facts = _facts("t-shirt", ["front"])
    prompt, entry = await _generate(monkeypatch, tmp_path, facts, complete_edges=True)
    template = open(f"{PROMPTS}/stage4_generate_v5.txt").read()
    assert prompt == template.format(facts_block=facts.model_dump_json(indent=2), violations_block="", edges_block=EDGES_BLOCK)
    assert entry.prompt_version == "v5" and "SHOE COUNT" not in prompt


async def test_detection_reads_the_footwear_aware_v5_prompt(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    from pipeline.providers.gemini import GeminiProvider
    img = tmp_path / "photo.jpg"
    cv2.imwrite(str(img), np.zeros((400, 300, 3), dtype=np.uint8))
    field = {"value": "white", "confidence": 0.9, "basis": "observed"}
    response = MagicMock()
    # One matching pair is one detection: nothing downstream may split it.
    response.text = json.dumps([{
        "box_2d": [300, 100, 700, 900], "included": True, "exclusion_reason": None,
        "category": {"value": "sneakers", "confidence": 0.9, "basis": "observed"},
        "colors": field, "pattern": field, "visible_text": {"value": "", "confidence": 0.9, "basis": "observed"},
        "trims": field, "visible_parts": {"value": ["pair (both shoes)", "toe"], "confidence": 0.9, "basis": "observed"},
        "occluded_parts": {"value": ["outsole (face down)"], "confidence": 0.9, "basis": "observed"},
    }])
    logger = RunLogger(str(tmp_path / "log.jsonl"))
    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        MockClient.return_value.models.generate_content.return_value = response
        items = await GeminiProvider(logger).detect_items_with_facts(str(img))
        sent = MockClient.return_value.models.generate_content.call_args.kwargs["contents"][-1]
    assert sent == open(f"{PROMPTS}/stage1_detect_facts_v5.txt").read()
    assert "ONE item" in sent and "Never list the left and the right shoe as two items" in sent
    assert len(items) == 1 and footwear.shoe_count(items[0].visible_parts.value) == "pair"
    assert logger.read_all()[0].prompt_version == "v5"


def test_detection_v5_still_excludes_accessories_and_worn_items():
    prompt = open(f"{PROMPTS}/stage1_detect_facts_v5.txt").read()
    assert "bags" in prompt and "sunglasses" in prompt and "shoes on feet" in prompt


# --- Outfit photo: worn shoes ---------------------------------------------------------------

def _cand(category, parts):
    return {"box_2d": [800, 300, 980, 700], "category": category, "layer": "single", "colors": ["black"],
            "pattern": "solid", "visible_text": "", "description": category, "visible_parts": parts,
            "hidden_parts": [], "visibility": "full", "uncertainty": ""}


async def _outfit_prompt(tmp_path, candidate, prompt_name=outfit.GENERATE_PROMPT):
    crop = tmp_path / "crop.png"
    cv2.imwrite(str(crop), np.full((20, 20, 3), 90, np.uint8))
    sent = {}

    class Client:
        class aio:
            class models:
                @staticmethod
                async def generate_content(model, contents):
                    sent["prompt"] = contents[-1]
                    return _image_response()

    usage = Usage()
    await outfit.generate_flatlay(Client, str(crop), None, candidate, None, str(tmp_path / "out.png"), usage, prompt_name)
    return sent["prompt"], usage


async def test_worn_shoes_use_the_footwear_outfit_prompt(tmp_path):
    scan = parse_scan({"scene_kind": "worn", "person_count": 1,
                       "candidates": [_cand("shoes", ["both shoes", "toe"])]}, 800, 1000)
    prompt, usage = await _outfit_prompt(tmp_path, scan.candidates[0])
    assert prompt.startswith(open(f"{PROMPTS}/{outfit.FOOTWEAR_GENERATE_PROMPT}").read().split("{context_block}")[0])
    assert footwear.COUNT_BLOCKS["pair"] in prompt and "feet" in prompt
    assert "Lay it flat, front side up" not in prompt
    assert usage.calls[0]["prompt"] == outfit.FOOTWEAR_GENERATE_PROMPT


async def test_one_visible_worn_shoe_is_not_completed_into_a_pair(tmp_path):
    scan = parse_scan({"scene_kind": "worn", "person_count": 1,
                       "candidates": [_cand("sneakers", ["one right shoe"])]}, 800, 1000)
    prompt, _ = await _outfit_prompt(tmp_path, scan.candidates[0])
    assert footwear.COUNT_BLOCKS["single"] in prompt and footwear.COUNT_BLOCKS["pair"] not in prompt


async def test_worn_garments_keep_the_v3_prompt(tmp_path):
    scan = parse_scan({"scene_kind": "worn", "person_count": 1, "candidates": [_cand("jeans", ["front"])]}, 800, 1000)
    prompt, usage = await _outfit_prompt(tmp_path, scan.candidates[0])
    assert "Lay it flat, front side up" in prompt and "SHOE COUNT" not in prompt
    assert usage.calls[0]["prompt"] == outfit.GENERATE_PROMPT


async def test_a_prompt_chosen_on_purpose_is_kept(tmp_path):
    scan = parse_scan({"scene_kind": "worn", "person_count": 1, "candidates": [_cand("shoes", ["both shoes"])]}, 800, 1000)
    _, usage = await _outfit_prompt(tmp_path, scan.candidates[0], prompt_name="outfit_generate_v2.txt")
    assert usage.calls[0]["prompt"] == "outfit_generate_v2.txt"
