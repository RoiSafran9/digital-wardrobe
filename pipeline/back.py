"""Add a back view to an existing item from one more photo.

Same stages as the front (quality → detect → crop → generate/verify → cutout), but generation
gets the item's front image as a reference so both sides read as one garment.
"""
import os
import shutil
from pipeline.orchestrator import Providers
from pipeline.run_log import RunLogger
from pipeline.stages import crop_item, cutout, stage0_quality, stage1_detect_facts, stage5_verify, stage6_score
from pipeline.types import ItemFacts, as_item_facts

QUALITY_MESSAGES = {
    "blurry": "The photo is blurry — hold still and try again",
    "too_dark": "The photo is too dark — try again in better light",
    "low_resolution": "The photo is too small — use the camera at full resolution",
}


class BackPhotoRejected(Exception):
    """The back photo can't be used; the message tells the user what to do."""


async def run_back(photo_path: str, front_image_path: str, output_dir: str, providers: Providers,
                   logger: RunLogger, max_attempts: int = 2) -> ItemFacts:
    """Write crop/generated/cutout/facts/result for the back into output_dir and return its facts.

    output_dir is only created once the photo is accepted, so a rejection leaves nothing behind.
    """
    quality = stage0_quality.run(photo_path)
    if quality.status == "retake":
        raise BackPhotoRejected(QUALITY_MESSAGES.get(quality.reason, "Try another photo"))

    detected = await stage1_detect_facts.run(photo_path, providers.vision)
    if not detected:
        raise BackPhotoRejected("no garment found — lay the item flat, back side up")
    # The user photographs one item's back; extra things in frame are smaller.
    item = max(detected, key=lambda d: d.box.width * d.box.height)

    os.makedirs(output_dir, exist_ok=True)
    crop_dest = os.path.join(output_dir, "crop.png")
    shutil.copy(crop_item.crop(photo_path, item.box), crop_dest)
    facts = as_item_facts(item)
    with open(os.path.join(output_dir, "facts.json"), "w") as f:
        f.write(facts.model_dump_json(indent=2))

    verification = None
    generated_path = None
    violations: list[str] | None = None
    for attempt in range(1, max_attempts + 2):
        try:
            generated_path = await providers.imagegen.generate_back(
                crop_dest, front_image_path, facts, violations, complete_edges=item.cut_off_by_frame)
        except Exception:
            verification = None
            break
        verification = await stage5_verify.run(crop_dest, generated_path, facts, attempt)
        if verification.status == "pass":
            break
        violations = verification.violations

    if not generated_path or not os.path.exists(generated_path):
        shutil.rmtree(output_dir)  # nothing usable; leave no half-made back behind
        raise BackPhotoRejected("couldn't create the back image — try again")

    generated_dest = os.path.join(output_dir, "generated.png")
    if generated_path != generated_dest:
        shutil.copy(generated_path, generated_dest)
    cutout.run(generated_dest, os.path.join(output_dir, "cutout.png"))
    result = stage6_score.run(verification, 1.0, max_attempts, cut_off=item.cut_off_by_frame)
    with open(os.path.join(output_dir, "result.json"), "w") as f:
        f.write(result.model_dump_json(indent=2))
    return facts
