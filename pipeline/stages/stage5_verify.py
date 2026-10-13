import cv2
import numpy as np
import pytesseract
from skimage.color import rgb2lab
from pipeline.types import ItemFacts, VerificationResult

COLOR_DISTANCE_THRESHOLD = 20.0


def _mean_lab(image_path: str):
    img = cv2.imread(image_path)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) / 255.0
    lab = rgb2lab(rgb)
    return lab.reshape(-1, 3).mean(axis=0)


def _color_distance(crop_path: str, generated_path: str) -> float:
    lab_a = _mean_lab(crop_path)
    lab_b = _mean_lab(generated_path)
    return float(np.linalg.norm(lab_a - lab_b))


def _ocr_text(image_path: str) -> str:
    img = cv2.imread(image_path)
    return pytesseract.image_to_string(img).strip()


async def run(crop_path: str, generated_path: str, facts: ItemFacts, attempt: int) -> VerificationResult:
    violations: list[str] = []

    distance = _color_distance(crop_path, generated_path)
    if distance > COLOR_DISTANCE_THRESHOLD:
        violations.append(f"color shift detected (Lab distance {distance:.1f})")

    expected_text = facts.visible_text.value
    if expected_text:
        found_text = _ocr_text(generated_path)
        if expected_text not in found_text:
            violations.append(f"expected text '{expected_text}' not found in generated image")

    status = "fail" if violations else "pass"
    return VerificationResult(status=status, violations=violations, attempt=attempt)
