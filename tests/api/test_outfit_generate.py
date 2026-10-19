"""Outfit Photo M2: generate only the picked garments, price consent, wallet hold/charge, review before closet."""
import os
from datetime import datetime, timedelta, timezone
import cv2
import numpy as np
import pytest
from api.credits import get_gate, get_prices
from api.store import MemoryStore
from api.worker import run_once
from pipeline.orchestrator import Providers
from tests.api.test_outfit_scan import FakeVision, Gate, PRICES, photo_jpeg, post_scan
from tests.api.v1_helpers import A, B, as_user, v1_client


class FakeImageGen:
    """Writes a white catalog image per picked candidate; IDs in fail are reported as failed."""
    def __init__(self, fail=()):
        self.fail, self.calls = set(fail), []

    async def generate_outfit(self, image_path, scan, candidate_ids, out_dir):
        self.calls.append(list(candidate_ids))
        results = {}
        for cid in candidate_ids:
            if cid in self.fail:
                results[cid] = {"status": "failed", "error": "model refused"}
                continue
            d = os.path.join(out_dir, cid)
            os.makedirs(d, exist_ok=True)
            cv2.imwrite(os.path.join(d, "crop.png"), np.full((50, 40, 3), 90, np.uint8))
            cv2.imwrite(os.path.join(d, "generated.png"), np.full((64, 64, 3), 255, np.uint8))
            results[cid] = {"status": "generated", "attempts": 1}
        return results


def providers(imagegen):
    return lambda logger: Providers(vision=FakeVision(), imagegen=imagegen)


@pytest.fixture(autouse=True)
def on(monkeypatch):
    monkeypatch.setenv("WARDROBE_OUTFIT", "on")


def client_for(store, prices=None, gate=None):
    client = v1_client(store)
    if prices is not None:
        client.app.dependency_overrides[get_prices] = lambda: prices
    if gate is not None:
        client.app.dependency_overrides[get_gate] = lambda: gate
    return client


async def scanned(store, client, user=A, key="scan-1"):
    """A finished scan with candidates c1 (jacket) and c2 (jeans)."""
    scan_id = post_scan(client, user=user, key=key).json()["id"]
    store.files[store.jobs[scan_id]["input_path"]] = photo_jpeg()
    await run_once(store, lambda logger: Providers(vision=FakeVision(), imagegen=None))
    assert store.jobs[scan_id]["status"] == "succeeded"
    return scan_id


def generate(client, scan_id, ids, price=None, user=A, key="gen-1"):
    return client.post(f"/v1/outfit-scans/{scan_id}/generate", json={"candidate_ids": ids, "expected_unit_price": price},
                       headers=as_user(user, key))


async def test_only_the_picked_garment_is_generated_and_waits_for_review():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    r = generate(client, scan_id, ["c2"])
    assert r.status_code == 202 and r.json()["kind"] == "outfit_generate"
    imagegen = FakeImageGen()
    await run_once(store, providers(imagegen))
    assert imagegen.calls == [["c2"]]
    job = client.get(f"/v1/jobs/{r.json()['id']}", headers=as_user(A)).json()
    assert job["status"] == "succeeded" and len(job["item_ids"]) == 1
    item = store.items[job["item_ids"][0]]
    assert item["origin"] == "outfit_photo" and item["review_state"] == "pending" and item["source_kind"] == "crop"
    assert item["facts"]["category"]["value"] == "jeans"
    assert item["source_path"] == item["crop_path"] and "/scans/" not in item["source_path"]  # no person photo on the item
    assert client.get("/v1/items", headers=as_user(A)).json()["items"] == []  # not in the closet until kept
    pending = client.get(f"/v1/items/{item['id']}", headers=as_user(A)).json()
    assert pending["review_state"] == "pending" and pending["origin"] == "outfit_photo"


async def test_keep_puts_it_in_the_closet_and_delete_discards_it():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    job_id = generate(client, scan_id, ["c1", "c2"]).json()["id"]
    await run_once(store, providers(FakeImageGen()))
    kept, discarded = store.jobs[job_id]["result"]["item_ids"]
    assert client.post(f"/v1/items/{kept}/keep", headers=as_user(A)).json()["review_state"] == "kept"
    assert client.delete(f"/v1/items/{discarded}", headers=as_user(A)).status_code == 204
    assert [i["id"] for i in client.get("/v1/items", headers=as_user(A)).json()["items"]] == [kept]
    assert client.post(f"/v1/items/{kept}/keep", headers=as_user(B)).status_code == 404


async def test_billing_holds_one_front_per_pick_and_charges_only_what_was_made():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    scan_id = await scanned(store, client)
    gate.calls.clear()
    r = generate(client, scan_id, ["c1", "c2"], price=1)
    assert r.status_code == 202 and r.json()["cost_credits"] == 1 and r.json()["max_fronts"] == 2
    job_id = r.json()["id"]
    assert gate.calls == [("reserve", A, job_id, "garment", 2)]  # the existing front-image action
    await run_once(store, providers(FakeImageGen(fail={"c1"})), gate=gate)
    assert store.jobs[job_id]["result"]["failed"] == ["c1"]
    assert gate.calls[-1] == ("settle", job_id, 1)  # one image made, one credit; the failed pick is free


async def test_a_changed_price_is_refused_before_anything_is_held():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    scan_id = await scanned(store, client)
    gate.calls.clear()
    assert generate(client, scan_id, ["c1"], price=None).status_code == 409  # shown "free", billing is on
    assert generate(client, scan_id, ["c1"], price=2, key="gen-2").status_code == 409
    assert gate.calls == [] and all(j["kind"] != "outfit_generate" for j in store.jobs.values())


async def test_billing_off_holds_nothing_and_needs_no_price():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, {}, gate)
    scan_id = await scanned(store, client)
    r = generate(client, scan_id, ["c1"])
    assert r.status_code == 202 and r.json()["cost_credits"] is None and r.json()["max_fronts"] is None
    assert generate(client, scan_id, ["c1"], price=1, key="gen-2").status_code == 409


async def test_a_retry_with_the_same_key_returns_the_same_job():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    first = generate(client, scan_id, ["c1"])
    again = generate(client, scan_id, ["c1"])
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    assert sum(j["kind"] == "outfit_generate" for j in store.jobs.values()) == 1


@pytest.mark.parametrize("ids,status", [([], 400), (["c9"], 400), (["c1"] * 1 + [f"x{i}" for i in range(8)], 400)])
async def test_picks_must_come_from_the_scan(ids, status):
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    assert generate(client, scan_id, ids).status_code == status


async def test_duplicate_picks_count_once():
    store = MemoryStore()
    client = client_for(store, PRICES, Gate())
    scan_id = await scanned(store, client)
    assert generate(client, scan_id, ["c1", "c1"], price=1).json()["max_fronts"] == 1


async def test_another_users_scan_unfinished_or_expired_scan_is_refused():
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    assert generate(client, scan_id, ["c1"], user=B).status_code == 404
    pending = post_scan(client, key="scan-2").json()["id"]
    assert generate(client, pending, ["c1"], key="gen-2").status_code == 409
    store.jobs[scan_id]["result"]["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert generate(client, scan_id, ["c1"], key="gen-3").status_code == 410


async def test_a_scan_that_expires_before_the_worker_runs_fails_and_refunds():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    scan_id = await scanned(store, client)
    job_id = generate(client, scan_id, ["c1"], price=1).json()["id"]
    store.jobs[scan_id]["result"]["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    imagegen = FakeImageGen()
    await run_once(store, providers(imagegen), gate=gate)
    assert store.jobs[job_id]["status"] == "failed" and "expired" in store.jobs[job_id]["error"]
    assert imagegen.calls == [] and gate.calls[-1] == ("refund", job_id)


async def test_all_picks_failing_fails_the_job_and_refunds():
    store, gate = MemoryStore(), Gate()
    client = client_for(store, PRICES, gate)
    scan_id = await scanned(store, client)
    job_id = generate(client, scan_id, ["c1", "c2"], price=1).json()["id"]
    await run_once(store, providers(FakeImageGen(fail={"c1", "c2"})), gate=gate)
    assert store.jobs[job_id]["status"] == "failed" and gate.calls[-1] == ("refund", job_id)
    assert not any(i["job_id"] == job_id for i in store.items.values())


async def test_routes_are_off_without_the_flag(monkeypatch):
    store = MemoryStore()
    client = client_for(store)
    scan_id = await scanned(store, client)
    monkeypatch.delenv("WARDROBE_OUTFIT")
    assert generate(client, scan_id, ["c1"]).status_code == 404
