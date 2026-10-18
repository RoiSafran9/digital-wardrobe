import glob
import os
import re
import shutil
import time
import tempfile
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse, Response
from api.config import runs_dir
from api.item_loader import load_back, load_item, load_turn, image_urls, cutout_url
from api.routes.runs import ProviderFactory, get_provider_factory
from pipeline.back import BackPhotoRejected, run_back
from pipeline.run_log import RunLogger
from api.facts_edit import apply_patch, patch_error
from api.schemas import ClosetItemOut, ItemPatch, ItemsResponse

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
        back=load_back(item_dir, run_id, photo_name, item_id),
        turn=load_turn(item_dir, run_id, photo_name, item_id),
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

    error = patch_error(patch)
    if error:
        return _error(400, error)

    facts_path = os.path.join(item_dir, "facts.json")
    original_path = os.path.join(item_dir, "facts.original.json")
    if not os.path.exists(original_path):
        shutil.copy(facts_path, original_path)  # keep the model's version on first edit

    facts = apply_patch(facts, patch)
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


@router.post("/items/{run_id}/{photo_name}/{item_id}/back", response_model=ClosetItemOut)
async def add_back(
    run_id: str, photo_name: str, item_id: str,
    photo: UploadFile | None = File(None),
    provider_factory: ProviderFactory = Depends(get_provider_factory),
):
    item_dir = _item_dir(run_id, photo_name, item_id)
    front = os.path.join(item_dir, "generated.png") if item_dir else None
    if not front or not os.path.exists(front):
        return _error(404, "item not found")
    if photo is None or not photo.filename:
        return _error(400, "no photo provided")

    suffix = os.path.splitext(photo.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(photo.file, tmp)
        photo_path = tmp.name

    # Build the new back next to the item, then swap it in, so a failure never loses the old one.
    staging = os.path.join(item_dir, ".back-new")
    if os.path.exists(staging):
        shutil.move(staging, staging + f"-{int(time.time())}")
    logger = RunLogger(os.path.join(item_dir, "back_log.jsonl"))
    try:
        await run_back(photo_path, front, staging, provider_factory(logger), logger)
    except BackPhotoRejected as e:
        return _error(400, str(e))
    except ValueError as e:
        return _error(400, str(e))
    except Exception as e:
        return _error(500, str(e))
    finally:
        os.remove(photo_path)

    back_dir = os.path.join(item_dir, "back")
    if os.path.exists(back_dir):
        trash = os.path.join(runs_dir(), TRASH_DIR, run_id, photo_name, item_id, f"back-{int(time.time())}")
        os.makedirs(os.path.dirname(trash), exist_ok=True)
        shutil.move(back_dir, trash)
    shutil.move(staging, back_dir)
    return _closet_item(item_dir, run_id, photo_name)
