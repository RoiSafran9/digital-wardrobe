import cv2
from pipeline.types import BBox


def crop(image_path: str, box: BBox) -> str:
    image = cv2.imread(image_path)
    x, y, w, h = int(box.x), int(box.y), int(box.width), int(box.height)
    cropped = image[y:y + h, x:x + w]
    if cropped.size == 0:
        raise ValueError(f"empty crop for box {box} on image {image_path}")
    crop_path = image_path.rsplit(".", 1)[0] + f"_crop_{x}_{y}.png"
    cv2.imwrite(crop_path, cropped)
    return crop_path
