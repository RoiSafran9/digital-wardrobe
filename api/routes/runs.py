import glob
import os
import shutil
import tempfile
import time
from typing import Callable
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from api.config import runs_dir
from api.item_loader import load_item, image_urls
from api.schemas import RunResponse, RunItemOut, QualityOut
from cli import build_providers
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger

router = APIRouter()

ProviderFactory = Callable[[RunLogger], Providers]


def default_provider_factory(logger: RunLogger) -> Providers:
    return build_providers(logger)


def get_provider_factory() -> ProviderFactory:
    return default_provider_factory


@router.post("/runs", response_model=RunResponse)
async def create_run(
    photo: UploadFile | None = File(None),
    provider_factory: ProviderFactory = Depends(get_provider_factory),
):
    if photo is None or not photo.filename:
        return JSONResponse(status_code=400, content={"error": "no photo provided"})

    run_id = time.strftime("%Y%m%d-%H%M%S-") + str(int(time.time() * 1000) % 1000)
    photo_name = os.path.splitext(photo.filename)[0] or "photo"
    run_root = os.path.join(runs_dir(), run_id)
    output_dir = os.path.join(run_root, photo_name)
    os.makedirs(run_root, exist_ok=True)

    suffix = os.path.splitext(photo.filename)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(photo.file, tmp)
        photo_path = tmp.name

    logger = RunLogger(os.path.join(run_root, "run_log.jsonl"))
    providers = provider_factory(logger)

    try:
        result = await run_photo(photo_path, output_dir, providers, logger)
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

    item_dirs = sorted(
        (d for d in glob.glob(os.path.join(output_dir, "item_*")) if os.path.isdir(d)),
        key=lambda d: int(os.path.basename(d).split("_")[1]),
    )
    items_out: list[RunItemOut] = []
    for item_dir in item_dirs:
        loaded = load_item(item_dir)
        if loaded is None:
            continue
        item_id, item_result, facts = loaded
        crop_url, generated_url = image_urls(run_id, photo_name, item_id)
        items_out.append(RunItemOut(
            item_id=item_id, tier=item_result.tier, reason=item_result.reason,
            retake_instruction=item_result.retake_instruction, facts=facts,
            crop_url=crop_url, generated_url=generated_url,
        ))

    return RunResponse(
        run_id=run_id,
        quality=QualityOut(status=result["quality"].status, reason=result["quality"].reason),
        items=items_out,
        failed=result["failed"],
    )
