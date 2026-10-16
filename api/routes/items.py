import glob
import os
import re
import shutil
import time
from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response
from api.config import runs_dir
from api.item_loader import load_item, image_urls, cutout_url
from api.schemas import COLORS, PATTERNS, ClosetItemOut, ItemPatch, ItemsResponse
from pipeline.types import FactField

# Soft-deleted items go here; glob("*") skips dot-directories, so the closet never lists them.
TRASH_DIR = ".trash"

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
        photo_dir = os.path.dirname(item_dir)
        item = _closet_item(item_dir, os.path.basename(os.path.dirname(photo_dir)), os.path.basename(photo_dir))
        if item is not None:
            items.append(item)
    return ItemsResponse(items=items)


def _closet_item(item_dir: str, run_id: str, photo_name: str) -> ClosetItemOut | None:
    loaded = load_item(item_dir)
    if loaded is None:
        return None
    item_id, result, facts = loaded
    crop_url, generated_url = image_urls(run_id, photo_name, item_id)
    return ClosetItemOut(
        run_id=run_id, photo_name=photo_name, item_id=item_id, tier=result.tier, facts=facts,
        crop_url=crop_url, generated_url=generated_url,
        cutout_url=cutout_url(item_dir, run_id, photo_name, item_id),
    )


def _item_dir(run_id: str, photo_name: str, item_id: str) -> str | None:
    """The item's folder, or None for anything that isn't a plain item inside the runs dir."""
    for part in (run_id, photo_name, item_id):
        if not part or part.startswith(".") or "/" in part or "\\" in part:
            return None
    if not re.fullmatch(r"item_\d+", item_id):
        return None
    root = os.path.realpath(runs_dir())
    path = os.path.realpath(os.path.join(root, run_id, photo_name, item_id))
    if not path.startswith(root + os.sep) or not os.path.isdir(path):
        return None
    return path


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": message})


@router.patch("/items/{run_id}/{photo_name}/{item_id}", response_model=ClosetItemOut)
def edit_item(run_id: str, photo_name: str, item_id: str, patch: ItemPatch):
    item_dir = _item_dir(run_id, photo_name, item_id)
    loaded = load_item(item_dir) if item_dir else None
    if loaded is None:
        return _error(404, "item not found")
    _, _, facts = loaded

    if patch.category is not None and not patch.category.strip():
        return _error(400, "category can't be empty")
    if patch.colors is not None and (not patch.colors or not set(patch.colors) <= COLORS):
        return _error(400, f"colors must be one or more of: {', '.join(sorted(COLORS))}")
    if patch.pattern is not None and patch.pattern not in PATTERNS:
        return _error(400, f"pattern must be one of: {', '.join(sorted(PATTERNS))}")

    facts_path = os.path.join(item_dir, "facts.json")
    original_path = os.path.join(item_dir, "facts.original.json")
    if not os.path.exists(original_path):
        shutil.copy(facts_path, original_path)  # keep the model's version on first edit

    edited = {
        "category": patch.category.strip() if patch.category is not None else None,
        "colors": patch.colors, "pattern": patch.pattern,
        "trims": patch.trims.strip() if patch.trims is not None else None,
        "visible_text": patch.visible_text.strip() if patch.visible_text is not None else None,
    }
    for name, value in edited.items():
        if value is not None:
            setattr(facts, name, FactField(value=value, confidence=1.0, basis="observed"))
    with open(facts_path, "w") as f:
        f.write(facts.model_dump_json(indent=2))
    return _closet_item(item_dir, run_id, photo_name)


@router.delete("/items/{run_id}/{photo_name}/{item_id}", status_code=204)
def delete_item(run_id: str, photo_name: str, item_id: str):
    item_dir = _item_dir(run_id, photo_name, item_id)
    if item_dir is None:
        return _error(404, "item not found")
    trash = os.path.join(runs_dir(), TRASH_DIR, run_id, photo_name, item_id)
    if os.path.exists(trash):
        trash += f"-{int(time.time())}"  # never overwrite an earlier deleted copy
    os.makedirs(os.path.dirname(trash), exist_ok=True)
    shutil.move(item_dir, trash)
    return Response(status_code=204)
