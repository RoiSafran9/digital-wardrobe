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


EDGES_BLOCK = """The photo cuts this garment off at its edge (for example a sleeve tip or the hem runs past
the frame). Complete those parts as a plain continuation of what is visible — sleeves to their
natural cuffs, the full hem — inferring their length from the garment type and the visible part.
Do not invent pockets, zips, prints or trims in the completed areas.

"""


# A box this close to the photo edge (on the 0-1000 scale) means the garment runs past it.
FRAME_EDGE_MARGIN = 5


# Ghost-mannequin angles for the 360 view, in turn order.
TURN_VIEWS = {
    "front": "VIEW: straight-on FRONT view (0 degrees).",
    "right": ("VIEW: exact RIGHT SIDE profile (90 degrees): we see the garment's right side, the side seam and "
              "right sleeve; front prints are only barely visible at the edge."),
    "back": "VIEW: straight-on BACK view (180 degrees), matching the back reference image.",
    "left": "VIEW: exact LEFT SIDE profile (270 degrees): we see the garment's left side, the side seam and left sleeve.",
}

NO_BACK_BLOCK = ("There is no image of the back. Show a plain back in the same fabric and color; "
                 "do not invent prints, text or details on it.\n")

ANCHOR_LABEL = ("This is the SAME garment already rendered as a ghost mannequin from the front; "
                "keep its exact volume, fit and proportions:")


def _png_part(path: str) -> dict:
    with open(path, "rb") as f:
        return {"inline_data": {"mime_type": "image/png", "data": f.read()}}


def touches_frame(box_2d: list[int]) -> bool:
    # The model's own cut_off_by_frame flag proved unreliable; the box geometry is not.
    return min(box_2d) <= FRAME_EDGE_MARGIN or max(box_2d) >= 1000 - FRAME_EDGE_MARGIN


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
            prompt = _read_prompt("stage1_detect_facts_v4.txt")
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
                fields = detection.model_dump(exclude={"box_2d"})
                fields["cut_off_by_frame"] = detection.cut_off_by_frame or touches_frame(detection.box_2d)
                items.append(DetectedItemWithFacts(**fields, box=box_2d_to_bbox(detection.box_2d, width, height)))
            self._log("stage1_detect_facts", MODEL_VISION, "v4", start, "ok")
            return items
        except Exception as e:
            self._log("stage1_detect_facts", MODEL_VISION, "v4", start, "error", str(e))
            raise

    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None,
                       complete_edges: bool = False) -> str:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            template = _read_prompt("stage4_generate_v5.txt")
            violations_block = ("\nPrevious attempt violations to fix:\n" + "\n".join(violations)
                                 if violations else "")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2),
                                      violations_block=violations_block,
                                      edges_block=EDGES_BLOCK if complete_edges else "")
            response = self.client.models.generate_content(
                model=MODEL_IMAGE,
                contents=[{"inline_data": {"mime_type": "image/png", "data": crop_bytes}}, prompt],
            )
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            image_bytes = response.candidates[0].content.parts[0].inline_data.data
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate", MODEL_IMAGE, "v5", start, "ok")
            return out_path
        except Exception as e:
            self._log("stage4_generate", MODEL_IMAGE, "v5", start, "error", str(e))
            raise

    async def generate_back(self, crop_path: str, front_image_path: str, facts: ItemFacts,
                            violations: list[str] | None, complete_edges: bool = False) -> str:
        start = time.monotonic()
        try:
            with open(crop_path, "rb") as f:
                crop_bytes = f.read()
            with open(front_image_path, "rb") as f:
                front_bytes = f.read()
            template = _read_prompt("stage4_generate_back_v2.txt")
            violations_block = ("\nPrevious attempt violations to fix:\n" + "\n".join(violations)
                                 if violations else "")
            prompt = template.format(facts_block=facts.model_dump_json(indent=2),
                                      violations_block=violations_block,
                                      edges_block=EDGES_BLOCK if complete_edges else "")
            response = self.client.models.generate_content(
                model=MODEL_IMAGE,
                contents=[
                    "Image 1 — photo of the back:",
                    {"inline_data": {"mime_type": "image/png", "data": crop_bytes}},
                    "Image 2 — catalog image of the front:",
                    {"inline_data": {"mime_type": "image/png", "data": front_bytes}},
                    prompt,
                ],
            )
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            image_bytes = next(p.inline_data.data for p in response.candidates[0].content.parts
                               if p.inline_data is not None)
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate_back", MODEL_IMAGE, "v2", start, "ok")
            return out_path
        except Exception as e:
            self._log("stage4_generate_back", MODEL_IMAGE, "v2", start, "error", str(e))
            raise

    async def generate_view(self, front_path: str, back_path: str | None, view: str,
                            anchor_path: str | None = None) -> bytes:
        start = time.monotonic()
        try:
            contents: list = ["Reference: flat-lay catalog image of the FRONT:", _png_part(front_path)]
            if back_path:
                contents += ["Reference: flat-lay catalog image of the BACK:", _png_part(back_path)]
            if anchor_path:
                contents += [ANCHOR_LABEL, _png_part(anchor_path)]
            contents.append(_read_prompt("turn_view_v1.txt").format(
                back_block="" if back_path else NO_BACK_BLOCK, view_block=TURN_VIEWS[view]))
            # Async client: the 360 job runs in the background while the app polls the same server.
            response = await self.client.aio.models.generate_content(model=MODEL_IMAGE, contents=contents)
            data = next(p.inline_data.data for p in response.candidates[0].content.parts
                        if p.inline_data is not None)
            self._log("turn_view", MODEL_IMAGE, "v1", start, "ok")
            return data
        except Exception as e:
            self._log("turn_view", MODEL_IMAGE, "v1", start, "error", str(e))
            raise
