"""Hand corrections to an item's facts, shared by the local and the multi-user API."""
from api.schemas import COLORS, PATTERNS, ItemPatch
from pipeline.types import FactField, ItemFacts


NAME_MAX = 60


def patch_error(patch: ItemPatch) -> str | None:
    if patch.name is not None and not 1 <= len(patch.name.strip()) <= NAME_MAX:
        return f"name must be 1 to {NAME_MAX} characters"
    if patch.category is not None and not patch.category.strip():
        return "category can't be empty"
    if patch.colors is not None and (not patch.colors or not set(patch.colors) <= COLORS):
        return f"colors must be one or more of: {', '.join(sorted(COLORS))}"
    if patch.pattern is not None and patch.pattern not in PATTERNS:
        return f"pattern must be one of: {', '.join(sorted(PATTERNS))}"
    return None


def apply_patch(facts: ItemFacts, patch: ItemPatch) -> ItemFacts:
    """Edited fields become certain observations; omitted ones stay as they are."""
    edited = {
        "name": patch.name.strip() if patch.name is not None else None,
        "category": patch.category.strip() if patch.category is not None else None,
        "colors": patch.colors, "pattern": patch.pattern,
        "trims": patch.trims.strip() if patch.trims is not None else None,
        "visible_text": patch.visible_text.strip() if patch.visible_text is not None else None,
    }
    for name, value in edited.items():
        if value is not None:
            setattr(facts, name, FactField(value=value, confidence=1.0, basis="observed"))
    return facts
