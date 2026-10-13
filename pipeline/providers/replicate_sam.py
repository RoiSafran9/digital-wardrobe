import time
import cv2
import numpy as np
import replicate
from pipeline.config import require_env
from pipeline.types import BBox, SegmentResult
from pipeline.run_log import RunLogger

# Placeholder model slug — look up the current SAM2 slug on replicate.com
# before wiring in real keys; replicate slugs/versions change over time.
MODEL = "yyyyyyxianzhi/segment-anything-2"


class ReplicateSamProvider:
    def __init__(self, logger: RunLogger | None = None):
        self.token = require_env("REPLICATE_API_TOKEN")
        self.logger = logger

    async def segment(self, image_path: str, box: BBox) -> SegmentResult:
        start = time.monotonic()
        try:
            output = replicate.run(MODEL, input={
                "image": open(image_path, "rb"),
                "box": [box.x, box.y, box.x + box.width, box.y + box.height],
            })
            mask_path = output[0] if isinstance(output, list) else output
            mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
            expected_area = box.width * box.height
            mask_area = float(np.count_nonzero(mask))
            visible_fraction = min(mask_area / expected_area, 1.0) if expected_area else 0.0
            crop_path = str(mask_path).replace("mask", "crop")
            result = SegmentResult(mask_path=str(mask_path), crop_path=crop_path,
                                    visible_fraction=visible_fraction, occluded_by=[])
            if self.logger:
                self.logger.log(stage="stage2_segment", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000, status="ok")
            return result
        except Exception as e:
            if self.logger:
                self.logger.log(stage="stage2_segment", model=MODEL, prompt_version="v1",
                                 latency_ms=(time.monotonic() - start) * 1000,
                                 status="error", error=str(e))
            raise
