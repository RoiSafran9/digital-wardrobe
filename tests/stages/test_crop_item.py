import numpy as np
import cv2
import pytest
from pipeline.stages.crop_item import crop
from pipeline.types import BBox


def test_crop_writes_file_of_expected_size(tmp_path):
    img = np.zeros((20, 20, 3), dtype=np.uint8)
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), img)

    crop_path = crop(str(img_path), BBox(x=2, y=3, width=10, height=5))

    result = cv2.imread(crop_path)
    assert result.shape[:2] == (5, 10)


def test_crop_clamps_box_that_extends_past_image_edges(tmp_path):
    img = np.zeros((20, 20, 3), dtype=np.uint8)
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), img)

    crop_path = crop(str(img_path), BBox(x=15, y=15, width=10, height=10))

    result = cv2.imread(crop_path)
    assert result.shape[:2] == (5, 5)


def test_crop_raises_on_box_entirely_outside_image(tmp_path):
    img = np.zeros((20, 20, 3), dtype=np.uint8)
    img_path = tmp_path / "photo.jpg"
    cv2.imwrite(str(img_path), img)

    with pytest.raises(ValueError, match="empty crop"):
        crop(str(img_path), BBox(x=100, y=100, width=10, height=10))
