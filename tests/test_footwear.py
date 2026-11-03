"""Footwear: one shared predicate for "is this a shoe?" and the pair/single count the prompts rely on."""
import re
from pathlib import Path
from unittest.mock import MagicMock
import pytest
from api.outfit_builder.taxonomy import slot_for
from pipeline import footwear
from pipeline.stages import stage6_score
from pipeline.types import FactField, ItemFacts, VerificationResult

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("category", [
    "sneakers", "Sneaker", "trainers", "boots", "ankle boots", "Chelsea boot", "sandals", "loafers", "heels",
    "pumps", "flats", "ballet flats", "slippers", "mules", "slides", "clogs", "flip-flops", "espadrilles",
    "moccasins", "brogues", "dress shoes", "hiking shoes", "fleece slippers", "footwear", "shoes",
])
def test_common_shoe_types_are_footwear(category):
    assert footwear.is_footwear(category)


@pytest.mark.parametrize("category", [
    "t-shirt", "jeans", "boot-cut jeans", "boot cut jeans", "bootcut jeans", "dress", "oxford shirt", "shoelace",
    "flat cap", "slip dress", "socks", "bag", "", "sweater dress", "heelless",
])
def test_garments_and_lookalike_words_are_not_footwear(category):
    assert not footwear.is_footwear(category)


def _facts(category="sneakers", parts=("pair (both shoes)", "toe")):
    f = FactField(value="white", confidence=0.9, basis="observed")
    return ItemFacts(category=FactField(value=category, confidence=0.9, basis="observed"), colors=f, pattern=f,
                     visible_text=FactField(value="", confidence=0.9, basis="observed"), trims=f,
                     visible_parts=FactField(value=list(parts), confidence=0.9, basis="observed"),
                     occluded_parts=FactField(value=[], confidence=0.9, basis="observed"))


def test_facts_are_footwear_reads_models_dicts_and_lists_and_tolerates_junk():
    assert footwear.facts_are_footwear(_facts())
    assert footwear.facts_are_footwear(_facts().model_dump(mode="json"))
    assert footwear.facts_are_footwear({"category": {"value": ["boots"]}})
    assert not footwear.facts_are_footwear(_facts("hoodie"))
    assert not footwear.facts_are_footwear({}) and not footwear.facts_are_footwear({"category": None})
    assert not footwear.facts_are_footwear(MagicMock(spec=ItemFacts))  # unreadable → the garment path, as before


@pytest.mark.parametrize("parts, count", [
    (["pair (both shoes)", "toe", "heel"], "pair"),
    (["both shoes"], "pair"),  # the outfit prompt's wording
    (["two sneakers", "laces"], "pair"),
    (["single shoe", "outer side"], "single"),
    (["one boot", "shaft"], "single"),
    (["one left shoe"], "single"),
    (["toe", "heel", "laces"], "unknown"),  # nothing said: never assume a pair
    (["single shoe", "pair"], "unknown"),  # contradictory: never assume a pair
    (["two-tone upper"], "unknown"),
    ([], "unknown"),
    ("pair (both shoes)", "pair"),
])
def test_shoe_count_comes_only_from_what_the_detection_said(parts, count):
    assert footwear.shoe_count(parts) == count


def test_a_single_shoe_is_never_told_to_show_two():
    single = footwear.count_block(["single shoe"])
    assert "exactly ONE shoe" in single and "TWO" not in single
    assert "never add" in footwear.count_block(["toe"]).lower()
    assert "TWO shoes" in footwear.count_block(["pair (both shoes)"])
    assert all("mirror" in block for block in footwear.COUNT_BLOCKS.values())


def _ts_list(path: Path, name: str) -> set[str]:
    source = path.read_text()
    body = re.search(rf"export const {name} = \[(.*?)\];", source, re.S).group(1)
    return set(re.findall(r'"([a-z]+)"', body))


def test_the_app_shoes_group_uses_the_same_words_as_the_server():
    assert _ts_list(ROOT / "mobile/src/categoryGroups.ts", "SHOE_WORDS") == set(footwear.FOOTWEAR_WORDS)


def test_every_footwear_word_fills_the_outfit_builders_footwear_slot():
    for word in footwear.FOOTWEAR_WORDS:
        assert slot_for(word) == "footwear", word
    assert slot_for("dress shoes") == "footwear" and slot_for("boot-cut jeans") == "bottom"
    assert slot_for("t-shirt dress") == "one_piece"  # garments keep their slots


def test_shoes_get_shoe_retake_and_cut_off_tips_garments_keep_theirs():
    failed = VerificationResult(status="fail", violations=["color"], attempt=3)
    assert stage6_score.run(failed, 1.0, 2, footwear=True).retake_instruction == footwear.RETAKE_TIP
    assert "spread out flat" in stage6_score.run(failed, 1.0, 2).retake_instruction
    passed = VerificationResult(status="pass", violations=[], attempt=1)
    cut = stage6_score.run(passed, 1.0, 2, cut_off=True, footwear=True)
    assert cut.tier == "medium" and cut.retake_instruction == footwear.CUT_OFF_TIP
    assert stage6_score.run(passed, 1.0, 2, cut_off=True).retake_instruction == stage6_score.CUT_OFF_TIP
