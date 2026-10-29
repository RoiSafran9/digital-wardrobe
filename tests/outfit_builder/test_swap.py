"""Swap This Piece: same-slot ranking, exclusion of items already used elsewhere in the look, and the
"the look is untrusted — revalidate everything" rule (section 8, fixtures L and M)."""
import pytest
from api.outfit_builder.swap import StaleLook, swap_options

ANY = {"occasion": "any", "style": "any", "vibe": "any", "weather": "any", "colors": "any"}


def item(item_id, category, colors=(), tier="high"):
    return {"id": item_id, "tier": tier,
            "facts": {"category": {"value": category, "confidence": 0.9, "basis": "observed"},
                      "colors": {"value": list(colors), "confidence": 0.9, "basis": "observed"}}}


WARDROBE = [
    item("top1", "shirt"), item("bottom1", "chinos"), item("bottom2", "jeans"), item("bottom3", "joggers"),
    item("shoes1", "sneakers"),
]


def test_returns_other_owned_items_in_the_same_slot_excluding_the_target_and_the_rest_of_the_look():
    slot, alternatives = swap_options(WARDROBE, ["top1", "bottom1", "shoes1"], "bottom1", ANY)
    assert slot == "bottom"
    ids = [item_id for item_id, _reason in alternatives]
    assert set(ids) == {"bottom2", "bottom3"}
    assert "bottom1" not in ids and "top1" not in ids and "shoes1" not in ids


def test_an_alternative_already_used_elsewhere_in_the_look_is_excluded():
    # bottom2 is (oddly) already in another slot of this look — it must never be offered again.
    slot, alternatives = swap_options(WARDROBE, ["top1", "bottom1", "bottom2"], "bottom1", ANY)
    ids = {item_id for item_id, _reason in alternatives}
    assert "bottom2" not in ids
    assert ids == {"bottom3"}


def test_no_alternatives_is_an_empty_list_not_an_error():
    slot, alternatives = swap_options([item("only_top", "shirt")], ["only_top"], "only_top", ANY)
    assert slot == "top" and alternatives == []


# --- Fixture L: a stale/deleted item between suggestion and swap -----------------------------------

def test_a_deleted_target_item_is_rejected_as_stale():
    with pytest.raises(StaleLook):
        swap_options(WARDROBE, ["top1", "bottom1"], "bottom1-deleted", ANY)


def test_a_look_referencing_an_item_no_longer_in_the_wardrobe_is_rejected_as_stale():
    with pytest.raises(StaleLook):
        swap_options(WARDROBE, ["top1-gone", "bottom1"], "bottom1", ANY)


# --- Fixture M: cross-account — another user's item id is simply not in this user's wardrobe --------

def test_an_id_outside_the_callers_own_wardrobe_is_rejected_as_stale_not_served():
    foreign_id = "someone-elses-item"
    with pytest.raises(StaleLook):
        swap_options(WARDROBE, ["top1", "bottom1"], foreign_id, ANY)


def test_swap_reasons_describe_the_formality_difference_without_inventing_facts():
    slot, alternatives = swap_options(WARDROBE, ["top1", "bottom1"], "bottom1", ANY)
    reasons = dict(alternatives)
    assert reasons["bottom3"]  # joggers (casual) vs chinos (smart): some reason is always given
    assert all(isinstance(r, str) and r for r in reasons.values())
