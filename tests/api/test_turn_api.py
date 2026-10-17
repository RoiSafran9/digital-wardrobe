import json
import os
from datetime import datetime, timedelta, timezone
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from pipeline.orchestrator import Providers


def _png_bytes():
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    img[20:80, 30:70] = (40, 50, 90)
    return cv2.imencode(".png", img)[1].tobytes()


class FakeImageGen:
    def __init__(self, fail=False):
        self.fail = fail
        self.backs = []

    async def generate_view(self, front_path, back_path, view, anchor_path=None):
        self.backs.append(back_path)
        if self.fail:
            raise RuntimeError("quota")
        return _png_bytes()


def _field(v):
    return {"value": v, "confidence": 0.9, "basis": "observed"}


def _write_item(tmp_path):
    item_dir = tmp_path / "run1" / "photo1" / "item_0"
    item_dir.mkdir(parents=True)
    cv2.imwrite(str(item_dir / "generated.png"), np.full((50, 50, 3), 120, dtype=np.uint8))
    (item_dir / "facts.json").write_text(json.dumps({k: _field(v) for k, v in {
        "category": "t-shirt", "colors": ["white"], "pattern": "solid", "visible_text": "",
        "trims": "", "visible_parts": ["front"], "occluded_parts": ["back"]}.items()}))
    (item_dir / "result.json").write_text(json.dumps(
        {"tier": "high", "reason": "ok", "retake_instruction": None, "visible_fraction": 1.0}))
    return item_dir


def _write_status(item_dir, state, started_at):
    turn = item_dir / "turn"
    turn.mkdir(exist_ok=True)
    (turn / "status.json").write_text(json.dumps(
        {"state": state, "error": None, "started_at": started_at.isoformat()}))


@pytest.fixture
def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    from api.main import app
    from api.routes.runs import get_provider_factory

    def make(gen):
        app.dependency_overrides[get_provider_factory] = lambda: (
            lambda logger: Providers(vision=None, imagegen=gen))
        return TestClient(app)
    yield make
    app.dependency_overrides.clear()


URL = "/items/run1/photo1/item_0/turn"


def test_start_returns_202_and_the_job_finishes_with_four_views(tmp_path, make_client):
    _write_item(tmp_path)
    client = make_client(FakeImageGen())

    started = client.post(URL)
    assert started.status_code == 202
    assert started.json()["state"] == "running"

    # TestClient runs background tasks before returning, so the job is finished here.
    status = client.get(URL).json()
    assert status["state"] == "done"
    assert [v["angle"] for v in status["views"]] == ["front", "right", "back", "left"]
    assert status["views"][0]["url"] == "/images/run1/photo1/item_0/turn/front.png"
    assert status["views"][0]["cutout_url"] == "/images/run1/photo1/item_0/turn/front_cutout.png"


def test_uses_the_back_image_when_the_item_has_one(tmp_path, make_client):
    item_dir = _write_item(tmp_path)
    (item_dir / "back").mkdir()
    cv2.imwrite(str(item_dir / "back" / "generated.png"), np.zeros((10, 10, 3), dtype=np.uint8))
    gen = FakeImageGen()
    make_client(gen).post(URL)
    assert gen.backs[0] == str(item_dir / "back" / "generated.png")


def test_closet_lists_the_finished_turn(tmp_path, make_client):
    _write_item(tmp_path)
    client = make_client(FakeImageGen())
    assert client.get("/items").json()["items"][0]["turn"] is None
    client.post(URL)
    turn = client.get("/items").json()["items"][0]["turn"]
    assert turn["state"] == "done" and len(turn["views"]) == 4


def test_failed_generation_reports_failed_with_a_message(tmp_path, make_client):
    _write_item(tmp_path)
    client = make_client(FakeImageGen(fail=True))
    client.post(URL)
    status = client.get(URL).json()
    assert status["state"] == "failed"
    assert "try again" in status["error"]
    assert status["views"] == []


def test_second_start_while_running_is_409(tmp_path, make_client):
    item_dir = _write_item(tmp_path)
    _write_status(item_dir, "running", datetime.now(timezone.utc))
    assert make_client(FakeImageGen()).post(URL).status_code == 409


def test_stale_running_job_reads_as_failed_and_can_restart(tmp_path, make_client):
    item_dir = _write_item(tmp_path)
    _write_status(item_dir, "running", datetime.now(timezone.utc) - timedelta(minutes=10))
    client = make_client(FakeImageGen())
    status = client.get(URL).json()
    assert status["state"] == "failed" and status["error"] == "Interrupted — try again"
    assert client.post(URL).status_code == 202


def test_done_lists_views_and_tolerates_a_missing_cutout(tmp_path, make_client):
    item_dir = _write_item(tmp_path)
    client = make_client(FakeImageGen())
    client.post(URL)
    os.remove(item_dir / "turn" / "left_cutout.png")
    left = client.get(URL).json()["views"][3]
    assert left["angle"] == "left" and left["cutout_url"] is None


def test_regenerating_keeps_the_old_views_in_the_trash(tmp_path, make_client):
    _write_item(tmp_path)
    client = make_client(FakeImageGen())
    client.post(URL)
    client.post(URL)
    trashed = list((tmp_path / ".trash" / "run1" / "photo1" / "item_0").glob("turn-*"))
    assert len(trashed) == 1 and (trashed[0] / "front.png").exists()


def test_missing_item_is_404(tmp_path, make_client):
    client = make_client(FakeImageGen())
    assert client.post("/items/run1/photo1/item_9/turn").status_code == 404
    assert client.get("/items/run1/photo1/item_9/turn").status_code == 404


def test_status_before_any_job_is_404(tmp_path, make_client):
    _write_item(tmp_path)
    assert make_client(FakeImageGen()).get(URL).status_code == 404


@pytest.mark.asyncio
async def test_an_outdated_job_never_writes_into_a_newer_one(tmp_path, make_client):
    # A slow job outlives the stale window, the owner retries, then the old job finishes:
    # its views and status must not land in the new job's folder.
    from api.routes.turn import _make_turn
    item_dir = _write_item(tmp_path)
    started = datetime.now(timezone.utc).isoformat()
    turn_dir = item_dir / "turn"
    turn_dir.mkdir()
    (turn_dir / "status.json").write_text(json.dumps(
        {"state": "running", "error": None, "started_at": started, "job": "new"}))

    await _make_turn(str(item_dir / "generated.png"), None, str(turn_dir), started, "old", FakeImageGen())

    status = json.loads((turn_dir / "status.json").read_text())
    assert status["state"] == "running" and status["job"] == "new"
    assert sorted(os.listdir(turn_dir)) == ["status.json"]
