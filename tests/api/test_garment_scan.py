"""Garment pre-scan (spec D6 b): find the pieces in a garment photo for free, then pay only for the ones picked."""
import pytest
from api.store import MemoryStore
from api.worker import run_once
from tests.api.test_outfit_generate import client_for
from tests.api.test_outfit_scan import Gate, PRICES
from tests.api.test_worker import FakeImageGen, FakeVision, detected, factory, photo_bytes
from tests.api.v1_helpers import A, B, as_user

PNG = ("photo.png", photo_bytes(), "image/png")


class CountingVision(FakeVision):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.calls = 0

    async def detect_items_with_facts(self, image_path):
        self.calls += 1
        return await super().detect_items_with_facts(image_path)


def post_scan(client, user=A, key="gs-1"):
    return client.post("/v1/garment-scans", files={"photo": PNG}, headers=as_user(user, key))


async def scanned(store, client, vision=None, user=A, key="gs-1"):
    r = post_scan(client, user, key)
    assert r.status_code == 202 and r.json()["status"] == "queued"
    await run_once(store, factory(vision=vision))
    return r.json()["id"]


async def test_a_scan_finds_the_pieces_for_free():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    vision = CountingVision()
    scan_id = await scanned(store, client, vision)
    body = client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(A)).json()
    assert body["status"] == "succeeded" and body["quality"]["status"] == "ok"
    assert [p["index"] for p in body["pieces"]] == [0, 1]
    assert body["pieces"][0]["category"] == "hoodie" and set(body["pieces"][0]["box"]) == {"x", "y", "width", "height"}
    assert body["image"]["width"] == 1000
    assert all(c[0] == "reserve" and c[-1] is None for c in gate.calls) and vision.calls == 1  # nothing held or charged


async def test_generating_the_picked_pieces_reuses_the_scan_and_charges_per_front():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    vision = CountingVision()
    scan_id = await scanned(store, client, vision)
    gate.calls.clear()
    r = client.post(f"/v1/garment-scans/{scan_id}/generate", json={"piece_indexes": [1], "expected_unit_price": 1},
                    headers=as_user(A, "gen-1"))
    assert r.status_code == 202 and r.json()["kind"] == "garment" and r.json()["max_fronts"] == 1
    job_id = r.json()["id"]
    assert gate.calls == [("reserve", A, job_id, "garment", 1)]
    await run_once(store, factory(vision=vision), gate=gate)
    job = store.jobs[job_id]
    assert job["status"] == "succeeded" and len(job["result"]["item_ids"]) == 1
    assert vision.calls == 1  # no second detection call
    assert gate.calls[-1] == ("settle", job_id, 1)


async def test_picks_must_be_pieces_of_your_own_finished_scan_at_the_price_shown():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    scan_id = await scanned(store, client)
    gen = lambda body, user=A, key="g": client.post(f"/v1/garment-scans/{scan_id}/generate", json=body, headers=as_user(user, key))
    assert gen({"piece_indexes": [5], "expected_unit_price": 1}).status_code == 400
    assert gen({"piece_indexes": [], "expected_unit_price": 1}, key="g2").status_code == 400
    assert gen({"piece_indexes": [0], "expected_unit_price": 2}, key="g3").status_code == 409
    assert gen({"piece_indexes": [0], "expected_unit_price": 1}, user=B, key="g4").status_code == 404
    assert client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(B)).status_code == 404


async def test_a_photo_with_nothing_to_add_says_why():
    store = MemoryStore()
    client = client_for(store)
    nothing = FakeVision(items=[detected(0).model_copy(update={"included": False, "exclusion_reason": "worn on body"})])
    scan_id = await scanned(store, client, nothing)
    body = client.get(f"/v1/garment-scans/{scan_id}", headers=as_user(A)).json()
    assert body["pieces"] == [] and body["reason"] == "No garment to add: worn on body"
