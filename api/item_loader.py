import os
from pipeline.types import ItemFacts, ItemResult


def load_item(item_dir: str) -> tuple[str, ItemResult, ItemFacts] | None:
    item_id = os.path.basename(item_dir)
    try:
        with open(os.path.join(item_dir, "result.json")) as f:
            result = ItemResult.model_validate_json(f.read())
        with open(os.path.join(item_dir, "facts.json")) as f:
            facts = ItemFacts.model_validate_json(f.read())
    except (OSError, ValueError):
        return None
    return item_id, result, facts


def image_urls(run_id: str, photo_name: str, item_id: str) -> tuple[str, str]:
    base = f"/images/{run_id}/{photo_name}/{item_id}"
    return f"{base}/crop.png", f"{base}/generated.png"


def cutout_url(item_dir: str, run_id: str, photo_name: str, item_id: str) -> str | None:
    # Only items whose background removal succeeded have a cutout.
    if not os.path.exists(os.path.join(item_dir, "cutout.png")):
        return None
    return f"/images/{run_id}/{photo_name}/{item_id}/cutout.png"


def load_back(item_dir: str, run_id: str, photo_name: str, item_id: str):
    """The item's back view as a BackOut, or None when it has no usable back."""
    from api.schemas import BackOut
    back_dir = os.path.join(item_dir, "back")
    if not os.path.exists(os.path.join(back_dir, "generated.png")):
        return None
    try:
        with open(os.path.join(back_dir, "facts.json")) as f:
            facts = ItemFacts.model_validate_json(f.read())
    except (OSError, ValueError):
        return None
    base = f"/images/{run_id}/{photo_name}/{item_id}/back"
    text = facts.visible_text.value
    return BackOut(
        generated_url=f"{base}/generated.png",
        cutout_url=f"{base}/cutout.png" if os.path.exists(os.path.join(back_dir, "cutout.png")) else None,
        visible_text=" ".join(text) if isinstance(text, list) else text,
    )
