"""Outfit follow-ups: correct a garment before generating, mark a garment the scan missed, regenerate a result."""
import pytest
from api.store import MemoryStore
from api.worker import run_once
from tests.api.test_outfit_generate import FakeImageGen, client_for, generate, providers, scanned
from tests.api.test_outfit_scan import Gate, PRICES
from tests.api.v1_helpers import A, B, as_user


@pytest.fixture(autouse=True)
def on(monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT", "on")


class SpyImageGen(FakeImageGen):
    def __init__(self, **kw):
        super().__init__(**kw)
        self.scans = []

    async def generate_outfit(self, image_path, scan, candidate_ids, out_dir):
        self.scans.append(scan)
        return await super().generate_outfit(image_path, scan, candidate_ids, out_dir)


# --- corrections ---------------------------------------------------------------------------------

async def test_a_corrected_type_is_what_gets_generated_and_saved():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    r = client.post(f"/v1/outfit-scans/{scan_id}/generate",
                    json={"candidate_ids": ["c1"], "expected_unit_price": None, "corrections": {"c1": "  blazer "}},
                    headers=as_user(A, "g1"))
    assert r.status_code == 202
    spy = SpyImageGen()
    await run_once(store, providers(spy))
    c1 = next(c for c in spy.scans[0].candidates if c.id == "c1")
    assert c1.category == "blazer"
    item = store.items[store.jobs[r.json()["id"]]["result"]["item_ids"][0]]
    assert item["facts"]["category"]["value"] == "blazer"


@pytest.mark.parametrize("corrections", [{"c9": "shirt"}, {"c1": ""}, {"c1": "x" * 41}])
async def test_corrections_must_name_picked_garments_with_a_short_type(corrections):
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    r = client.post(f"/v1/outfit-scans/{scan_id}/generate",
                    json={"candidate_ids": ["c1"], "expected_unit_price": None, "corrections": corrections},
                    headers=as_user(A, "g1"))
    assert r.status_code == 400


# --- marking a missed garment ----------------------------------------------------------------------

async def test_a_marked_region_becomes_a_candidate_with_a_preview_and_no_model_call():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    r = client.post(f"/v1/outfit-scans/{scan_id}/regions",
                    json={"box": {"x": 100, "y": 200, "width": 200, "height": 250}, "category": "belt"}, headers=as_user(A))
    assert r.status_code == 200
    added = [c for c in r.json()["candidates"] if c["id"] == "m1"][0]
    assert added["category"] == "belt" and added["preview_url"] and added["uncertainty"].startswith("Marked by you")
    # It can be picked like any other.
    assert generate(client, scan_id, ["m1"]).status_code == 202


@pytest.mark.parametrize("box", [{"x": -5, "y": 0, "width": 50, "height": 50}, {"x": 0, "y": 0, "width": 2, "height": 2},
                                 {"x": 700, "y": 900, "width": 400, "height": 400}])
async def test_a_region_must_be_a_real_area_inside_the_photo(box):
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    r = client.post(f"/v1/outfit-scans/{scan_id}/regions", json={"box": box, "category": "belt"}, headers=as_user(A))
    assert r.status_code == 400


async def test_someone_elses_scan_answers_404_and_the_scan_caps_at_eight_garments():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    box = {"x": 10, "y": 10, "width": 100, "height": 100}
    assert client.post(f"/v1/outfit-scans/{scan_id}/regions", json={"box": box, "category": "belt"}, headers=as_user(B)).status_code == 404
    codes = [client.post(f"/v1/outfit-scans/{scan_id}/regions", json={"box": box, "category": "belt"}, headers=as_user(A)).status_code
             for _ in range(8)]
    assert codes.count(200) == 6 and codes[-1] == 400  # 2 found + 6 marked = 8


# --- regenerate --------------------------------------------------------------------------------------

async def _pending_item(store, client, gate=None):
    scan_id = await scanned(store, client)
    r = generate(client, scan_id, ["c2"], price=1 if gate else None)
    await run_once(store, providers(FakeImageGen()), gate=gate)
    return store.jobs[r.json()["id"]]["result"]["item_ids"][0]


async def test_regenerating_a_pending_result_replaces_its_image_and_charges_one_front():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    item_id = await _pending_item(store, client, gate)
    before = store.items[item_id]["display_path"]
    gate.calls.clear()
    r = client.post(f"/v1/items/{item_id}/regenerate", json={"expected_unit_price": 1}, headers=as_user(A, "regen-1"))
    assert r.status_code == 202 and r.json()["kind"] == "outfit_regenerate" and r.json()["cost_credits"] == 1
    assert gate.calls == [("reserve", A, r.json()["id"], "garment", 1)]
    await run_once(store, providers(FakeImageGen()), gate=gate)
    item = store.items[item_id]
    assert item["display_path"] != before and item["display_path"] in store.files
    assert item["review_state"] == "pending"
    assert gate.calls[-1] == ("settle", r.json()["id"], 1)


async def test_only_your_pending_outfit_results_can_be_regenerated_at_the_price_shown():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    item_id = await _pending_item(store, client, gate)
    assert client.post(f"/v1/items/{item_id}/regenerate", json={"expected_unit_price": 1}, headers=as_user(B, "x")).status_code == 404
    assert client.post(f"/v1/items/{item_id}/regenerate", json={"expected_unit_price": 2}, headers=as_user(A, "y")).status_code == 409
    client.post(f"/v1/items/{item_id}/keep", headers=as_user(A))
    assert client.post(f"/v1/items/{item_id}/regenerate", json={"expected_unit_price": 1}, headers=as_user(A, "z")).status_code == 409
