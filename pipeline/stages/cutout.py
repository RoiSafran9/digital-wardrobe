import threading
import cv2
import numpy as np
from PIL import Image

# Local background removal (rembg); runs on this machine, no API call.
MODEL = "isnet-general-use"
# Margin kept around the garment after trimming, as a fraction of its size.
TRIM_PADDING = 0.04
# A believable cutout keeps between these fractions of the image opaque.
MIN_COVERAGE = 0.03
MAX_COVERAGE = 0.97

_session = None
_session_lock = threading.Lock()


def _remove(image: Image.Image) -> Image.Image:
    # Imported lazily and cached: loading onnxruntime and the model is slow.
    global _session
    from rembg import new_session, remove
    with _session_lock:  # items run in parallel threads; load the model once
        if _session is None:
            _session = new_session(MODEL)
    return remove(image, session=_session)


def _solidify(alpha: np.ndarray) -> np.ndarray:
    """Make everything inside the garment's outline opaque.

    Background removal on a white backdrop also clears white parts of the garment itself
    (white stripes, collars, prints). Only the outside of the outline is background, so
    holes inside it are filled; the rim keeps its soft, anti-aliased edge.
    """
    h, w = alpha.shape
    mask = (alpha > 16).astype(np.uint8)
    # Bridge stripe ends that broke the outline, so the outline stays one closed shape.
    k = max(3, int(0.02 * max(h, w))) | 1
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    big = [c for c in contours if cv2.contourArea(c) >= 0.01 * h * w]
    cv2.drawContours(filled, big, -1, 1, thickness=cv2.FILLED)
    interior = cv2.erode(filled, np.ones((3, 3), np.uint8), iterations=2)
    return np.where(interior == 1, 255, alpha).astype(np.uint8)


def run(generated_path: str, out_path: str) -> str | None:
    """Write a transparent-background, trimmed PNG of the garment.

    Returns out_path, or None when the cutout looks wrong or fails — callers
    then fall back to the white-background image.
    """
    try:
        image = Image.open(generated_path).convert("RGB")
        cut = _remove(image).convert("RGBA")
        alpha = _solidify(np.asarray(cut.getchannel("A")))
        cut.putalpha(Image.fromarray(alpha))
        coverage = float((alpha > 128).mean())
        if not MIN_COVERAGE <= coverage <= MAX_COVERAGE:
            return None

        ys, xs = np.nonzero(alpha > 16)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        pad = int(max(x1 - x0, y1 - y0) * TRIM_PADDING)
        box = (max(0, x0 - pad), max(0, y0 - pad), min(cut.width, x1 + pad), min(cut.height, y1 + pad))
        cut.crop(box).save(out_path)
        return out_path
    except Exception:
        return None
