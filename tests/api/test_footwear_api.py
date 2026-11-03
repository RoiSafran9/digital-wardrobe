"""Footwear end to end through the existing API and worker, providers faked: one pair is one piece, one item,
one front action; a single shoe stays one; shoes refuse Back/360 before anything is held; owners stay isolated."""
import json
import os
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from api.credits import WalletGate, get_gate, get_prices
from api.store import MemoryStore
from api.worker import run_once
from pipeline import footwear
from pipeline.orchestrator import Providers
from pipeline.types import BBox, FactField
from tests.api.test_garment_scan import CountingVision, post_scan
from tests.api.test_outfit_generate import FakeImageGen as OutfitImageGen
from tests.api.test_outfit_scan import FakeVision as OutfitVision, _cand, photo_jpeg, scan_of
from tests.api.test_worker import FakeImageGen, FakeVision, detected, factory, photo_bytes
from tests.api.v1_helpers import A, B, as_user, v1_client

PRICES = {"garment": 1, "back": 1, "turn": 3}
PHOTO = ("photo.png", photo_bytes(), "image/png")


def shoe(x=0, category="sneakers", parts=("pair (both shoes)", "toe", "heel")):
    """A footwear detection; a pair's box spans both shoes (one detection, never two)."""
    return detected(x).model_copy(update={
        "category": FactField(value=category, confidence=0.9, basis="observed"),
        "box": BBox(x=x, y=600, width=400, height=250),
        "visible_parts": FactField(value=list(parts), confidence=0.9, basis="observed")})


def garment(x, category):
    return detected(x).model_copy(update={"category": FactField(value=category, confidence=0.9, basis="observed")})


class RecordingImageGen(FakeImageGen):
    """The garment-flow image fake, counting calls per category (the real provider routes on it)."""
    def __init__(self):
        super().__init__()
        self.categories = []

    async def generate(self, crop_path, facts, violations, complete_edges=False):
        self.categories.append(facts.category.value)
        return await super().generate(crop_path, facts, violations, complete_edges)


@pytest.fixture
def store():
    s = MemoryStore()
    s.credit_grant(A, 10, "ff", "F&F pilot", "owner")
    return s


@pytest.fixture
def gate(store):
    return WalletGate(store)


@pytest.fixture
def client(store, gate):
    c = v1_client(store)
    c.app.dependency_overrides[get_gate] = lambda: gate
    c.app.dependency_overrides[get_prices] = lambda: PRICES
    return c


async def scan(store, client, items, user=A, key="gs-1"):
    vision = CountingVision(items=items)
    scan_id = post_scan(client, user, key).json()["id"]
    await run_once(store, factory(vision=vision))
    body = client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(user)).json()
    assert body["status"] == "succeeded"
    return scan_id, body["pieces"], vision


def generate(client, scan_id, picks, user=A, key="gen-1"):
    return client.post(f"/v1/garment-scans/{scan_id}/generate", json={"piece_indexes": picks, "expected_unit_price": 1},
                       headers=as_user(user, key))


# --- Garment photo (and First 3 Pieces, which runs the same scan → generate per photo) ----------------

async def test_one_pair_is_one_piece_one_item_and_one_front_charge(client, store, gate):
    scan_id, pieces, vision = await scan(store, client, [shoe()])
    assert len(pieces) == 1 and pieces[0]["shoes"] == "pair" and pieces[0]["category"] == "sneakers"
    assert store.credits(A) == {"balance": 10, "held": 0}  # the scan is free
    r = generate(client, scan_id, [0])
    assert r.status_code == 202 and r.json()["max_fronts"] == 1
    assert store.credits(A)["held"] == 1
    imagegen = RecordingImageGen()
    await run_once(store, factory(vision=vision, imagegen=imagegen), gate=gate)
    job = client.get(f"/v1/jobs/{r.json()['id']}", headers=as_user(A)).json()
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 1
    assert imagegen.categories == ["sneakers"] and vision.calls == 1  # one image call, no second detection
    assert store.credits(A) == {"balance": 9, "held": 0}
    [item] = client.get("/v1/items", headers=as_user(A)).json()["items"]
    assert item["facts"]["category"]["value"] == "sneakers"
    assert item["facts"]["visible_parts"]["value"][0] == "pair (both shoes)"


async def test_two_pairs_are_two_pieces_not_four(client, store):
    _, pieces, _ = await scan(store, client, [shoe(0), shoe(500, "boots")])
    assert [(p["category"], p["shoes"]) for p in pieces] == [("sneakers", "pair"), ("boots", "pair")]


async def test_a_single_shoe_is_one_piece_marked_single(client, store, gate):
    scan_id, pieces, vision = await scan(store, client, [shoe(parts=("single shoe", "outer side"))])
    assert len(pieces) == 1 and pieces[0]["shoes"] == "single"
    generate(client, scan_id, [0])
    await run_once(store, factory(vision=vision), gate=gate)
    [item] = store.list_items(A)
    assert footwear.shoe_count(item["facts"]["visible_parts"]["value"]) == "single"
    assert store.credits(A) == {"balance": 9, "held": 0}


async def test_a_shoe_without_a_stated_count_is_not_labelled_a_pair(client, store):
    _, pieces, _ = await scan(store, client, [shoe(parts=("toe", "heel"))])
    assert pieces[0]["shoes"] is None


async def test_a_mixed_photo_makes_one_pair_and_two_garments_at_three_fronts(client, store, gate):
    scan_id, pieces, vision = await scan(store, client, [garment(0, "t-shirt"), garment(300, "jeans"), shoe(600)])
    assert [(p["category"], p["shoes"]) for p in pieces] == [("t-shirt", None), ("jeans", None), ("sneakers", "pair")]
    generate(client, scan_id, [0, 1, 2])
    assert store.credits(A)["held"] == 3
    imagegen = RecordingImageGen()
    await run_once(store, factory(vision=vision, imagegen=imagegen), gate=gate)
    assert sorted(imagegen.categories) == ["jeans", "sneakers", "t-shirt"]
    assert len(store.list_items(A)) == 3 and store.credits(A) == {"balance": 7, "held": 0}


async def test_a_retried_generate_makes_no_second_item_or_charge(client, store, gate):
    scan_id, _, vision = await scan(store, client, [shoe()])
    first = generate(client, scan_id, [0])
    again = generate(client, scan_id, [0])
    assert first.status_code == 202 and again.status_code == 200 and again.json()["id"] == first.json()["id"]
    assert store.credits(A)["held"] == 1
    imagegen = RecordingImageGen()
    await run_once(store, factory(vision=vision, imagegen=imagegen), gate=gate)
    assert await run_once(store, factory(vision=vision, imagegen=imagegen), gate=gate) is False
    assert generate(client, scan_id, [0]).json()["id"] == first.json()["id"]
    assert len(imagegen.categories) == 1 and len(store.list_items(A)) == 1
    assert [e["amount"] for e in store.ledger if e["kind"] == "charge"] == [1]


async def test_another_account_never_sees_the_shoes_or_their_scan(client, store, gate):
    scan_id, _, vision = await scan(store, client, [shoe()])
    generate(client, scan_id, [0])
    await run_once(store, factory(vision=vision), gate=gate)
    [item] = store.list_items(A)
    assert client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(B)).status_code == 404
    assert generate(client, scan_id, [0], user=B, key="b-1").status_code == 404
    assert client.get(f"/v1/items/{item['id']}", headers=as_user(B)).status_code == 404
    assert client.get("/v1/items", headers=as_user(B)).json()["items"] == []
    assert all(p.startswith(f"{A}/") for p in store.files)


# --- Back and 360: garment features only ---------------------------------------------------------------

async def _made(client, store, gate, items):
    client.post("/v1/jobs", files={"photo": PHOTO}, data={"max_fronts": str(len(items))}, headers=as_user(A, "cap"))
    await run_once(store, factory(FakeVision(items)), gate=gate)
    return {i["facts"]["category"]["value"]: i for i in store.list_items(A)}


async def test_shoes_refuse_back_and_360_before_anything_is_held_or_uploaded(client, store, gate):
    made = await _made(client, store, gate, [shoe(0), garment(500, "hoodie")])
    before, jobs, files = store.credits(A), dict(store.jobs), set(store.files)
    shoes = made["sneakers"]["id"]
    back = client.post(f"/v1/items/{shoes}/back", files={"photo": PHOTO}, headers=as_user(A, "b1"))
    turn = client.post(f"/v1/items/{shoes}/turn", headers=as_user(A, "t1"))
    assert back.status_code == turn.status_code == 409
    assert back.json()["error"] == footwear.NO_SIDE_VIEWS
    assert store.credits(A) == before and store.jobs == jobs and set(store.files) == files
    assert "turn" not in store.get_item(A, shoes) or not store.get_item(A, shoes)["turn"]
    # Garments keep both.
    hoodie = made["hoodie"]["id"]
    assert client.post(f"/v1/items/{hoodie}/back", files={"photo": PHOTO}, headers=as_user(A, "b2")).status_code == 202
    assert client.post(f"/v1/items/{hoodie}/turn", headers=as_user(A, "t2")).status_code == 202


async def test_someone_elses_shoe_is_still_not_found_not_refused(client, store, gate):
    made = await _made(client, store, gate, [shoe(0)])
    assert client.post(f"/v1/items/{made['sneakers']['id']}/turn", headers=as_user(B, "t1")).status_code == 404


async def test_a_retry_of_an_existing_job_still_gets_that_job(client, store, gate):
    made = await _made(client, store, gate, [shoe(0)])
    item_id = made["sneakers"]["id"]
    legacy, _ = store.create_job(A, "turn", "old-key", None, item_id=item_id)
    r = client.post(f"/v1/items/{item_id}/turn", headers=as_user(A, "old-key"))
    assert r.status_code == 200 and r.json()["id"] == legacy["id"]


async def test_a_back_made_before_stays_viewable_on_a_shoe(client, store, gate):
    made = await _made(client, store, gate, [shoe(0)])
    item_id = made["sneakers"]["id"]
    path = f"{A}/items/{item_id}/back/old/generated.png"
    store.upload(path, b"png", "image/png")
    store.update_item(A, item_id, {"back": {"generated_path": path, "visible_text": ""}})
    item = client.get(f"/v1/items/{item_id}", headers=as_user(A)).json()
    assert item["back"]["generated_url"].endswith(f"{path}?token=signed")


# --- Outfit photo: shoes on the feet --------------------------------------------------------------------

@pytest.fixture
def outfit_on(monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT", "on")


async def test_worn_shoes_are_one_candidate_and_one_pending_item(outfit_on, store, gate, client):
    worn = scan_of(_cand([100, 200, 500, 700], "jacket"),
                   {**_cand([850, 300, 990, 700], "shoes"), "visible_parts": ["both shoes", "toe"]})
    r = client.post("/v1/outfit-scans", files={"photo": ("p.jpg", photo_jpeg(), "image/jpeg")}, headers=as_user(A, "os"))
    scan_id = r.json()["id"]
    store.files[store.jobs[scan_id]["input_path"]] = photo_jpeg()
    await run_once(store, lambda logger: Providers(vision=OutfitVision(worn), imagegen=None))
    candidates = client.get(f"/v1/outfit-scans/{scan_id}", headers=as_user(A)).json()["candidates"]
    shoes = [c for c in candidates if c["category"] == "shoes"]
    assert len(shoes) == 1
    imagegen = OutfitImageGen()
    job = client.post(f"/v1/outfit-scans/{scan_id}/generate", json={"candidate_ids": [shoes[0]["id"]], "expected_unit_price": 1},
                      headers=as_user(A, "og")).json()
    assert store.credits(A)["held"] == 1
    await run_once(store, lambda logger: Providers(vision=OutfitVision(worn), imagegen=imagegen), gate=gate)
    assert imagegen.calls == [[shoes[0]["id"]]]
    [item_id] = store.jobs[job["id"]]["result"]["item_ids"]
    item = store.get_item(A, item_id)
    assert item["review_state"] == "pending" and footwear.facts_are_footwear(item["facts"])
    assert store.credits(A) == {"balance": 9, "held": 0}


# --- Local mode -----------------------------------------------------------------------------------------

def _field(v):
    return {"value": v, "confidence": 0.9, "basis": "observed"}


def _local_item(tmp_path, category):
    item_dir = tmp_path / "run1" / "photo1" / "item_0"
    item_dir.mkdir(parents=True)
    cv2.imwrite(str(item_dir / "generated.png"), np.full((50, 50, 3), 128, np.uint8))
    (item_dir / "facts.json").write_text(json.dumps({k: _field(v) for k, v in {
        "category": category, "colors": ["white"], "pattern": "solid", "visible_text": "",
        "trims": "", "visible_parts": ["pair (both shoes)"], "occluded_parts": []}.items()}))
    (item_dir / "result.json").write_text(json.dumps(
        {"tier": "high", "reason": "ok", "retake_instruction": None, "visible_fraction": 1.0}))
    return item_dir


def test_local_mode_refuses_back_and_360_for_shoes(tmp_path, monkeypatch):
    monkeypatch.setenv("WARDROBE_RUNS_DIR", str(tmp_path))
    item_dir = _local_item(tmp_path, "sneakers")
    from api.main import app
    from api.routes.runs import get_provider_factory

    class NoImages:
        def __getattr__(self, name):
            raise AssertionError("no model call for a refused shoe")
    app.dependency_overrides[get_provider_factory] = lambda: (lambda logger: Providers(vision=NoImages(), imagegen=NoImages()))
    try:
        client = TestClient(app)
        back = client.post("/items/run1/photo1/item_0/back", files={"photo": ("b.png", photo_bytes(), "image/png")})
        turn = client.post("/items/run1/photo1/item_0/turn")
        assert back.status_code == turn.status_code == 409
        assert back.json()["error"] == footwear.NO_SIDE_VIEWS
        assert not os.path.exists(item_dir / "turn") and not os.path.exists(item_dir / ".back-new")
    finally:
        app.dependency_overrides.clear()


# --- Build My Look -------------------------------------------------------------------------------------

def test_new_shoe_types_fill_the_footwear_slot_and_swap_with_each_other(monkeypatch, store):
    from tests.api.test_v1_outfit_builder import add_item
    monkeypatch.setenv("WARDROBE_OUTFIT_BUILDER", "on")
    client = v1_client(store)
    top, bottom = add_item(store, A, "shirt"), add_item(store, A, "chinos")
    mules, clogs = add_item(store, A, "mules"), add_item(store, A, "clogs")
    looks = client.post("/v1/outfit-suggestions", json={}, headers=as_user(A)).json()["looks"]
    with_shoes = [look for look in looks if "footwear" in look["slots"]]  # footwear is an optional slot
    assert with_shoes and all(look["slots"]["footwear"] in {mules["id"], clogs["id"]} for look in with_shoes)
    look = with_shoes[0]
    r = client.post("/v1/outfit-suggestions/swap-options", json={
        "look": {"slots": look["slots"], "item_ids": look["item_ids"]}, "target_item_id": look["slots"]["footwear"],
        "filters": {}}, headers=as_user(A))
    assert r.status_code == 200 and r.json()["target_slot"] == "footwear"
    assert [a["item_id"] for a in r.json()["alternatives"]] == [({mules["id"], clogs["id"]} - {look["slots"]["footwear"]}).pop()]
    assert {top["id"], bottom["id"]} <= set(look["item_ids"])
