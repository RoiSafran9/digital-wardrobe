"""EXPERIMENTAL (M0 proof of concept): garments from a photo of a person wearing them.

Not wired into the app, the API or the worker. Used only by scripts/outfit_poc.py so the two-stage
Outfit Photo flow (docs/superpowers/specs/2026-10-19-outfit-photo-two-step-design.md) can be measured
before anything is built. The garment-photo flow (orchestrator.run_photo and its v4/v5 prompts) is
untouched.

Stage 1: detect_candidates — one cheap vision call → candidates with stable IDs, boxes, and preview
crops cut from the real photo (no image generation). Stage 2: generate_selected — the image model
runs only for the candidate IDs the user picked.
"""
import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Literal
import cv2
from pydantic import BaseModel
from pipeline.providers.gemini import MODEL_IMAGE, MODEL_VISION, _read_prompt, touches_frame
from pipeline.stages import cutout, stage5_verify
from pipeline.types import BBox, FactField, ItemFacts

DETECT_PROMPT = "outfit_detect_v3.txt"
GENERATE_PROMPT = "outfit_generate_v3.txt"
REVIEW_PROMPT = "outfit_review_v1.txt"

# Paid-tier list prices (ai.google.dev/gemini-api/docs/pricing, read 2026-10-19), for the PoC report only.
VISION_USD_PER_M_IN, VISION_USD_PER_M_OUT = 0.25, 1.50
IMAGE_USD_PER_IMAGE, IMAGE_USD_PER_M_IN = 0.039, 0.30
# Other image models compared in the PoC (USD per 1K output image, per 1M input tokens).
IMAGE_PRICES = {MODEL_IMAGE: (IMAGE_USD_PER_IMAGE, IMAGE_USD_PER_M_IN),
                "gemini-3.1-flash-image": (0.067, 0.50),
                "gemini-nano-banana-2.1": (0.0336, 1.50)}

# Preview crops get more context than the catalog crop: the user has to recognise the piece on the body.
PREVIEW_PADDING = 0.08
OUTLINE_BGR = (60, 200, 60)
CONTEXT_BLOCK = " Image 2 is the whole photo, with that garment marked by a green outline, for context only."

CALL_TIMEOUT_S = 120

SceneKind = Literal["worn", "flat", "mixed", "none"]


class _GarmentFields(BaseModel):
    category: str
    layer: Literal["outer", "inner", "single"]
    colors: list[str]
    pattern: str
    visible_text: str
    description: str
    visible_parts: list[str]
    hidden_parts: list[str]
    visibility: Literal["full", "partial", "low"]
    uncertainty: str


class _RawCandidate(_GarmentFields):
    box_2d: list[int]


class _RawScan(BaseModel):
    scene_kind: SceneKind
    person_count: int
    candidates: list[_RawCandidate]


class OutfitCandidate(_GarmentFields):
    id: str  # stable within its scan: c1, c2, … top to bottom
    box: BBox  # pixels on the original photo, unpadded
    cut_off_by_frame: bool


class OutfitScan(BaseModel):
    scene_kind: SceneKind
    person_count: int
    candidates: list[OutfitCandidate]


def _pixels(box_2d: list[int], width: int, height: int) -> BBox | None:
    if len(box_2d) != 4:
        return None
    ymin, xmin, ymax, xmax = (min(max(v, 0), 1000) for v in box_2d)
    if ymax - ymin < 5 or xmax - xmin < 5:  # degenerate box: nothing to show or crop
        return None
    return BBox(x=xmin / 1000 * width, y=ymin / 1000 * height,
                width=(xmax - xmin) / 1000 * width, height=(ymax - ymin) / 1000 * height)


def parse_scan(raw: dict, width: int, height: int) -> OutfitScan:
    """Model JSON → candidates with IDs that don't depend on the model's list order."""
    scan = _RawScan.model_validate(raw)
    placed = []
    for c in scan.candidates:
        box = _pixels(c.box_2d, width, height)
        if box is not None:
            placed.append((c, box))
    placed.sort(key=lambda p: (round(p[1].y), round(p[1].x)))
    candidates = [OutfitCandidate(**c.model_dump(exclude={"box_2d"}), id=f"c{i}", box=box,
                                  cut_off_by_frame=touches_frame(c.box_2d))
                  for i, (c, box) in enumerate(placed, start=1)]
    return OutfitScan(scene_kind=scan.scene_kind, person_count=scan.person_count, candidates=candidates)


def _padded(box: BBox, width: int, height: int, padding: float) -> tuple[int, int, int, int]:
    px, py = box.width * padding, box.height * padding
    x0, y0 = max(0, int(box.x - px)), max(0, int(box.y - py))
    x1, y1 = min(width, int(box.x + box.width + px)), min(height, int(box.y + box.height + py))
    return x0, y0, x1, y1


def preview_crop(image_path: str, candidate: OutfitCandidate, out_path: str, padding: float = PREVIEW_PADDING) -> str:
    """The Stage 1 preview: a crop of the real photo. May still show skin or other garments."""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"cannot read image: {image_path}")
    x0, y0, x1, y1 = _padded(candidate.box, image.shape[1], image.shape[0], padding)
    crop = image[y0:y1, x0:x1]
    if crop.size == 0:
        raise ValueError(f"empty crop for candidate {candidate.id}")
    cv2.imwrite(out_path, crop)
    return out_path


def outlined(image_path: str, candidates: list[OutfitCandidate], out_path: str, labels: bool = True) -> str:
    """The photo with candidate boxes drawn on it (preview overlay, and context for generation)."""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"cannot read image: {image_path}")
    thickness = max(2, round(max(image.shape[:2]) / 300))
    for c in candidates:
        x0, y0 = int(c.box.x), int(c.box.y)
        cv2.rectangle(image, (x0, y0), (int(c.box.x + c.box.width), int(c.box.y + c.box.height)), OUTLINE_BGR, thickness)
        if labels:
            cv2.putText(image, f"{c.id} {c.category}", (x0 + thickness, y0 + 12 * thickness), cv2.FONT_HERSHEY_SIMPLEX,
                        thickness / 3, OUTLINE_BGR, max(1, thickness // 2), cv2.LINE_AA)
    cv2.imwrite(out_path, image)
    return out_path


# An edge column/row this dark and this uniform is a letterbox bar, not garment.
BAR_MAX_LEVEL, BAR_MAX_SPREAD = 25, 6


def whiten_bars(path: str) -> bool:
    """Local and free: the image model sometimes returns the garment between black bars. Paint uniform
    dark edge bars white so the closet tile and cutout see a white background. True if it changed anything."""
    image = cv2.imread(path)
    if image is None:
        return False
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    changed = False
    for axis in (0, 1):  # columns from the left/right, rows from the top/bottom
        lines = gray if axis == 1 else gray.T
        for order in (range(lines.shape[1]), range(lines.shape[1] - 1, -1, -1)):
            for i in order:
                line = lines[:, i]
                if line.max() > BAR_MAX_LEVEL or line.max() - line.min() > BAR_MAX_SPREAD:
                    break
                if axis == 1:
                    image[:, i] = 255
                else:
                    image[i, :] = 255
                changed = True
    if changed:
        cv2.imwrite(path, image)
    return changed


def facts_for(candidate: OutfitCandidate) -> ItemFacts:
    """The candidate as the ItemFacts the closet and stage5_verify already understand."""
    def f(value, basis="observed"):
        return FactField(value=value, confidence=0.5 if candidate.visibility == "low" else 0.8, basis=basis)
    return ItemFacts(category=f(candidate.category), colors=f(candidate.colors), pattern=f(candidate.pattern),
                     visible_text=f(candidate.visible_text), trims=f("not visible", "inferred"),
                     visible_parts=f(candidate.visible_parts), occluded_parts=f(candidate.hidden_parts, "inferred"))


def facts_block(candidate: OutfitCandidate) -> str:
    return json.dumps(candidate.model_dump(include=set(_GarmentFields.model_fields)), indent=2, ensure_ascii=False)


@dataclass
class Usage:
    """Paid calls made, for the report. Costs are estimates from list prices and returned token counts."""
    calls: list[dict] = field(default_factory=list)

    def add(self, kind: str, model: str, latency_s: float, usd: float, ok: bool):
        self.calls.append({"kind": kind, "model": model, "latency_s": round(latency_s, 2), "usd": round(usd, 5), "ok": ok})

    @property
    def usd(self) -> float:
        return round(sum(c["usd"] for c in self.calls), 6)


def _tokens(response) -> tuple[int, int]:
    meta = getattr(response, "usage_metadata", None)
    return (getattr(meta, "prompt_token_count", 0) or 0, getattr(meta, "candidates_token_count", 0) or 0)


def _image_part(path: str) -> dict:
    mime = "image/png" if path.lower().endswith(".png") else "image/jpeg"
    with open(path, "rb") as f:
        return {"inline_data": {"mime_type": mime, "data": f.read()}}


def _first_image(response) -> bytes:
    return next(p.inline_data.data for p in response.candidates[0].content.parts if p.inline_data is not None)


async def detect_candidates(client, image_path: str, usage: Usage) -> OutfitScan:
    """Stage 1: one vision call (flash-lite, the model the garment flow already uses)."""
    start = time.monotonic()
    ok, usd = False, 0.0
    try:
        from google.genai import types
        response = await client.aio.models.generate_content(
            model=MODEL_VISION, contents=[_image_part(image_path), _read_prompt(DETECT_PROMPT)],
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=_RawScan))
        tin, tout = _tokens(response)
        usd = tin / 1e6 * VISION_USD_PER_M_IN + tout / 1e6 * VISION_USD_PER_M_OUT
        height, width = cv2.imread(image_path).shape[:2]
        scan = parse_scan(json.loads(response.text), width, height)
        ok = True
        return scan
    finally:
        usage.add("detect", MODEL_VISION, time.monotonic() - start, usd, ok)


async def generate_flatlay(client, crop_path: str, context_path: str | None, candidate: OutfitCandidate,
                           violations: list[str] | None, out_path: str, usage: Usage,
                           prompt_name: str = GENERATE_PROMPT, model: str = MODEL_IMAGE) -> str:
    """Stage 2 for one selected candidate. context_path (the photo with this candidate outlined) is optional."""
    start = time.monotonic()
    ok, usd = False, 0.0
    try:
        violations_block = "\nPrevious attempt violations to fix:\n" + "\n".join(violations) if violations else ""
        prompt = _read_prompt(prompt_name).format(facts_block=facts_block(candidate), violations_block=violations_block,
                                                      context_block=CONTEXT_BLOCK if context_path else "")
        contents = ["Image 1:", _image_part(crop_path)]
        if context_path:
            contents += ["Image 2:", _image_part(context_path)]
        # A hung request once never came back (PoC run, 2026-10-19): give up and count it as failed.
        response = await asyncio.wait_for(
            client.aio.models.generate_content(model=model, contents=contents + [prompt]), CALL_TIMEOUT_S)
        tin, _ = _tokens(response)
        data = _first_image(response)
        per_image, per_m_in = IMAGE_PRICES[model]
        usd = per_image + tin / 1e6 * per_m_in
        with open(out_path, "wb") as f:
            f.write(data)
        ok = True
        return out_path
    finally:
        usage.add("generate", model, time.monotonic() - start, usd, ok)


async def generate_selected(client, image_path: str, scan: OutfitScan, selected: list[str], out_dir: str,
                            usage: Usage, with_context: bool = True, max_attempts: int = 2,
                            prompt_name: str = GENERATE_PROMPT, model: str = MODEL_IMAGE) -> dict[str, dict]:
    """Stage 2: generate ONLY the selected candidate IDs; one failure never stops the others.
    Unknown IDs are refused before any paid call."""
    by_id = {c.id: c for c in scan.candidates}
    unknown = [cid for cid in selected if cid not in by_id]
    if unknown:
        raise ValueError(f"unknown candidate ids: {unknown}")
    results: dict[str, dict] = {}
    for cid in dict.fromkeys(selected):  # a repeated ID is generated once
        c = by_id[cid]
        item_dir = os.path.join(out_dir, cid)
        os.makedirs(item_dir, exist_ok=True)
        crop = preview_crop(image_path, c, os.path.join(item_dir, "crop.png"), padding=0.03)
        context = outlined(image_path, [c], os.path.join(item_dir, "context.jpg"), labels=False) if with_context else None
        violations, verification, generated = None, None, None
        for attempt in range(1, max_attempts + 1):
            try:
                generated = await generate_flatlay(client, crop, context, c, violations,
                                                   os.path.join(item_dir, f"generated_{attempt}.png"), usage, prompt_name, model)
            except Exception as e:
                results[cid] = {"status": "failed", "error": str(e)[:200]}
                generated = None
                break
            verification = await stage5_verify.run(crop, generated, facts_for(c), attempt)
            if verification.status == "pass":
                break
            violations = verification.violations
        if generated:
            final = os.path.join(item_dir, "generated.png")
            os.replace(generated, final)
            whiten_bars(final)
            cutout.run(final, os.path.join(item_dir, "cutout.png"))
            results[cid] = {"status": "generated", "attempts": attempt,
                            "verification": verification.model_dump() if verification else None}
    return results


class Review(BaseModel):
    """A cheap vision check of one generated image against the worn photo (flash-lite, ~$0.0005)."""
    color_match: bool
    color_note: str
    invented: list[str]
    missing: list[str]
    other_garment: bool
    verdict: Literal["ok", "minor", "wrong"]


async def review_flatlay(client, crop_path: str, generated_path: str, candidate: OutfitCandidate, usage: Usage) -> Review:
    """EXPERIMENTAL: flags color drift and invented details that the local color/OCR checks cannot see."""
    start = time.monotonic()
    ok, usd = False, 0.0
    try:
        from google.genai import types
        prompt = _read_prompt(REVIEW_PROMPT).format(category=candidate.category, description=candidate.description)
        response = await asyncio.wait_for(client.aio.models.generate_content(
            model=MODEL_VISION, contents=["Image 1:", _image_part(crop_path), "Image 2:", _image_part(generated_path), prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Review)),
            CALL_TIMEOUT_S)
        tin, tout = _tokens(response)
        usd = tin / 1e6 * VISION_USD_PER_M_IN + tout / 1e6 * VISION_USD_PER_M_OUT
        review = Review.model_validate_json(response.text)
        ok = True
        return review
    finally:
        usage.add("review", MODEL_VISION, time.monotonic() - start, usd, ok)
