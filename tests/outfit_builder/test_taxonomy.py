"""Category -> slot/formality/warmth mapping: the taxonomy difference the spec calls out explicitly
(a dress is a one_piece, a skirt is a bottom) and the soft, never-hard-exclusion unknown handling."""
import pytest
from api.outfit_builder.taxonomy import features_for, formality_for, slot_for, warmth_for


@pytest.mark.parametrize("category,slot", [
    ("dress", "one_piece"), ("midi dress", "one_piece"), ("jumpsuit", "one_piece"), ("gown", "one_piece"),
    ("skirt", "bottom"), ("jeans", "bottom"), ("chinos", "bottom"), ("shorts", "bottom"),
    ("jacket", "outerwear"), ("coat", "outerwear"), ("cardigan", "outerwear"),
    ("shirt jacket", "outerwear"),  # "jacket" wins over "shirt" — outerwear is checked first
    ("t-shirt dress", "one_piece"),  # "dress" wins over "t" — one_piece is checked before top
    ("sneakers", "footwear"), ("boots", "footwear"), ("sandals", "footwear"),
    ("t-shirt", "top"), ("oxford shirt", "top"), ("hoodie", "top"),
    ("handbag", "unknown"), ("belt", "unknown"), ("", "unknown"),
])
def test_slot_for(category, slot):
    assert slot_for(category) == slot


@pytest.mark.parametrize("category,formality", [
    ("gown", "formal"), ("tuxedo", "formal"), ("heels", "formal"),
    ("oxford shirt", "smart"), ("chinos", "smart"), ("blazer", "smart"),
    ("t-shirt", "casual"), ("sneakers", "casual"), ("joggers", "casual"),
    ("mystery garment", "unknown"),
])
def test_formality_for(category, formality):
    assert formality_for(category) == formality


@pytest.mark.parametrize("category,warmth", [
    ("puffer coat", "heavy"), ("wool coat", "heavy"),
    ("hoodie", "mid"), ("cardigan", "mid"), ("turtleneck", "mid"),
    ("t-shirt", "light"), ("tank top", "light"), ("shorts", "light"),
    ("mystery garment", "unknown"),
])
def test_warmth_for(category, warmth):
    assert warmth_for(category) == warmth


def _field(value):
    return {"value": value, "confidence": 0.8, "basis": "observed"}


def test_features_for_reads_the_first_category_and_lowers_everything():
    item = {"id": "i1", "tier": "high",
            "facts": {"category": _field(["Oxford Shirt", "spare"]), "colors": _field(["Navy", "White"])}}
    features = features_for(item)
    assert features.item_id == "i1" and features.slot == "top" and features.category == "oxford shirt"
    assert features.colors == ("navy", "white") and features.tier == "high"


def test_features_for_tolerates_a_missing_or_empty_category():
    item = {"id": "i2", "tier": None, "facts": {"category": _field(""), "colors": _field([])}}
    features = features_for(item)
    assert features.slot == "unknown" and features.formality == "unknown" and features.tier == "low"
