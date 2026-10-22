import asyncio
import json
import logging
import time
import cv2
from google import genai
from google.genai import types
from pipeline import costs
from pipeline.config import require_env
from pipeline.types import BBox, DetectedItemWithFacts, DetectionFields, ItemFacts
from pipeline.run_log import RunLogger

MODEL_VISION = "gemini-3.1-flash-lite"
MODEL_IMAGE = "gemini-2.5-flash-image"
# MODEL_IMAGE is deprecated with no firm shutdown date. It stays first (cheapest and most faithful
# on the owner's items); once Google answers "model not found", every image call switches to this
# one (≈1.7× the price) for the rest of the process.
MODEL_IMAGE_FALLBACK = "gemini-3.1-flash-image"
_image_model_gone = False

log = logging.getLogger("wardrobe.gemini")


def image_model() -> str:
    return MODEL_IMAGE_FALLBACK if _image_model_gone else MODEL_IMAGE


def _usage(response) -> tuple[int | None, int | None, int | None]:
    """(input tokens, output tokens, images returned) from a Gemini response; Nones when there is none."""
    if response is None:
        return None, None, None
    meta = getattr(response, "usage_metadata", None)
    tin = getattr(meta, "prompt_token_count", None)
    tout = getattr(meta, "candidates_token_count", None)
    try:
        images = sum(1 for p in response.candidates[0].content.parts if getattr(p, "inline_data", None) is not None)
    except (AttributeError, IndexError, TypeError):
        images = 0
    return (tin if isinstance(tin, int) else None, tout if isinstance(tout, int) else None, images)


def _model_gone(error: Exception) -> bool:
    return getattr(error, "code", None) in (404, 410)


# A request that never comes back must not hold a job (and its credits) forever: give up and let the
# job's own retry/failure handling take over.
VISION_TIMEOUT_S = 60
IMAGE_TIMEOUT_S = 120


async def image_content(client, contents):
    """One image-generation call: MODEL_IMAGE first, the fallback once Google has retired it."""
    global _image_model_gone
    model = image_model()
    try:
        return await asyncio.wait_for(client.aio.models.generate_content(model=model, contents=contents), IMAGE_TIMEOUT_S)
    except Exception as e:
        if model != MODEL_IMAGE or not _model_gone(e):
            raise
        _image_model_gone = True
        log.warning("%s is gone (%s); using %s from now on", MODEL_IMAGE, e, MODEL_IMAGE_FALLBACK)
        return await asyncio.wait_for(client.aio.models.generate_content(model=MODEL_IMAGE_FALLBACK, contents=contents), IMAGE_TIMEOUT_S)


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


# --- 360 "on body" views ---------------------------------------------------------------

SIDE_RULE = ("Prints sit on the front and back faces, so from the side only their edges may show; "
             "never copy a print onto the sleeve or side.")

NO_BACK_BLOCK = ("There is no image of the back. Show a plain back in the same fabric and color; "
                 "do not invent prints, text or details on it.\n")

# With no back photo there is nothing to match: the back must stay plain, never a copy of the front.
BACK_VIEW_WITHOUT_PHOTO = ("VIEW: straight-on BACK view (180 degrees). No image of the back exists: show a plain back "
                           "in the same fabric and color, with no prints, text or details.")

ANCHOR_LABELS = {
    "front": ("Already rendered as a ghost mannequin — FRONT view. Use it only for volume, fit and proportions; "
              "it does not show the back:"),
    "back": "Already rendered as a ghost mannequin — BACK view. Use it only for volume, fit and proportions:",
}


def _view_block(view: str, refs) -> str:
    if view == "front":
        return "VIEW: straight-on FRONT view (0 degrees). Show the front exactly as in the FRONT references."
    if view == "back":
        if refs.back is None:
            return BACK_VIEW_WITHOUT_PHOTO
        printed = (f' The back print "{refs.back.text}" must be fully visible, letter for letter, in the same size '
                   "and position." if refs.back.text else "")
        return ("VIEW: straight-on BACK view (180 degrees). Reproduce the BACK references exactly." + printed +
                " Do not copy the front print onto the back.")
    side = "RIGHT" if view == "right" else "LEFT"
    angle = 90 if view == "right" else 270
    return (f"VIEW: exact {side} SIDE profile ({angle} degrees): we see the garment's {view} side, the side seam "
            f"and {view} sleeve. {SIDE_RULE}")


def _prints_block(refs) -> str:
    front = f'"{refs.front.text}"' if refs.front.text else "plain, no print"
    lines = [f"PRINTS — FRONT: {front} (as in the FRONT references)."]
    if refs.back is not None:
        back = f'"{refs.back.text}"' if refs.back.text else "plain, no print"
        lines.append(f"PRINTS — BACK: {back} (as in the BACK references, as large and centered as photographed).")
    return "\n".join(lines) + "\n"


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

    def _log(self, stage, model, prompt_version, start, status, error=None, response=None):
        """One model call for run_log.jsonl / ai_calls: latency, tokens, images, estimated cost, fallback.
        `error` is the exception (its class is kept everywhere; its text only in the local file)."""
        if not self.logger:
            return
        tin, tout, images = _usage(response)
        self.logger.log(stage=stage, model=model, prompt_version=prompt_version,
                         latency_ms=(time.monotonic() - start) * 1000, status=status,
                         error=None if error is None else str(error)[:500],
                         error_class=None if error is None or isinstance(error, str) else type(error).__name__,
                         input_tokens=tin, output_tokens=tout, images_out=images,
                         cost_usd=costs.estimate_usd(model, tin, tout, images or 0) if response is not None else None,
                         fallback=model == MODEL_IMAGE_FALLBACK)

    def _log_usage(self, stage, prompt_version, usage):
        """Outfit calls are made in pipeline/outfit.py, which keeps each one in a Usage; log them one by one."""
        if not self.logger:
            return
        for call in usage.calls:
            self.logger.log(stage=f"{stage}_{call['kind']}", model=call["model"], prompt_version=prompt_version,
                             latency_ms=call["latency_s"] * 1000, status="ok" if call["ok"] else "error",
                             error_class=call.get("error_class"), cost_usd=call["usd"] if call["ok"] else None,
                             input_tokens=call.get("input_tokens"), output_tokens=call.get("output_tokens"),
                             images_out=call.get("images_out"), fallback=call["model"] == MODEL_IMAGE_FALLBACK)

    async def detect_items_with_facts(self, image_path: str) -> list[DetectedItemWithFacts]:
        start = time.monotonic()
        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()
            prompt = _read_prompt("stage1_detect_facts_v4.txt")
            # The sync client in a thread, so the server keeps answering while detection runs.
            response = await asyncio.wait_for(asyncio.to_thread(
                self.client.models.generate_content,
                model=MODEL_VISION,
                contents=[{"inline_data": {"mime_type": "image/jpeg", "data": image_bytes}}, prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json",
                                                    response_schema=list[_RawDetection]),
            ), VISION_TIMEOUT_S)
            # Same decode as crop_item, so box pixels line up with the crop.
            height, width = cv2.imread(image_path).shape[:2]
            items = []
            for raw in json.loads(response.text):
                detection = _RawDetection.model_validate(raw)
                fields = detection.model_dump(exclude={"box_2d"})
                fields["cut_off_by_frame"] = detection.cut_off_by_frame or touches_frame(detection.box_2d)
                items.append(DetectedItemWithFacts(**fields, box=box_2d_to_bbox(detection.box_2d, width, height)))
            self._log("stage1_detect_facts", MODEL_VISION, "v4", start, "ok", response=response)
            return items
        except Exception as e:
            self._log("stage1_detect_facts", MODEL_VISION, "v4", start, "error", e)
            raise

    async def detect_outfit(self, image_path: str):
        """Outfit Photo Stage 1: garments worn by the person, as candidates (pipeline/outfit.py)."""
        from pipeline import outfit
        usage = outfit.Usage()
        try:
            return await outfit.detect_candidates(self.client, image_path, usage)
        finally:
            self._log_usage("outfit", outfit.DETECT_PROMPT, usage)

    async def generate_outfit(self, image_path: str, scan, candidate_ids: list[str], out_dir: str) -> dict[str, dict]:
        """Outfit Photo Stage 2: catalog images for the picked candidates only (pipeline/outfit.py)."""
        from pipeline import outfit
        usage = outfit.Usage()
        try:
            return await outfit.generate_selected(self.client, image_path, scan, candidate_ids, out_dir, usage)
        finally:
            self._log_usage("outfit", outfit.GENERATE_PROMPT, usage)

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
            response = await image_content(
                self.client, [{"inline_data": {"mime_type": "image/png", "data": crop_bytes}}, prompt])
            out_path = crop_path.rsplit(".", 1)[0] + "_generated.png"
            # Newer image models can put a short text part before the image.
            image_bytes = next(p.inline_data.data for p in response.candidates[0].content.parts
                               if p.inline_data is not None)
            with open(out_path, "wb") as f:
                f.write(image_bytes)
            self._log("stage4_generate", image_model(), "v5", start, "ok", response=response)
            return out_path
        except Exception as e:
            self._log("stage4_generate", image_model(), "v5", start, "error", e)
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
            response = await image_content(
                self.client,
                [
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
            self._log("stage4_generate_back", image_model(), "v2", start, "ok", response=response)
            return out_path
        except Exception as e:
            self._log("stage4_generate_back", image_model(), "v2", start, "error", e)
            raise

    async def generate_view(self, refs, view: str, anchors: dict[str, str],
                            retry_note: str | None = None) -> bytes:
        start = time.monotonic()
        try:
            contents: list = []
            # Each view sees only its own side: shown both sides, the model copied the wrong one.
            # The back gets every back image (the photo carries the print best); the front and the
            # profiles get the front catalog image, whose raw photo the model copied verbatim.
            if view == "back" and refs.back is not None:
                if refs.back.catalog:
                    contents += ["Reference — BACK, flat-lay catalog image:", _png_part(refs.back.catalog)]
                if refs.back.photo:
                    contents += ["Reference — BACK, original photo:", _png_part(refs.back.photo)]
            elif refs.front.catalog:
                contents += ["Reference — FRONT, flat-lay catalog image:", _png_part(refs.front.catalog)]
            for name, path in anchors.items():
                contents += [ANCHOR_LABELS[name], _png_part(path)]
            contents.append(_read_prompt("turn_view_v2.txt").format(
                prints_block=_prints_block(refs),
                back_block="" if refs.back is not None else NO_BACK_BLOCK,
                view_block=_view_block(view, refs),
                retry_block="\n" + retry_note if retry_note else ""))
            # Async client: the 360 job runs in the background while the app polls the same server.
            response = await image_content(self.client, contents)
            data = next(p.inline_data.data for p in response.candidates[0].content.parts
                        if p.inline_data is not None)
            self._log("turn_view", image_model(), "v2", start, "ok", response=response)
            return data
        except Exception as e:
            self._log("turn_view", image_model(), "v2", start, "error", e)
            raise
