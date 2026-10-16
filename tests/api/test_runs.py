import shutil
import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient
from pipeline.types import DetectedItemWithFacts, BBox, FactField
from pipeline.orchestrator import Providers


def _photo_bytes():
    arr = (np.random.rand(1000, 1000, 3) * 255).astype(np.uint8)
    ok, buf = cv2.imencode(".png", arr)
    assert ok
    return buf.tobytes()


def _item():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=100, height=100), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field, trims=field,
        visible_parts=FactField(value=["front"], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=[], confidence=0.9, basis="observed"),
    )


class FakeVision:
    def __init__(self, items):
        self.items = items

    async def detect_items_with_facts(self, image_path):
        return self.items


class FakeImageGen:
    async def generate(self, crop_path, facts, violations, complete_edges=False):
        gen_path = crop_path.replace("crop.png", "generated.png")
        shutil.copy(crop_path, gen_path)
        return gen_path


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    from api.routes.runs import get_provider_factory

    def fake_factory(logger):
        return Providers(vision=FakeVision([_item()]), imagegen=FakeImageGen())

    app.dependency_overrides[get_provider_factory] = lambda: fake_factory
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_post_runs_returns_items_with_image_urls(client):
    response = client.post("/runs", files={"photo": ("photo.png", _photo_bytes(), "image/png")})
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["tier"] == "high"
    assert item["crop_url"].endswith("/item_0/crop.png")
    assert item["generated_url"].endswith("/item_0/generated.png")
    assert "cutout_url" in item
    assert item["photo_name"] == "photo"  # lets the app add a back right after capture  # null here: a noise image has no clean background to remove
    assert body["failed"] == []


def test_post_runs_without_file_returns_400(client):
    response = client.post("/runs", files={})
    assert response.status_code == 400
    assert response.json()["error"] == "no photo provided"


def test_post_runs_with_unreadable_image_returns_400(client):
    response = client.post("/runs", files={"photo": ("note.txt", b"not an image", "text/plain")})
    assert response.status_code == 400


def test_post_runs_handles_pipeline_exception(client):
    from api.main import app
    from api.routes.runs import get_provider_factory

    class ExplodingVision:
        async def detect_items_with_facts(self, image_path):
            raise RuntimeError("vision API down")

    def exploding_factory(logger):
        return Providers(vision=ExplodingVision(), imagegen=FakeImageGen())

    app.dependency_overrides[get_provider_factory] = lambda: exploding_factory
    response = client.post("/runs", files={"photo": ("photo.png", _photo_bytes(), "image/png")})
    assert response.status_code == 500
    assert "vision API down" in response.json()["error"]
