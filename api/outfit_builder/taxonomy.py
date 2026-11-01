"""Deterministic enrichment of a wardrobe item's facts into the outfit builder's slots and soft
signals. Reuses existing item facts only — no extra model call, no migration (see
docs/features/ai-outfit-builder/03-RECOMMENDATION-ENGINE.md section 2).

The slot word lists mirror mobile/src/categoryGroups.ts's groups (checked in the same order, so
"t-shirt dress" sorts as a dress and "shirt jacket" as outerwear), split further where an outfit
needs more than a broad group: a skirt is a `bottom`, a dress is a `one_piece`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

Slot = str  # "top" | "bottom" | "one_piece" | "outerwear" | "footwear" | "unknown"
STRUCTURAL_SLOTS = ("top", "bottom", "one_piece", "outerwear", "footwear")

_WORD_RE = re.compile(r"[a-z]+")


def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


_SLOT_WORDS: list[tuple[Slot, set[str]]] = [
    ("one_piece", {"dress", "jumpsuit", "romper", "gown"}),
    ("outerwear", {"jacket", "coat", "blazer", "cardigan", "vest", "parka", "gilet", "trench", "anorak",
                   "windbreaker", "puffer", "fleece"}),
    ("footwear", {"sneakers", "sneaker", "boots", "boot", "shoes", "shoe", "sandals", "sandal",
                  "loafers", "loafer", "heels", "flats", "slippers", "trainers"}),
    ("bottom", {"jeans", "pants", "trousers", "shorts", "skirt", "leggings", "chinos", "joggers", "sweatpants"}),
    ("top", {"shirt", "t", "tee", "blouse", "sweater", "hoodie", "tank", "top", "polo", "sweatshirt",
             "jumper", "pullover", "camisole", "overshirt", "turtleneck", "crop", "bodysuit"}),
]


def slot_for(category: str) -> Slot:
    tokens = _tokens(category)
    for slot, words in _SLOT_WORDS:
        if tokens & words:
            return slot
    return "unknown"


# Formality and warmth have no dedicated field yet (section 2's `formality`/`warmth` are "proposed").
# These are simple, conservative word mappings, not a learned or validated taxonomy: anything not
# recognized stays "unknown" and is never treated as a hard exclusion, only a soft scoring penalty.
_FORMAL_WORDS = {"gown", "tuxedo", "suit", "heels"}
_SMART_WORDS = {"shirt", "blouse", "chinos", "trousers", "loafers", "flats", "cardigan", "sweater",
                "skirt", "blazer", "polo", "oxford"}
_CASUAL_WORDS = {"t", "tee", "hoodie", "sweatshirt", "joggers", "sweatpants", "sneakers", "sneaker",
                 "trainers", "tank", "shorts", "flip", "flops", "slippers"}


def formality_for(category: str) -> str:
    # Checked formal, then casual, then smart: "t-shirt" tokenizes to {"t", "shirt"}, and the casual
    # "t" must win over the generic "shirt" before smart ever gets a look at it.
    tokens = _tokens(category)
    if tokens & _FORMAL_WORDS:
        return "formal"
    if tokens & _CASUAL_WORDS:
        return "casual"
    if tokens & _SMART_WORDS:
        return "smart"
    return "unknown"


_HEAVY_WORDS = {"coat", "puffer", "parka", "trench", "overcoat", "wool"}
_MID_WORDS = {"sweater", "hoodie", "cardigan", "jacket", "sweatshirt", "jumper", "pullover", "turtleneck", "fleece"}
_LIGHT_WORDS = {"t", "tee", "tank", "shorts", "linen", "camisole", "sandals", "sandal"}


def warmth_for(category: str) -> str:
    tokens = _tokens(category)
    if tokens & _HEAVY_WORDS:
        return "heavy"
    if tokens & _MID_WORDS:
        return "mid"
    if tokens & _LIGHT_WORDS:
        return "light"
    return "unknown"


# The detection prompt's closed color vocabulary (api/schemas.COLORS), grouped for the `colors`
# preference filter. A color not in either set (shouldn't happen) counts as neither light nor dark.
NEUTRAL_COLORS = {"black", "white", "gray", "navy", "beige", "brown"}
DARK_COLORS = {"black", "navy", "brown", "purple", "gray"}
LIGHT_COLORS = {"white", "beige", "pink", "dusty pink", "mint", "yellow"}


@dataclass(frozen=True)
class GarmentFeatures:
    item_id: str
    slot: Slot
    category: str  # the model's own word(s), lowered — display/debugging only, never shown as a "fact"
    colors: tuple[str, ...]
    formality: str  # casual | smart | formal | unknown
    warmth: str  # light | mid | heavy | unknown
    tier: str  # high | medium | low — an existing quality signal, used only as a tie-breaker


def _as_list(value) -> list[str]:
    if isinstance(value, list):
        return [v for v in value if isinstance(v, str) and v.strip()]
    return [value] if isinstance(value, str) and value.strip() else []


def features_for(item: dict) -> GarmentFeatures:
    """The item dict shape store.list_items returns (api/store.py): facts is the raw ItemFacts dict."""
    facts = item.get("facts") or {}
    category = (_as_list((facts.get("category") or {}).get("value"))[:1] or [""])[0].strip().lower()
    colors = tuple(c.strip().lower() for c in _as_list((facts.get("colors") or {}).get("value")))
    return GarmentFeatures(
        item_id=item["id"], slot=slot_for(category), category=category, colors=colors,
        formality=formality_for(category), warmth=warmth_for(category), tier=item.get("tier") or "low",
    )
