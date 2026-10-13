import numpy as np
import cv2
import pytest
from pipeline.stages.stage0_quality import run


def _write(tmp_path, name, arr):
    path = str(tmp_path / name)
    cv2.imwrite(path, arr)
    return path


def test_ok_image(tmp_path):
    arr = (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8)
    path = _write(tmp_path, "ok.png", arr)
    result = run(path)
    assert result.status == "ok"


def test_too_dark(tmp_path):
    arr = np.full((1000, 1000, 3), 5, dtype=np.uint8)
    path = _write(tmp_path, "dark.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "too_dark"


def test_low_resolution(tmp_path):
    arr = (np.random.rand(200, 200, 3) * 255).astype(np.uint8)
    path = _write(tmp_path, "small.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "low_resolution"


def test_blurry(tmp_path):
    arr = np.full((1000, 1000, 3), 128, dtype=np.uint8)
    path = _write(tmp_path, "flat.png", arr)
    result = run(path)
    assert result.status == "retake" and result.reason == "blurry"


def test_unreadable_file_raises(tmp_path):
    path = str(tmp_path / "not_an_image.png")
    with open(path, "w") as f:
        f.write("garbage")
    with pytest.raises(ValueError, match="cannot read image"):
        run(path)
