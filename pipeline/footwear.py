"""Footwear: the one shared answer to "is this a shoe?" and "one shoe or a pair?".

Used to route a piece to the footwear prompts (pipeline/providers/gemini.py, pipeline/outfit.py), to
refuse Back/360 for shoes before anything is held (api/routes), and as the outfit builder's footwear
slot (api/outfit_builder/taxonomy.py). mobile/src/categoryGroups.ts keeps the same word list for the
Shoes group; tests/test_footwear.py fails if the two drift apart.

Exact words, not substrings: "shoe" in "shoelace" or "boot" in "bootcut" must not make a shoe.
"""
from __future__ import annotations

import re
from typing import Literal

FOOTWEAR_WORDS = frozenset({
    "footwear", "shoes", "shoe", "sneakers", "sneaker", "trainers", "trainer", "boots", "boot", "booties", "bootie",
    "sandals", "sandal", "loafers", "loafer", "heels", "heel", "pumps", "pump", "flats", "slippers", "slipper",
    "mules", "mule", "slides", "clogs", "clog", "flops", "espadrilles", "espadrille", "moccasins", "moccasin",
    "brogues", "brogue",
})

_WORD_RE = re.compile(r"[a-z]+")
# "boot-cut jeans" are jeans: one word before tokenizing, so "boot" doesn't make them shoes.
_BOOTCUT_RE = re.compile(r"boot[\s_-]+cut")


def tokens(text: str) -> list[str]:
    return _WORD_RE.findall(_BOOTCUT_RE.sub("bootcut", text.lower()))


def is_footwear(category: str) -> bool:
    return any(t in FOOTWEAR_WORDS for t in tokens(category or ""))


def _first(value) -> str:
    if isinstance(value, list):
        value = value[0] if value else ""
    return value if isinstance(value, str) else ""


def facts_are_footwear(facts) -> bool:
    """ItemFacts (or its JSON dict) whose category is footwear. Anything unreadable is not footwear,
    so a malformed item keeps the garment behavior it always had."""
    category = facts.get("category") if isinstance(facts, dict) else getattr(facts, "category", None)
    value = category.get("value") if isinstance(category, dict) else getattr(category, "value", "")
    return is_footwear(_first(value))


ShoeCount = Literal["pair", "single", "unknown"]

_SHOE = r"(shoes?|boots?|sneakers?|trainers?|sandals?|slippers?|loafers?|heels?|pumps?|flats?|mules?|clogs?)"
_PAIR_RE = re.compile(rf"\bpair\b|\bboth\b|\btwo {_SHOE}\b")
_SINGLE_RE = re.compile(rf"\bsingle\b|\bone (left |right )?{_SHOE}\b")


def shoe_count(visible_parts) -> ShoeCount:
    """How many shoes the photo shows, from the detection's own visible_parts words (the v5 prompt asks
    for "pair (both shoes)" or "single shoe"; the outfit prompt says "both shoes"). Conflicting or
    missing words are "unknown": the prompt then says to show only the shoes visible, never to add one."""
    parts = visible_parts if isinstance(visible_parts, list) else [visible_parts]
    text = " ".join(p for p in parts if isinstance(p, str)).lower()
    pair, single = bool(_PAIR_RE.search(text)), bool(_SINGLE_RE.search(text))
    if pair == single:
        return "unknown"
    return "pair" if pair else "single"


COUNT_BLOCKS: dict[ShoeCount, str] = {
    "pair": ("SHOE COUNT: the photo shows a matching PAIR. Show exactly these TWO shoes, the left and the right one "
             "as photographed, together in one image. Never mirror or copy one shoe to make the other."),
    "single": ("SHOE COUNT: the photo shows ONE single shoe. Show exactly ONE shoe. Do not add, mirror or invent "
               "a second shoe — its partner is not in the photo."),
    "unknown": ("SHOE COUNT: show exactly the shoes you can see in the photo — one shoe if only one is visible, "
                "two if both are. Never add, mirror or invent a shoe that is not in the photo."),
}


def count_block(visible_parts) -> str:
    return COUNT_BLOCKS[shoe_count(visible_parts)]


EDGES_BLOCK = """The photo cuts part of the footwear off at its edge (for example a toe, heel or strap runs past
the frame). Complete only that part, as a plain, conservative continuation of the visible shape,
color and material. Do not invent logos, sole patterns, straps or details there, and never add a
shoe that is not in the photo.

"""

# Back and 360 are garment features (a flat back, a ghost mannequin); shoes have no approved version yet.
NO_SIDE_VIEWS = "Back and 360° views aren't available for shoes yet"

# Retake copy for shoes: the garment wording ("spread out flat") is wrong for a three-dimensional shoe.
RETAKE_TIP = "Place both shoes together, fully in frame, in good light"
CUT_OFF_TIP = "For a cleaner result, step back so the whole shoe fits in the frame"
