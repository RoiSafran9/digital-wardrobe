import numpy as np
import cv2
from pipeline.stages.crop_item import crop
from pipeline.types import BBox


def test_crop_writes_file_of_expected_size(tmp_path):
    img = np.zeros((20, 20, 3), dtype=np.uint8)
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), img)

    crop_path = crop(str(img_path), BBox(x=2, y=3, width=10, height=5))

    result = cv2.imread(crop_path)
    assert result.shape[:2] == (5, 10)
