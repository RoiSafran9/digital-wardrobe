import glob
import os
from fastapi import APIRouter
from api.config import runs_dir
from api.item_loader import load_item, image_urls, cutout_url
from api.schemas import ClosetItemOut, ItemsResponse

router = APIRouter()


@router.get("/items", response_model=ItemsResponse)
def list_items() -> ItemsResponse:
    pattern = os.path.join(runs_dir(), "*", "*", "item_*")
    item_dirs = [d for d in glob.glob(pattern) if os.path.isdir(d)]
    item_dirs.sort(key=os.path.getmtime, reverse=True)

    items: list[ClosetItemOut] = []
    for item_dir in item_dirs:
        # Retake-only items (never generated) belong in the run's results, not the closet.
        if not os.path.exists(os.path.join(item_dir, "generated.png")):
            continue
        loaded = load_item(item_dir)
        if loaded is None:
            continue
        item_id, result, facts = loaded
        photo_dir = os.path.dirname(item_dir)
        photo_name = os.path.basename(photo_dir)
        run_id = os.path.basename(os.path.dirname(photo_dir))
        crop_url, generated_url = image_urls(run_id, photo_name, item_id)
        items.append(ClosetItemOut(
            run_id=run_id, item_id=item_id, tier=result.tier, facts=facts,
            crop_url=crop_url, generated_url=generated_url,
            cutout_url=cutout_url(item_dir, run_id, photo_name, item_id),
        ))
    return ItemsResponse(items=items)
