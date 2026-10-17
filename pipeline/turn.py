"""The 360 "on body" view: four ghost-mannequin angles of an item, generated from all its images.

Each view sees only the images of its own side plus the printed text of each side: the back is
drawn from every back image (catalog and photo), the front and profiles from the front catalog
image, with the front ghost anchoring the profiles' volume. Shown both sides at once, the model
copied the wrong side onto the view.
Each view is cut out locally like every other garment image.
"""
import asyncio
import os
from dataclasses import dataclass
import cv2
import numpy as np
from pipeline.stages import cutout
from pipeline.types import ItemFacts

TURN_ORDER = ("front", "right", "back", "left")      # how the app turns through them
GENERATION_ORDER = ("front", "back", "right", "left")

# Per model call. Five of these (four views plus at most one retry) stay near the API's
# 5-minute stale window, so a job that hangs fails on its own.
VIEW_TIMEOUT_SECONDS = 55

# A back photo with at least this much print, rendered with less than this share of it, lost its print.
PRINTED = 0.01
KEPT_SHARE = 0.3
RETRY_NOTE = ("The previous attempt left the back plain. The back print from the BACK references is mandatory: "
              "show it fully, letter for letter, in the same size and position.")


class TurnFailed(Exception):
    """The 360 view couldn't be made; the message is shown to the user."""


@dataclass(frozen=True)
class SideRef:
    catalog: str | None   # the generated flat-lay image of this side
    photo: str | None     # the owner's original photo crop of this side
    text: str             # printed text on this side, as detected ("" when plain)


@dataclass(frozen=True)
class TurnRefs:
    front: SideRef
    back: SideRef | None


def _existing(path: str) -> str | None:
    return path if os.path.exists(path) else None


def _text(facts_path: str) -> str:
    try:
        with open(facts_path) as f:
            value = ItemFacts.model_validate_json(f.read()).visible_text.value
    except (OSError, ValueError):
        return ""
    return " ".join(value) if isinstance(value, list) else value


def refs_for_item(item_dir: str) -> TurnRefs:
    """Everything we know about how the item looks, side by side."""
    front = SideRef(catalog=_existing(os.path.join(item_dir, "generated.png")),
                    photo=_existing(os.path.join(item_dir, "crop.png")),
                    text=_text(os.path.join(item_dir, "facts.json")))
    back_dir = os.path.join(item_dir, "back")
    back = None
    if os.path.exists(os.path.join(back_dir, "generated.png")):
        back = SideRef(catalog=os.path.join(back_dir, "generated.png"),
                       photo=_existing(os.path.join(back_dir, "crop.png")),
                       text=_text(os.path.join(back_dir, "facts.json")))
    return TurnRefs(front=front, back=back)


def ink_fraction(path: str) -> float:
    """Share of the image that is print-like: saturated color or dark ink (a white background isn't)."""
    image = cv2.imread(path)
    if image is None:
        return 0.0
    image = cv2.resize(image, (128, 128), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    sat, val = hsv[..., 1], hsv[..., 2]
    ink = ((sat > 60) & (val > 40)) | (val < 100)
    return float(np.count_nonzero(ink)) / ink.size


def _lost_the_print(refs: TurnRefs, generated: str) -> bool:
    if refs.back is None or not refs.back.catalog:
        return False
    reference = ink_fraction(refs.back.catalog)
    return reference >= PRINTED and ink_fraction(generated) < KEPT_SHARE * reference


async def _generate(imagegen, refs: TurnRefs, view: str, anchors: dict[str, str], path: str,
                    retry_note: str | None = None) -> None:
    try:
        data = await asyncio.wait_for(imagegen.generate_view(refs, view, anchors, retry_note), VIEW_TIMEOUT_SECONDS)
    except Exception as e:
        raise TurnFailed("couldn't create the 360 view — try again") from e
    with open(path, "wb") as f:
        f.write(data)


async def run_turn(refs: TurnRefs, out_dir: str, imagegen) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    path = {view: os.path.join(out_dir, f"{view}.png") for view in TURN_ORDER}
    for view in GENERATION_ORDER:
        # The front ghost sets volume and proportions for the profiles, and for a back we have to
        # imagine. A photographed back is drawn from its own photos alone (beside the front ghost
        # the model copied the front onto it), and the back ghost anchors nothing (its print
        # leaked onto the sleeves).
        if view == "front" or (view == "back" and refs.back is not None):
            anchors = {}
        else:
            anchors = {"front": path["front"]}
        await _generate(imagegen, refs, view, anchors, path[view])
        if view == "back" and _lost_the_print(refs, path["back"]):
            await _generate(imagegen, refs, view, anchors, path[view], RETRY_NOTE)
        cutout.run(path[view], os.path.join(out_dir, f"{view}_cutout.png"))
    return [path[view] for view in TURN_ORDER]
