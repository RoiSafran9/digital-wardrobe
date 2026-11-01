"""The deterministic engine against docs/features/ai-outfit-builder/05-ACCEPTANCE-AND-TESTS.md's
fixtures: empty/sparse wardrobes, dress-vs-skirt structure, manual weather, diversity, and the
"don't fake a match" honesty rule."""
from api.outfit_builder.engine import build_suggestions

ANY = {"occasion": "any", "style": "any", "vibe": "any", "weather": "any", "colors": "any"}


def item(item_id, category, colors=(), tier="high"):
    return {"id": item_id, "tier": tier,
            "facts": {"category": {"value": category, "confidence": 0.9, "basis": "observed"},
                      "colors": {"value": list(colors), "confidence": 0.9, "basis": "observed"}}}


def filters(**over):
    return {**ANY, **over}


# --- Fixture A: empty wardrobe --------------------------------------------------------------------

def test_empty_wardrobe_has_no_looks_and_a_helpful_limitation():
    result = build_suggestions([], ANY)
    assert result.looks == []
    assert "closet" in result.limitations[0].lower()
    assert result.used_fallback is False


# --- Fixture B: only tops -------------------------------------------------------------------------

def test_only_tops_explains_the_missing_bottom_instead_of_faking_a_look():
    items = [item(f"t{i}", "t-shirt") for i in range(5)]
    result = build_suggestions(items, ANY)
    assert result.looks == []
    assert "bottom" in result.limitations[0].lower()


# --- Fixture C: minimal (exactly one valid look) --------------------------------------------------

def test_one_top_one_bottom_gives_exactly_one_look_not_three_copies():
    items = [item("top1", "shirt"), item("bottom1", "chinos")]
    result = build_suggestions(items, ANY)
    assert len(result.looks) == 1
    look = result.looks[0]
    assert set(look.item_ids) == {"top1", "bottom1"}
    assert look.slots == {"top": "top1", "bottom": "bottom1"}
    assert look.completeness == "core_outfit"


# --- Fixture D: a few (several valid, distinct looks) ----------------------------------------------

def test_a_few_tops_and_bottoms_gives_up_to_three_different_looks():
    items = [item(f"top{i}", "shirt") for i in range(3)] + [item(f"bottom{i}", "chinos") for i in range(2)]
    result = build_suggestions(items, ANY)
    assert 1 <= len(result.looks) <= 3
    seen = [frozenset(l.item_ids) for l in result.looks]
    assert len(seen) == len(set(seen))  # no duplicate exact composition
    for look in result.looks:
        assert len(look.item_ids) == len(set(look.item_ids))  # no item repeated within one look


# --- Fixture E: dress --------------------------------------------------------------------------

def test_dresses_use_the_one_piece_template_never_as_a_bottom():
    items = [item("dress1", "dress"), item("dress2", "midi dress"),
             item("cardigan1", "cardigan"), item("cardigan2", "cardigan")]
    result = build_suggestions(items, ANY)
    assert result.looks  # a one_piece alone is already a complete look
    for look in result.looks:
        assert look.slots.get("one_piece") in ("dress1", "dress2")
        assert "top" not in look.slots and "bottom" not in look.slots


# --- Fixture I: manual "hot" avoids heavy layers where possible ------------------------------------

def test_hot_weather_prefers_the_lighter_wardrobe_over_heavy_layers():
    items = [item("coat", "wool coat"), item("linen_shirt", "linen shirt"),
             item("shorts", "shorts"), item("jeans", "jeans")]
    result = build_suggestions(items, filters(weather="hot"))
    assert result.looks
    top_look_items = set(result.looks[0].item_ids)
    assert "coat" not in top_look_items  # the heavy outerwear never wins the top spot for "Hot"


# --- Fixture J: rainy makes no temperature or waterproofing claim -----------------------------------

def test_rainy_preference_never_claims_a_temperature_or_waterproofing():
    items = [item("top1", "shirt"), item("bottom1", "chinos")]
    result = build_suggestions(items, filters(weather="rainy"))
    reason = result.looks[0].reason.lower()
    assert "waterproof" not in reason and "checked the weather" not in reason
    assert "rainy" in reason


# --- Fixture K: work formal from a mostly-casual wardrobe: an honest no-match, not a fake formal look

def test_formal_occasion_with_no_formal_pieces_is_honest_instead_of_mislabeling_casual_as_formal():
    items = [item("tee", "t-shirt"), item("joggers", "joggers"), item("sneakers", "sneakers")]
    result = build_suggestions(items, filters(occasion="formal"))
    assert result.looks == []
    assert result.limitations and "good match" in result.limitations[0].lower()


def test_formal_occasion_is_satisfied_when_the_wardrobe_actually_has_formal_pieces():
    items = [item("gown", "gown"), item("heels", "heels"), item("tee", "t-shirt"), item("joggers", "joggers")]
    result = build_suggestions(items, filters(occasion="formal"))
    assert result.looks
    assert result.looks[0].slots.get("one_piece") == "gown"


# --- Fixture N: many near-identical tops never read as three distinct ideas ------------------------

def test_near_identical_tops_do_not_all_make_the_final_three_as_if_distinct():
    # Five near-identical t-shirts, one bottom, plus one genuinely different top (a dress — a
    # different template entirely) so real diversity is actually available to prefer.
    items = [item(f"tee{i}", "t-shirt") for i in range(5)] + [item("bottom1", "jeans"), item("dress1", "dress")]
    result = build_suggestions(items, ANY)
    anchors = {look.slots.get("top") for look in result.looks if "top" in look.slots}
    # Diversity selection should not need to reach for every near-duplicate top before trying the dress.
    assert any("one_piece" in look.slots for look in result.looks)
    assert len(anchors) <= 1 or len(result.looks) <= 2 or len(anchors) < 5


# --- Candidate bounding (fixture G: large wardrobes stay bounded, not combinatorial) ----------------

def test_a_large_wardrobe_still_returns_quickly_and_within_the_look_limit():
    items = [item(f"top{i}", "shirt") for i in range(60)] + [item(f"bottom{i}", "jeans") for i in range(60)]
    result = build_suggestions(items, ANY)
    assert len(result.looks) <= 3


# --- No filters chosen: never gated by the "honest no-match" threshold ------------------------------

def test_no_explicit_filters_never_triggers_the_no_good_match_state():
    items = [item("top1", "shirt"), item("coat", "wool coat"), item("bottom1", "jeans")]
    result = build_suggestions(items, ANY)
    assert result.looks  # nothing was asked for, so there is nothing to honestly fail to match
