import asyncio
import os
import shutil
from dataclasses import dataclass
from pipeline.providers.base import VisionProvider, SegmentProvider, ImageGenProvider
from pipeline.run_log import RunLogger
from pipeline.stages import (
    stage0_quality, stage1_detect, stage2_segment, stage3_facts,
    stage4_generate, stage5_verify, stage6_score,
)


@dataclass
class Providers:
    vision: VisionProvider
    segment: SegmentProvider
    imagegen: ImageGenProvider
    judge: VisionProvider  # must be a different model/provider than `vision`'s generate path


async def _run_item(image_path: str, item, item_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int):
    os.makedirs(item_dir, exist_ok=True)
    segment_result = await stage2_segment.run(image_path, item, providers.segment)
    crop_dest = os.path.join(item_dir, "crop.png")
    shutil.copy(segment_result.crop_path, crop_dest)

    facts = await stage3_facts.run(crop_dest, image_path, providers.vision)
    with open(os.path.join(item_dir, "facts.json"), "w") as f:
        f.write(facts.model_dump_json(indent=2))

    verification = None
    generated_path = None
    violations: list[str] | None = None
    for attempt in range(1, max_attempts + 2):
        try:
            generated_path = await stage4_generate.run(crop_dest, facts, violations, providers.imagegen)
        except Exception:
            verification = None
            break
        verification = await stage5_verify.run(crop_dest, generated_path, facts, attempt, providers.judge)
        if verification.status == "pass":
            break
        violations = verification.violations

    if generated_path and os.path.exists(generated_path):
        shutil.copy(generated_path, os.path.join(item_dir, "generated.png"))
    if verification:
        with open(os.path.join(item_dir, "verification.json"), "w") as f:
            f.write(verification.model_dump_json(indent=2))

    result = stage6_score.run(verification, segment_result.visible_fraction, max_attempts)
    with open(os.path.join(item_dir, "result.json"), "w") as f:
        f.write(result.model_dump_json(indent=2))

    return {"facts": facts, "verification": verification, "result": result}


async def run_photo(image_path: str, output_dir: str, providers: Providers,
                     logger: RunLogger, max_attempts: int = 2) -> dict:
    quality = stage0_quality.run(image_path)
    if quality.status == "retake":
        return {"quality": quality, "items": [], "failed": []}

    included_items = await stage1_detect.run(image_path, providers.vision)
    if not included_items:
        return {"quality": quality, "items": [], "failed": []}

    os.makedirs(output_dir, exist_ok=True)

    async def _safe_run_item(i, item):
        item_dir = os.path.join(output_dir, f"item_{i}")
        try:
            return await _run_item(image_path, item, item_dir, providers, logger, max_attempts)
        except Exception as e:
            logger.log(stage="orchestrator", model="n/a", prompt_version="v1",
                        latency_ms=0.0, status="error", error=str(e))
            return None

    outcomes = await asyncio.gather(*[
        _safe_run_item(i, item) for i, item in enumerate(included_items)
    ])

    items = [o for o in outcomes if o is not None]
    failed = [f"item_{i}" for i, o in enumerate(outcomes) if o is None]
    return {"quality": quality, "items": items, "failed": failed}
