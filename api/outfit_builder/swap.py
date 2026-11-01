"""Build My Look's "Swap This Piece": ranks the user's own same-slot alternatives for one slot of an
ephemeral, client-held look. The client's look is untrusted data — every id in it is revalidated
against the caller's own current wardrobe before anything is ranked (section 8).
"""
from __future__ import annotations

from api.outfit_builder.engine import score_candidate
from api.outfit_builder.taxonomy import GarmentFeatures, features_for

ALTERNATIVES_LIMIT = 8


class StaleLook(Exception):
    """An id in the submitted look (or the swap target) no longer belongs to this account's active,
    renderable wardrobe — deleted, moved, unready, or never this user's to begin with."""


def swap_options(wardrobe_items: list[dict], look_item_ids: list[str], target_item_id: str,
                 filters: dict) -> tuple[str, list[tuple[str, str]]]:
    """Returns (target_slot, [(alternative_item_id, reason), ...]), ranked best first. Raises
    StaleLook if the look or the target references anything outside the caller's own active wardrobe —
    the route turns that into a "refresh and try again" response, never a silent substitution."""
    by_id: dict[str, GarmentFeatures] = {f.item_id: f for f in (features_for(i) for i in wardrobe_items)}

    look_ids = list(dict.fromkeys([*look_item_ids, target_item_id]))
    unknown = [item_id for item_id in look_ids if item_id not in by_id]
    if unknown:
        raise StaleLook(unknown)

    target = by_id[target_item_id]
    if target.slot == "unknown":
        raise StaleLook([target_item_id])

    other_look_items = tuple(by_id[item_id] for item_id in look_ids if item_id != target_item_id)
    excluded = {item_id for item_id in look_ids}  # the target itself, plus every other item in this look
    pool = [f for f in by_id.values() if f.slot == target.slot and f.item_id not in excluded]

    ranked = sorted(pool, key=lambda f: -score_candidate(other_look_items + (f,), filters))
    alternatives = [(f.item_id, _reason_for(f, target)) for f in ranked[:ALTERNATIVES_LIMIT]]
    return target.slot, alternatives


def _reason_for(candidate: GarmentFeatures, current: GarmentFeatures) -> str:
    if candidate.formality == current.formality or "unknown" in (candidate.formality, current.formality):
        return "A similarly styled option."
    if candidate.formality in ("smart", "formal") and current.formality == "casual":
        return "A more polished alternative."
    if candidate.formality == "casual" and current.formality in ("smart", "formal"):
        return "A more casual alternative."
    return "Another option from your closet."
