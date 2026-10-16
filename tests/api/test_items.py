import json
import os
import time
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    return TestClient(app)


def _facts_json():
    field = {"value": "pink", "confidence": 0.9, "basis": "observed"}
    text_field = {"value": "", "confidence": 0.9, "basis": "observed"}
    return {
        "category": field, "colors": field, "pattern": field,
        "visible_text": text_field, "trims": field,
        "visible_parts": field, "occluded_parts": field,
    }


def _write_item(tmp_path, run_id, photo_name, item_id, tier="high"):
    item_dir = tmp_path / run_id / photo_name / item_id
    item_dir.mkdir(parents=True, exist_ok=True)
    (item_dir / "facts.json").write_text(json.dumps(_facts_json()))
    (item_dir / "result.json").write_text(json.dumps({
        "tier": tier, "reason": "verification passed, fully visible",
        "retake_instruction": None, "visible_fraction": 1.0,
    }))
    return item_dir


def test_lists_items_with_image_urls(client, tmp_path):
    _write_item(tmp_path, "run1", "photo1", "item_0")
    response = client.get("/items")
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["run_id"] == "run1"
    assert item["item_id"] == "item_0"
    assert item["tier"] == "high"
    assert item["crop_url"] == "/images/run1/photo1/item_0/crop.png"
    assert item["generated_url"] == "/images/run1/photo1/item_0/generated.png"


def test_empty_runs_dir_returns_empty_list(client, tmp_path):
    response = client.get("/items")
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_skips_item_with_missing_facts_json(client, tmp_path):
    item_dir = _write_item(tmp_path, "run1", "photo1", "item_0")
    os.remove(item_dir / "facts.json")
    response = client.get("/items")
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_newest_item_listed_first(client, tmp_path):
    _write_item(tmp_path, "run1", "photo1", "item_0")
    time.sleep(0.01)
    _write_item(tmp_path, "run2", "photo1", "item_0")
    response = client.get("/items")
    items = response.json()["items"]
    assert items[0]["run_id"] == "run2"
    assert items[1]["run_id"] == "run1"


def test_cutout_url_is_null_without_a_cutout_file(client, tmp_path):
    _write_item(tmp_path, "run1", "photo1", "item_0")
    item = client.get("/items").json()["items"][0]
    assert item["cutout_url"] is None


def test_cutout_url_points_at_the_cutout_when_it_exists(client, tmp_path):
    item_dir = _write_item(tmp_path, "run1", "photo1", "item_0")
    (item_dir / "cutout.png").write_bytes(b"png")
    item = client.get("/items").json()["items"][0]
    assert item["cutout_url"] == "/images/run1/photo1/item_0/cutout.png"
