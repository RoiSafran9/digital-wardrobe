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
