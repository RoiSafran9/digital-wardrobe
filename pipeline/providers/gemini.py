import json
import time
import cv2
from google import genai
from google.genai import types
from pipeline.config import require_env
from pipeline.types import BBox, DetectedItemWithFacts, DetectionFields, ItemFacts
from pipeline.run_log import RunLogger

MODEL_VISION = "gemini-3.1-flash-lite"
MODEL_IMAGE = "gemini-2.5-flash-image"

PROMPTS_DIR = __file__.rsplit("/providers/", 1)[0] + "/prompts"


# Extra margin around each detected box so garment edges aren't clipped.
BOX_PADDING = 0.03


def _read_prompt(name: str) -> str:
    with open(f"{PROMPTS_DIR}/{name}") as f:
        return f.read()


class _RawDetection(DetectionFields):
    # Gemini's native box format: [ymin, xmin, ymax, xmax] normalized to 0-1000.
    box_2d: list[int]


def box_2d_to_bbox(box_2d: list[int], width: int, height: int) -> BBox:
    ymin, xmin, ymax, xmax = box_2d
    x0, x1 = xmin / 1000 * width, xmax / 1000 * width
    y0, y1 = ymin / 1000 * height, ymax / 1000 * height
    pad_x, pad_y = (x1 - x0) * BOX_PADDING, (y1 - y0) * BOX_PADDING
    x0, y0 = max(0.0, x0 - pad_x), max(0.0, y0 - pad_y)
    x1, y1 = min(float(width), x1 + pad_x), min(float(height), y1 + pad_y)
    return BBox(x=x0, y=y0, width=x1 - x0, height=y1 - y0)


class GeminiProvider:
    def __init__(self, logger: RunLogger | None = None):
        api_key = require_env("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self.logger = logger

    def _log(self, stage, model, prompt_version, start, status, error=None):
        if self.logger:
            self.logger.log(stage=stage, model=model, prompt_version=prompt_version,
                             latency_ms=(time.monotonic() - start) * 1000,
                             status=status, error=error)

    async def detect_items_with_facts(self, image_path: str) -> list[DetectedItemWithFacts]:
        start = time.monotonic()
        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            prompt = _read_prompt("stage1_detect_facts_v3.txt")
            response = self.client.models.generate_content(
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json",
                                                    response_schema=list[_RawDetection]),
            )
            # Same decode as crop_item, so box pixels line up with the crop.
            height, width = cv2.imread(image_path).shape[:2]
            items = []
            for raw in json.loads(response.text):
                detection = _RawDetection.model_validate(raw)
                items.append(DetectedItemWithFacts(
                    **detection.model_dump(exclude={"box_2d"}),
                    box=box_2d_to_bbox(detection.box_2d, width, height),
                ))
            self._log("stage1_detect_facts", MODEL_VISION, "v3", start, "ok")
            return items
        except Exception as e:
            self._log("stage1_detect_facts", MODEL_VISION, "v3", start, "error", str(e))
            raise

    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            template = _read_prompt("stage4_generate_v3.txt")
            violations_block = ("\nPrevious attempt violations to fix:\n" + "\n".join(violations)
                                 if violations else "")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2),
                                      violations_block=violations_block)
            response = self.client.models.generate_content(
                model=MODEL_IMAGE,
                contents=[{"inline_data": {"mime_type": "image/png", "data": crop_bytes}}, prompt],
            )
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            image_bytes = response.candidates[0].content.parts[0].inline_data.data
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate", MODEL_IMAGE, "v3", start, "ok")
            return out_path
        except Exception as e:
            self._log("stage4_generate", MODEL_IMAGE, "v3", start, "error", str(e))
            raise
