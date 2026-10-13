import cv2
from pipeline.types import QualityCheckResult

BLUR_THRESHOLD = 100.0
DARK_THRESHOLD = 50.0
MIN_RESOLUTION = 800


def run(image_path: str) -> QualityCheckResult:
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"cannot read image: {image_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    if min(h, w) < MIN_RESOLUTION:
        return QualityCheckResult(status="retake", reason="low_resolution")
    if gray.mean() < DARK_THRESHOLD:
        return QualityCheckResult(status="retake", reason="too_dark")
    if cv2.Laplacian(gray, cv2.CV_64F).var() < BLUR_THRESHOLD:
        return QualityCheckResult(status="retake", reason="blurry")
    return QualityCheckResult(status="ok")
