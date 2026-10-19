"""Outfit Photo M1: the free candidate scan — flag, ownership, idempotency, no credits, previews, expiry."""
from datetime import datetime, timedelta, timezone
import cv2
import numpy as np
import pytest
from api.credits import get_gate, get_prices
from api.store import MemoryStore
from api.worker import run_once
from pipeline.orchestrator import Providers
from pipeline.outfit import OutfitScan, parse_scan
from scripts.sweep_storage import plan_sweep
from tests.api.v1_helpers import A, B, PHOTO, as_user, v1_client

PRICES = {"garment": 1, "back": 1, "turn": 3}


class Gate:
    def __init__(self):
        self.calls = []

    def reserve(self, *a): self.calls.append(("reserve",) + a)
    def release(self, job_id): self.calls.append(("release", job_id))
    def settle(self, job_id, amount): self.calls.append(("settle", job_id, amount))
    def refund(self, job_id): self.calls.append(("refund", job_id))
    def reconcile(self): return 0


def _cand(box_2d, category):
    return {"box_2d": box_2d, "category": category, "layer": "single", "colors": ["blue"], "pattern": "solid",
            "visible_text": "", "description": category, "visible_parts": ["front"], "hidden_parts": ["back"],
            "visibility": "full", "uncertainty": ""}


def scan_of(*cands, w=800, h=1000) -> OutfitScan:
    return parse_scan({"scene_kind": "worn", "person_count": 1, "candidates": list(cands)}, w, h)


class FakeVision:
    def __init__(self, scan=None, crash=False):
        self.scan, self.crash, self.calls = scan, crash, 0

    async def detect_outfit(self, image_path):
        self.calls += 1
        if self.crash:
            raise RuntimeError("model unavailable")
        return self.scan or scan_of(_cand([100, 200, 500, 700], "jacket"), _cand([500, 250, 950, 650], "jeans"))

    async def detect_items_with_facts(self, image_path):
        raise AssertionError("the garment-photo detector must not run for an outfit scan")


class NoImageGen:
    def __getattr__(self, name):
        raise AssertionError("an outfit scan must not generate images")


def factory(vision):
    return lambda logger: Providers(vision=vision, imagegen=NoImageGen())


@pytest.fixture
def on(monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT", "on")


@pytest.fixture
def store():
    return MemoryStore()


@pytest.fixture
def billing(store):
    """A client with billing ON, so we can prove a scan never touches the wallet."""
    client, gate = v1_client(store), Gate()
    client.app.dependency_overrides[get_prices] = lambda: PRICES
    client.app.dependency_overrides[get_gate] = lambda: gate
    return client, gate


def post_scan(client, user=A, key="scan-1"):
    return client.post("/v1/outfit-scans", files={"photo": PHOTO}, headers=as_user(user, key))


def photo_jpeg():
    return cv2.imencode(".jpg", np.full((1000, 800, 3), 128, np.uint8))[1].tobytes()


def test_routes_are_off_by_default(store):
    client = v1_client(store)
    assert post_scan(client).status_code == 404
    assert client.get("/v1/outfit-scans/a0000000-0000-4000-8000-00000000000a", headers=as_user(A)).status_code == 404
    assert store.jobs == {}


def test_a_scan_is_free_and_idempotent(on, store, billing):
    client, gate = billing
    first = post_scan(client)
    assert first.status_code == 202 and first.json()["status"] == "queued" and first.json()["candidates"] == []
    again = post_scan(client)
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    job = store.jobs[first.json()["id"]]
    assert job["kind"] == "outfit_scan" and job["cost_credits"] is None and job["max_items"] is None
    assert job["input_path"].startswith(f"{A}/jobs/{job['id']}/")
    assert [c[0] for c in gate.calls] == ["reserve"] and gate.calls[0][-1] is None  # nothing held


def test_a_key_already_used_for_another_job_kind_is_refused(on, store):
    client = v1_client(store)
    assert client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "k")).status_code == 202
    assert post_scan(client, key="k").status_code == 409


def test_scan_needs_a_photo_and_a_key(on, store):
    client = v1_client(store)
    assert client.post("/v1/outfit-scans", headers=as_user(A, "k")).status_code == 400
    assert client.post("/v1/outfit-scans", files={"photo": PHOTO}, headers=as_user(A)).status_code == 400


async def test_the_worker_stores_candidates_and_private_previews_without_generating(on, store):
    client = v1_client(store)
    scan_id = post_scan(client).json()["id"]
    store.files[store.jobs[scan_id]["input_path"]] = photo_jpeg()
    gate, vision = Gate(), FakeVision()
    assert await run_once(store, factory(vision), gate=gate)
    job = store.jobs[scan_id]
    assert job["status"] == "succeeded" and vision.calls == 1
    assert gate.calls == []  # free: nothing settled or refunded
    assert sorted(p for p in store.files if "/scans/" in p) == [f"{A}/scans/{scan_id}/c1.jpg", f"{A}/scans/{scan_id}/c2.jpg"]
    assert job["input_path"] in store.files  # kept for the generate step until the scan expires
    body = client.get(f"/v1/outfit-scans/{scan_id}", headers=as_user(A)).json()
    assert body["scene_kind"] == "worn" and [c["category"] for c in body["candidates"]] == ["jacket", "jeans"]
    assert body["candidates"][0]["preview_url"] == f"https://storage.test/{A}/scans/{scan_id}/c1.jpg?token=signed"
    assert "box_2d" not in body["candidates"][0] and body["candidates"][0]["hidden_parts"] == ["back"]
    assert client.get(f"/v1/jobs/{scan_id}", headers=as_user(A)).json()["kind"] == "outfit_scan"


async def test_another_users_scan_answers_404(on, store):
    client = v1_client(store)
    scan_id = post_scan(client).json()["id"]
    assert client.get(f"/v1/outfit-scans/{scan_id}", headers=as_user(B)).status_code == 404
    assert client.get("/v1/outfit-scans/not-a-uuid", headers=as_user(A)).status_code == 404
    garment = client.post("/v1/jobs", files={"photo": PHOTO}, headers=as_user(A, "g")).json()["id"]
    assert client.get(f"/v1/outfit-scans/{garment}", headers=as_user(A)).status_code == 404


def test_an_expired_scan_answers_410(on, store):
    client = v1_client(store)
    scan_id = post_scan(client).json()["id"]
    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    store.jobs[scan_id].update(status="succeeded", result={"scene_kind": "worn", "person_count": 1, "candidates": [],
                                                           "expires_at": past})
    assert client.get(f"/v1/outfit-scans/{scan_id}", headers=as_user(A)).status_code == 410


async def test_a_failed_scan_reports_an_error_and_refunds_nothing(on, store):
    client = v1_client(store)
    scan_id = post_scan(client).json()["id"]
    store.files[store.jobs[scan_id]["input_path"]] = photo_jpeg()
    gate = Gate()
    for _ in range(2):  # retried once, then final
        await run_once(store, factory(FakeVision(crash=True)), gate=gate)
    body = client.get(f"/v1/outfit-scans/{scan_id}", headers=as_user(A)).json()
    assert body["status"] == "failed" and body["error"] and gate.calls == []
    assert store.jobs[scan_id]["input_path"] not in store.files  # a failed scan keeps no person photo


async def test_candidates_are_capped(on, store):
    client = v1_client(store)
    scan_id = post_scan(client).json()["id"]
    store.files[store.jobs[scan_id]["input_path"]] = photo_jpeg()
    many = scan_of(*[_cand([i * 90, 100, i * 90 + 80, 700], "t-shirt") for i in range(11)])
    await run_once(store, factory(FakeVision(many)), gate=Gate())
    assert len(store.jobs[scan_id]["result"]["candidates"]) == 8


def test_the_sweeper_drops_scan_photos_and_previews_after_a_day():
    store, now = MemoryStore(), datetime(2026, 10, 19, 12, tzinfo=timezone.utc)
    scan, _ = store.create_job(A, "outfit_scan", "s", None)
    garment, _ = store.create_job(A, "garment", "g", None)
    for j in (scan, garment):
        store.jobs[j["id"]]["status"] = "succeeded"
    old = now - timedelta(hours=30)
    for path in (f"{A}/jobs/{scan['id']}/upload.jpg", f"{A}/scans/{scan['id']}/c1.jpg", f"{A}/jobs/{garment['id']}/upload.jpg"):
        store.upload(path, b"x", "image/jpeg")
        store.file_times[path] = old
    store.upload(f"{A}/scans/fresh/c1.jpg", b"x", "image/jpeg")
    store.file_times[f"{A}/scans/fresh/c1.jpg"] = now - timedelta(hours=2)
    sweep = plan_sweep(store, now)
    assert sorted(sweep.remove) == sorted([f"{A}/jobs/{scan['id']}/upload.jpg", f"{A}/scans/{scan['id']}/c1.jpg"])
    assert sweep.kept[f"{A}/jobs/{garment['id']}/upload.jpg"] == "newer than 7 days"
