import json
import os
import shutil
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient
from pipeline.orchestrator import Providers
from pipeline.types import BBox, DetectedItemWithFacts, FactField


def _photo_bytes():
    ok, buf = cv2.imencode(".png", (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8))
    return buf.tobytes()


def _detected(cut_off=False):
    f = FactField(value="gray", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=100, y=100, width=600, height=700), included=True, cut_off_by_frame=cut_off,
        exclusion_reason=None, category=FactField(value="hoodie", confidence=0.9, basis="observed"),
        colors=f, pattern=f, visible_text=FactField(value="TEAM 9", confidence=0.9, basis="observed"),
        trims=f, visible_parts=FactField(value=["back"], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=["front"], confidence=0.9, basis="observed"),
    )


class FakeVision:
    def __init__(self, cut_off=False):
        self.cut_off = cut_off

    async def detect_items_with_facts(self, image_path):
        return [_detected(self.cut_off)]


class FakeImageGen:
    async def generate(self, crop_path, facts, violations):
        raise AssertionError("not used")

    async def generate_back(self, crop_path, front_image_path, facts, violations):
        out = crop_path.replace(".png", "_generated.png")
        shutil.copy(crop_path, out)
        return out


def _field(v):
    return {"value": v, "confidence": 0.9, "basis": "observed"}


def _write_front(tmp_path):
    item_dir = tmp_path / "run1" / "photo1" / "item_0"
    item_dir.mkdir(parents=True)
    cv2.imwrite(str(item_dir / "generated.png"), (np.random.rand(200, 200, 3) * 255).astype(np.uint8))
    (item_dir / "facts.json").write_text(json.dumps({k: _field(v) for k, v in {
        "category": "hoodie", "colors": ["gray"], "pattern": "solid", "visible_text": "",
        "trims": "", "visible_parts": ["front"], "occluded_parts": ["back"]}.items()}))
    (item_dir / "result.json").write_text(json.dumps(
        {"tier": "high", "reason": "ok", "retake_instruction": None, "visible_fraction": 1.0}))
    return item_dir


def _client(tmp_path, monkeypatch, cut_off=False):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    from api.routes.runs import get_provider_factory
    app.dependency_overrides[get_provider_factory] = lambda: (
        lambda logger: Providers(vision=FakeVision(cut_off), imagegen=FakeImageGen()))
    return app, TestClient(app)


@pytest.fixture
def client(tmp_path, monkeypatch):
    app, c = _client(tmp_path, monkeypatch)
    yield c
    app.dependency_overrides.clear()


def _post_back(client, path="/items/run1/photo1/item_0/back"):
    return client.post(path, files={"photo": ("back.png", _photo_bytes(), "image/png")})


def test_adding_a_back_returns_the_item_with_back_images(client, tmp_path):
    item_dir = _write_front(tmp_path)
    response = _post_back(client)
    assert response.status_code == 200, response.text
    back = response.json()["back"]
    assert back["generated_url"] == "/images/run1/photo1/item_0/back/generated.png"
    assert back["visible_text"] == "TEAM 9"
    assert os.path.exists(item_dir / "back" / "generated.png")


def test_closet_lists_the_back_and_serves_its_image(client, tmp_path):
    _write_front(tmp_path)
    _post_back(client)
    item = client.get("/items").json()["items"][0]
    assert item["back"]["generated_url"].endswith("/back/generated.png")
    assert client.get(item["back"]["generated_url"]).status_code == 200


def test_items_without_a_back_have_null_back(client, tmp_path):
    _write_front(tmp_path)
    assert client.get("/items").json()["items"][0]["back"] is None


def test_replacing_the_back_keeps_the_old_one_in_trash(client, tmp_path):
    _write_front(tmp_path)
    _post_back(client)
    _post_back(client)
    trashed = list((tmp_path / ".trash" / "run1" / "photo1" / "item_0").glob("back-*"))
    assert len(trashed) == 1


def test_back_for_missing_item_is_404(client, tmp_path):
    assert _post_back(client, "/items/run1/photo1/item_7/back").status_code == 404


def test_back_photo_cut_off_by_frame_is_400_with_instruction(tmp_path, monkeypatch):
    app, client = _client(tmp_path, monkeypatch, cut_off=True)
    try:
        _write_front(tmp_path)
        response = _post_back(client)
        assert response.status_code == 400
        assert "step back" in response.json()["error"]
        assert not os.path.exists(tmp_path / "run1" / "photo1" / "item_0" / "back")
    finally:
        app.dependency_overrides.clear()
