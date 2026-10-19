import json
import os
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    return TestClient(app)


def _field(value):
    return {"value": value, "confidence": 0.8, "basis": "observed"}


def _write_item(tmp_path, run_id="run1", photo="photo1", item="item_0"):
    item_dir = tmp_path / run_id / photo / item
    item_dir.mkdir(parents=True)
    (item_dir / "generated.png").write_bytes(b"png")
    (item_dir / "facts.json").write_text(json.dumps({
        "category": _field("jacket"), "colors": _field(["gray"]), "pattern": _field("solid"),
        "visible_text": _field(""), "trims": _field("zip collar"),
        "visible_parts": _field(["front"]), "occluded_parts": _field(["back"]),
    }))
    (item_dir / "result.json").write_text(json.dumps({
        "tier": "high", "reason": "ok", "retake_instruction": None, "visible_fraction": 1.0,
    }))
    return item_dir


def test_closet_items_include_photo_name(client, tmp_path):
    _write_item(tmp_path)
    assert client.get("/items").json()["items"][0]["photo_name"] == "photo1"


def test_patch_updates_facts_and_keeps_the_original(client, tmp_path):
    item_dir = _write_item(tmp_path)
    response = client.patch("/items/run1/photo1/item_0", json={
        "category": "fleece", "colors": ["gray", "navy"], "pattern": "solid",
        "trims": "half zip, white piping", "visible_text": "IETS FRANS",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["facts"]["category"]["value"] == "fleece"
    assert body["facts"]["colors"]["value"] == ["gray", "navy"]
    saved = json.loads((item_dir / "facts.json").read_text())
    assert saved["visible_text"]["value"] == "IETS FRANS"
    assert saved["category"]["confidence"] == 1.0
    original = json.loads((item_dir / "facts.original.json").read_text())
    assert original["category"]["value"] == "jacket"


def test_patch_only_changes_the_fields_sent(client, tmp_path):
    item_dir = _write_item(tmp_path)
    client.patch("/items/run1/photo1/item_0", json={"category": "fleece"})
    client.patch("/items/run1/photo1/item_0", json={"pattern": "striped"})
    saved = json.loads((item_dir / "facts.json").read_text())
    assert saved["category"]["value"] == "fleece"
    assert saved["pattern"]["value"] == "striped"
    assert saved["trims"]["value"] == "zip collar"
    # the backup is the model's version, not the first edit
    assert json.loads((item_dir / "facts.original.json").read_text())["category"]["value"] == "jacket"


@pytest.mark.parametrize("patch", [
    {"colors": ["chartreuse"]},
    {"colors": []},
    {"pattern": "paisley"},
    {"category": "   "},
])
def test_patch_rejects_invalid_values(client, tmp_path, patch):
    _write_item(tmp_path)
    assert client.patch("/items/run1/photo1/item_0", json=patch).status_code == 400


def test_patch_missing_item_returns_404(client, tmp_path):
    assert client.patch("/items/run1/photo1/item_9", json={"category": "x"}).status_code == 404


def test_delete_moves_item_to_trash_and_hides_it(client, tmp_path):
    _write_item(tmp_path)
    assert client.delete("/items/run1/photo1/item_0").status_code == 204
    assert not os.path.exists(tmp_path / "run1" / "photo1" / "item_0")
    assert os.path.exists(tmp_path / ".trash" / "run1" / "photo1" / "item_0" / "facts.json")
    assert client.get("/items").json()["items"] == []


def test_delete_missing_item_returns_404(client, tmp_path):
    assert client.delete("/items/run1/photo1/item_0").status_code == 404


@pytest.mark.parametrize("path", ["/items/..%2F..%2Fetc/photo1/item_0", "/items/.trash/photo1/item_0",
                                  "/items/run1/photo1/not_an_item"])
def test_unsafe_or_odd_paths_are_404(client, tmp_path, path):
    _write_item(tmp_path)
    assert client.delete(path).status_code == 404
    assert client.patch(path, json={"category": "x"}).status_code == 404


def test_patch_name_local(client, tmp_path):
    item_dir = _write_item(tmp_path)
    r = client.patch("/items/run1/photo1/item_0", json={"name": "  Oxford shirt "})
    assert r.status_code == 200
    assert r.json()["facts"]["name"]["value"] == "Oxford shirt"
    saved = json.loads((item_dir / "facts.json").read_text())
    assert saved["name"] == {"value": "Oxford shirt", "confidence": 1.0, "basis": "observed"}
    assert saved["category"]["value"] == "jacket"


@pytest.mark.parametrize("name", ["   ", "x" * 61])
def test_patch_name_must_be_1_to_60_characters(client, tmp_path, name):
    _write_item(tmp_path)
    r = client.patch("/items/run1/photo1/item_0", json={"name": name})
    assert r.status_code == 400


def test_items_without_a_name_still_load(client, tmp_path):
    _write_item(tmp_path)
    facts = client.get("/items").json()["items"][0]["facts"]
    assert facts.get("name") is None
