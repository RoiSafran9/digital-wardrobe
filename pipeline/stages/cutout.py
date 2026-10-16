import threading
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


def run(generated_path: str, out_path: str) -> str | None:
    """Write a transparent-background, trimmed PNG of the garment.

    Returns out_path, or None when the cutout looks wrong or fails — callers
    then fall back to the white-background image.
    """
    try:
        image = Image.open(generated_path).convert("RGB")
        cut = _remove(image).convert("RGBA")
        alpha = np.asarray(cut.getchannel("A"))
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
