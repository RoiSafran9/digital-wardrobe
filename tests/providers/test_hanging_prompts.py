"""Hanging garments (docs/features/unified-add-clothes): versioned v6 garment prompts accept unworn clothes on a
hanger, hook or rail; v5 and the approved footwear prompts stay exactly as they were; worn clothes stay out."""
import hashlib
import re
import pytest
from pipeline.types import FactField
from tests.api.test_footwear_api import client, gate, garment, scan, shoe, store  # noqa: F401 (fixtures)
from tests.providers.test_footwear_prompts import _facts, _generate
from tests.api.v1_helpers import A, B, as_user

PROMPTS = "pipeline/prompts"

# Prompts are versioned files, never edited in place: these are the shipped bytes.
FROZEN = {
    "stage1_detect_facts_v5.txt": "234182af07e8bbf243fe9c95b2c3d99abccd42b1e52f0b03c124f0a9eabb6dbb",
    "stage4_generate_v5.txt": "0d4533e2d9bc8e35265496d08c29b8983b8d8971061810b0a186cf8914dede1d",
    "stage4_generate_footwear_v1.txt": "07757b909b8924f6a27bec6a2377d9c698729db1ae0000ad71eafaf5c917116b",
    "outfit_generate_footwear_v1.txt": "b0d883b01a635e19247b01847dc1e3bb4d73bb4162a4a7ff2da830ee264a9d87",
}


def _read(name):
    return open(f"{PROMPTS}/{name}").read()


def _between(text, start, end):
    return text[text.index(start):text.index(end, text.index(start))]


@pytest.mark.parametrize("name, digest", FROZEN.items())
def test_earlier_and_footwear_prompts_are_unchanged(name, digest):
    assert hashlib.sha256(open(f"{PROMPTS}/{name}", "rb").read()).hexdigest() == digest


def test_the_provider_points_garments_at_v6_and_shoes_at_the_approved_footwear_prompt():
    from pipeline.providers import gemini
    assert (gemini.DETECT_PROMPT, gemini.DETECT_VERSION) == ("stage1_detect_facts_v6.txt", "v6")
    assert (gemini.GENERATE_PROMPT, gemini.GENERATE_VERSION) == ("stage4_generate_v6.txt", "v6")
    assert (gemini.FOOTWEAR_GENERATE_PROMPT, gemini.FOOTWEAR_GENERATE_VERSION) == ("stage4_generate_footwear_v1.txt", "footwear_v1")


def test_detection_v6_takes_hanging_garments_but_not_worn_ones():
    v6 = _read("stage1_detect_facts_v6.txt")
    assert "hanging on a hanger, hook, rail or door" in v6
    assert "not the hanger hook, the clips, the rail or the wall" in v6       # box is the garment only
    assert "back (facing away)" in v6 and "collar (behind hanger)" in v6      # the unseen side stays occluded
    assert '"worn on body"' in v6 and "shoes on feet" in v6 and "mannequin" in v6
    assert "hangers, hooks and rails" in v6                                   # the hanger is never an item


def test_detection_v6_keeps_v5s_footwear_grouping_and_fields_word_for_word():
    v5, v6 = _read("stage1_detect_facts_v5.txt"), _read("stage1_detect_facts_v6.txt")
    assert _between(v5, "Footwear grouping", "For each item") == _between(v6, "Footwear grouping", "Hanging garments")
    for field in ("- category:", "- colors:", "- pattern:", "- trims:", "- visible_parts:"):
        assert _between(v5, field, "\n- ") == _between(v6, field, "\n- ")


def test_generation_v6_lays_a_hanging_garment_flat_without_the_hanger_or_new_details():
    v5, v6 = _read("stage4_generate_v5.txt"), _read("stage4_generate_v6.txt")
    assert "take it off the hanger and lay it flat" in v6
    assert "Show a hanger, hanger hook, clips, rail, hook, wall, mannequin, person" in v6
    assert "Invent what the hanger covered" in v6 and "never with a new label or logo" in v6
    # Fidelity rules are v5's, word for word, and the template fills the same placeholders.
    assert _between(v5, "Keep EXACTLY as in the photo:", "Do NOT:") == _between(v6, "Keep EXACTLY as in the photo:", "Do NOT:")
    assert set(re.findall(r"\{(\w+)\}", v5)) == set(re.findall(r"\{(\w+)\}", v6)) == {"edges_block", "facts_block", "violations_block"}


async def test_a_hanging_jacket_is_generated_with_v6_and_shoes_keep_footwear_v1(monkeypatch, tmp_path):
    jacket = _facts("jacket", ["front", "left sleeve", "right sleeve"])
    jacket = jacket.model_copy(update={"occluded_parts": FactField(value=["back (facing away)"], confidence=0.9, basis="observed")})
    (tmp_path / "jacket").mkdir()
    (tmp_path / "shoes").mkdir()
    prompt, entry = await _generate(monkeypatch, tmp_path / "jacket", jacket)
    assert entry.prompt_version == "v6" and "take it off the hanger" in prompt and "back (facing away)" in prompt
    shoes, entry = await _generate(monkeypatch, tmp_path / "shoes", _facts("sneakers", ["pair (both shoes)", "toe"]))
    assert entry.prompt_version == "footwear_v1" and "hanger" not in shoes


async def test_a_mixed_scan_keeps_hanging_clothes_and_one_pair_and_leaves_worn_clothes_out(store, client):  # noqa: F811
    hanging = garment(0, "jacket").model_copy(update={
        "occluded_parts": FactField(value=["back (facing away)"], confidence=0.9, basis="observed")})
    worn = garment(300, "shirt").model_copy(update={"included": False, "exclusion_reason": "worn on body"})
    _, pieces, vision = await scan(store, client, [hanging, shoe(500), worn])
    assert [(p["category"], p["shoes"]) for p in pieces] == [("jacket", None), ("sneakers", "pair")]
    assert vision.calls == 1  # one free detection call, nothing generated


async def test_a_photo_of_someone_wearing_clothes_says_so_for_the_apps_worn_hint(store, client):  # noqa: F811
    # The app offers "Try as a Worn Photo" with the same photo when the reason says worn (isWornRejection).
    worn = garment(0, "shirt").model_copy(update={"included": False, "exclusion_reason": "worn on body"})
    scan_id, pieces, _ = await scan(store, client, [worn])
    body = client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(A)).json()
    assert pieces == [] and re.search(r"worn|wearing", body["reason"], re.I)
    assert client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(B)).status_code == 404  # private to its owner
