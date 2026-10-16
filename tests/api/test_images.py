import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    return TestClient(app)


def _write_item_image(tmp_path, run_id, photo_name, item_id, filename):
    item_dir = tmp_path / run_id / photo_name / item_id
    item_dir.mkdir(parents=True, exist_ok=True)
    path = item_dir / filename
    arr = np.zeros((10, 10, 3), dtype=np.uint8)
    cv2.imwrite(str(path), arr)
    return path


def test_serves_crop_png(client, tmp_path):
    _write_item_image(tmp_path, "run1", "photo1", "item_0", "crop.png")
    response = client.get("/images/run1/photo1/item_0/crop.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_serves_generated_png(client, tmp_path):
    _write_item_image(tmp_path, "run1", "photo1", "item_0", "generated.png")
    response = client.get("/images/run1/photo1/item_0/generated.png")
    assert response.status_code == 200


def test_rejects_disallowed_filename(client, tmp_path):
    item_dir = tmp_path / "run1" / "photo1" / "item_0"
    item_dir.mkdir(parents=True, exist_ok=True)
    (item_dir / "secret.txt").write_text("secret")
    response = client.get("/images/run1/photo1/item_0/secret.txt")
    assert response.status_code == 404


def test_rejects_path_traversal_in_filename(client, tmp_path):
    response = client.get("/images/run1/photo1/item_0/..%2F..%2F..%2Fetc%2Fpasswd")
    assert response.status_code == 404


def test_missing_file_returns_404(client, tmp_path):
    response = client.get("/images/nope/nope/nope/crop.png")
    assert response.status_code == 404


def test_serves_cutout_png(client, tmp_path):
    _write_item_image(tmp_path, "run1", "photo1", "item_0", "cutout.png")
    response = client.get("/images/run1/photo1/item_0/cutout.png")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
