import cv2
import numpy as np
import pytesseract
from pipeline.types import ItemFacts, VerificationResult

COLOR_DISTANCE_THRESHOLD = 20.0


# Pixels at least this bright in every channel count as the generated image's white background.
WHITE_LEVEL = 240
# Dominant colors looked for in the crop, and the smallest share one needs to count.
CROP_COLOR_GROUPS = 4
MIN_GROUP_SHARE = 0.10


def _read(image_path: str):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"cannot read image: {image_path}")
    return img


def _downsample(img):
    # Color statistics don't need full resolution.
    scale = min(1.0, 120 / max(img.shape[:2]))
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA) if scale < 1.0 else img


def _lab_pixels(img) -> np.ndarray:
    # OpenCV's Lab (float input: L 0-100, a/b about ±127, same scale as skimage) — not
    # skimage.rgb2lab, whose large BLAS matmul segfaulted the API server mid-run.
    return cv2.cvtColor(img.astype(np.float32) / 255.0, cv2.COLOR_BGR2Lab).reshape(-1, 3)


def _garment_lab(generated_path: str) -> np.ndarray:
    """Mean color of the generated garment, ignoring its white background."""
    img = _downsample(_read(generated_path))
    lab = _lab_pixels(img)
    garment = img.reshape(-1, 3).min(axis=1) < WHITE_LEVEL
    # A white garment on white leaves no mask; then the whole image is the best we have.
    return lab[garment].mean(axis=0) if garment.mean() > 0.01 else lab.mean(axis=0)


def _crop_color_groups(crop_path: str) -> list[np.ndarray]:
    """Main colors in the crop. In a pile the crop also holds bedding and neighbouring
    garments, so the item is one of these groups rather than the crop's average."""
    lab = _lab_pixels(_downsample(_read(crop_path))).astype(np.float32)
    # The overall average still counts: it is the right target when one garment fills the crop.
    groups = [lab.mean(axis=0)]
    k = min(CROP_COLOR_GROUPS, len(np.unique(lab.round(), axis=0)))
    if k <= 1:
        return groups
    cv2.setRNGSeed(0)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _, labels, centers = cv2.kmeans(lab, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    shares = np.bincount(labels.ravel(), minlength=k) / len(labels)
    return groups + [centers[i] for i in range(k) if shares[i] >= MIN_GROUP_SHARE]


def _color_distance(crop_path: str, generated_path: str) -> float:
    garment = _garment_lab(generated_path)
    return float(min(np.linalg.norm(garment - group) for group in _crop_color_groups(crop_path)))


def _normalize_text(text: str) -> str:
    return "".join(ch for ch in text.upper() if ch.isalnum())


def _text_found(image_path: str, expected: str) -> bool:
    """OCR upright and turned both ways, so vertical prints are read too."""
    img = _read(image_path)
    target = _normalize_text(expected)
    for view in (img, cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE), cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)):
        if target in _normalize_text(pytesseract.image_to_string(view)):
            return True
    return False


async def run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int) -> VerificationResult:
    violations: list[str] = []

    distance = _color_distance(crop_path, generated_path)
    if distance > COLOR_DISTANCE_THRESHOLD:
        violations.append(f"color shift detected (Lab distance {distance:.1f})")

    expected_text = facts.visible_text.value
    if expected_text:
        if not _text_found(generated_path, expected_text):
            violations.append(f"expected text '{expected_text}' not found in generated image")

    status = "fail" if violations else "pass"
    return VerificationResult(status=status, violations=violations, attempt=attempt)
