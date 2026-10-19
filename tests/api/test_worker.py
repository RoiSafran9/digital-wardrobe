"""The worker runs the existing pipeline for queued jobs and stores the results for the job's owner."""
import shutil
import cv2
import numpy as np
import pytest
from api.store import MemoryStore
from api.worker import run_once
from pipeline.orchestrator import Providers
from pipeline.types import BBox, DetectedItemWithFacts, FactField

A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def photo_bytes(size=1000):
    rng = np.random.default_rng(0)
    return cv2.imencode(".png", (rng.random((size, size, 3)) * 255).astype(np.uint8))[1].tobytes()


def detected(x=0, text=""):
    f = FactField(value="gray", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=x, y=100, width=300, height=400), included=True, exclusion_reason=None,
        category=FactField(value="hoodie", confidence=0.9, basis="observed"), colors=f, pattern=f,
        visible_text=FactField(value=text, confidence=0.9, basis="observed"), trims=f,
        visible_parts=FactField(value=["front"], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=[], confidence=0.9, basis="observed"))


class FakeVision:
    def __init__(self, items=None, crash=False):
        self.items, self.crash = items if items is not None else [detected(0), detected(500)], crash

    async def detect_items_with_facts(self, image_path):
        if self.crash:
            raise RuntimeError("model unavailable")
        return self.items


class FakeImageGen:
    def __init__(self, fail_views=False):
        self.fail_views, self.refs = fail_views, []

    async def generate(self, crop_path, facts, violations, complete_edges=False):
        out = crop_path.replace("crop.png", "generated.png")
        shutil.copy(crop_path, out)
        return out

    async def generate_back(self, crop_path, front_image_path, facts, violations, complete_edges=False):
        out = crop_path.replace(".png", "_generated.png")
        shutil.copy(crop_path, out)
        return out

    async def generate_view(self, refs, view, anchors, retry_note=None):
        self.refs.append(refs)
        if self.fail_views:
            raise RuntimeError("quota")
        img = np.full((100, 100, 3), 255, dtype=np.uint8)
        img[20:80, 30:70] = (40, 50, 90)
        return cv2.imencode(".png", img)[1].tobytes()


def factory(vision=None, imagegen=None):
    return lambda logger: Providers(vision=vision or FakeVision(), imagegen=imagegen or FakeImageGen())


def garment_job(store, data=None, key="k1"):
    job, _ = store.create_job(A, "garment", key, None)
    path = f"{A}/jobs/{job['id']}/upload.png"
    store.jobs[job["id"]]["input_path"] = path
    store.upload(path, data or photo_bytes(), "image/png")
    return job["id"]


async def test_empty_queue_does_nothing():
    assert await run_once(MemoryStore(), factory()) is False


async def test_a_garment_job_stores_one_item_per_piece_in_the_owners_folder():
    store = MemoryStore()
    job_id = garment_job(store)
    assert await run_once(store, factory()) is True
    job = store.jobs[job_id]
    assert job["status"] == "succeeded" and job["result"]["quality"]["status"] == "ok"
    items = store.list_items(A)
    assert sorted(i["id"] for i in items) == sorted(job["result"]["item_ids"]) and len(items) == 2
    for item in items:
        base = f"{A}/items/{item['id']}/"
        assert item["job_id"] == job_id and item["source_kind"] == "original"
        assert item["source_path"] == base + "source.png" and store.files[item["source_path"]] == photo_bytes()
        for key in ("display_path", "crop_path"):
            assert item[key].startswith(base) and item[key] in store.files
        assert item["cutout_path"] is None or item["cutout_path"] in store.files  # rembg may find nothing to cut
        assert item["facts"]["category"]["value"] == "hoodie"
    assert sorted(i["piece_index"] for i in items) == [0, 1]
    assert job["input_path"] not in store.files  # the upload lives on as each item's source


async def test_rerunning_a_job_after_a_crash_creates_no_duplicates():
    store = MemoryStore()
    job_id = garment_job(store)
    await run_once(store, factory())
    first = sorted(i["id"] for i in store.list_items(A))
    store.jobs[job_id].update(status="queued")
    store.upload(store.jobs[job_id]["input_path"], photo_bytes(), "image/png")
    await run_once(store, factory())
    assert sorted(i["id"] for i in store.list_items(A)) == first


async def test_a_photo_that_needs_a_retake_finishes_with_no_items():
    store = MemoryStore()
    job_id = garment_job(store, photo_bytes(size=100))
    await run_once(store, factory())
    job = store.jobs[job_id]
    assert job["status"] == "succeeded" and job["result"]["quality"]["status"] == "retake"
    assert store.list_items(A) == []


async def test_a_photo_with_no_garment_fails_with_a_reason_instead_of_finishing_empty():
    # A job that ends with nothing to show must say why; "succeeded" with no items looked like a hang.
    store = MemoryStore()
    job_id = garment_job(store)
    await run_once(store, factory(FakeVision([])))
    job = store.jobs[job_id]
    assert job["status"] == "failed"
    assert "no garment" in job["error"].lower()
    assert store.list_items(A) == []


async def test_a_photo_whose_pieces_were_all_left_out_gives_the_models_reason():
    store = MemoryStore()
    job_id = garment_job(store)
    left_out = detected(0).model_copy(update={"included": False, "exclusion_reason": "being worn by a person"})
    await run_once(store, factory(FakeVision([left_out])))
    job = store.jobs[job_id]
    assert job["status"] == "failed" and "being worn by a person" in job["error"]


async def test_large_photo_crops_are_stored_as_bounded_jpegs():
    # Full-resolution phone photos made crop PNGs over the bucket's 25 MB limit.
    store = MemoryStore()
    garment_job(store, photo_bytes(size=3000))
    big = detected(0).model_copy(update={"box": BBox(x=0, y=0, width=2990, height=2990)})
    await run_once(store, factory(FakeVision([big])))
    item = store.list_items(A)[0]
    assert item["crop_path"].endswith("/crop.jpg")
    crop = cv2.imdecode(np.frombuffer(store.files[item["crop_path"]], np.uint8), cv2.IMREAD_COLOR)
    assert max(crop.shape[:2]) <= 2048


async def add_front(store):
    job_id = garment_job(store, key="front")
    await run_once(store, factory(FakeVision([detected(0)])))
    return store.list_items(A)[0]


def queue(store, kind, item_id, key, data=None):
    job, _ = store.create_job(A, kind, key, None, item_id=item_id)
    if data:
        path = f"{A}/jobs/{job['id']}/upload.png"
        store.jobs[job["id"]]["input_path"] = path
        store.upload(path, data, "image/png")
    return job["id"]


async def test_a_back_job_adds_the_back_to_the_item():
    store = MemoryStore()
    item = await add_front(store)
    job_id = queue(store, "back", item["id"], "b1", photo_bytes())
    await run_once(store, factory(FakeVision([detected(0, text="TEAM 9")])))
    assert store.jobs[job_id]["status"] == "succeeded"
    back = store.get_item(A, item["id"])["back"]
    assert back["visible_text"] == "TEAM 9"
    assert back["generated_path"] == f"{A}/items/{item['id']}/back/{job_id}/generated.png"
    assert back["generated_path"] in store.files and back["crop_path"] in store.files
    assert back["crop_path"].endswith("/crop.jpg")  # photo crops are bounded JPEGs, like the front's


async def test_an_unusable_back_photo_fails_with_its_reason_and_is_not_retried():
    store = MemoryStore()
    item = await add_front(store)
    files_before = set(store.files)
    job_id = queue(store, "back", item["id"], "b1", photo_bytes())
    await run_once(store, factory(FakeVision([])))
    job = store.jobs[job_id]
    assert job["status"] == "failed" and job["error"].startswith("No garment found")
    assert store.get_item(A, item["id"])["back"] is None
    assert set(store.files) == files_before


async def test_a_360_job_stores_four_views_using_the_back_text():
    store = MemoryStore()
    item = await add_front(store)
    queue(store, "back", item["id"], "b1", photo_bytes())
    await run_once(store, factory(FakeVision([detected(0, text="TEAM 9")])))
    imagegen = FakeImageGen()
    job_id = queue(store, "turn", item["id"], "t1")
    await run_once(store, factory(imagegen=imagegen))
    turn = store.get_item(A, item["id"])["turn"]
    assert store.jobs[job_id]["status"] == "succeeded" and turn["state"] == "done"
    assert [v["angle"] for v in turn["views"]] == ["front", "right", "back", "left"]
    assert all(v["path"].startswith(f"{A}/items/{item['id']}/turn/{job_id}/") and v["path"] in store.files for v in turn["views"])
    assert imagegen.refs[0].back.text == "TEAM 9"


async def test_a_failed_360_says_so_on_the_item():
    store = MemoryStore()
    item = await add_front(store)
    job_id = queue(store, "turn", item["id"], "t1")
    await run_once(store, factory(imagegen=FakeImageGen(fail_views=True)))
    assert store.jobs[job_id]["status"] == "failed"
    assert store.get_item(A, item["id"])["turn"] == {"state": "failed", "error": "Couldn't create the 360 view — try again"}


async def test_unexpected_errors_are_retried_then_fail_and_clean_up():
    store = MemoryStore()
    job_id = garment_job(store)
    upload = store.jobs[job_id]["input_path"]
    await run_once(store, factory(FakeVision(crash=True)))
    assert store.jobs[job_id]["status"] == "queued" and upload in store.files
    await run_once(store, factory(FakeVision(crash=True)))
    job = store.jobs[job_id]
    assert job["status"] == "failed" and job["error"] == "Something went wrong — try again"
    assert store.files == {} and store.list_items(A) == []


async def test_a_job_for_an_item_deleted_meanwhile_fails_cleanly():
    store = MemoryStore()
    item = await add_front(store)
    job_id = queue(store, "turn", item["id"], "t1")
    store.update_item(A, item["id"], {"deleted_at": "2026-10-18T00:00:00Z"})
    await run_once(store, factory())
    assert store.jobs[job_id]["status"] == "failed" and store.jobs[job_id]["error"] == "That item no longer exists"


class Gate:
    def __init__(self):
        self.calls = []

    def reserve(self, *a): self.calls.append(("reserve",) + a)
    def release(self, job_id): self.calls.append(("release", job_id))
    def settle(self, job_id, amount): self.calls.append(("settle", job_id, amount))
    def refund(self, job_id): self.calls.append(("refund", job_id))
    def reconcile(self): return 0


async def test_a_successful_job_settles_its_credits_once():
    store, gate = MemoryStore(), Gate()
    job_id = garment_job(store)
    await run_once(store, factory(), gate=gate)
    assert gate.calls == [("settle", job_id, 0)]  # billing was off for this job: nothing to charge


async def test_a_failed_job_refunds_only_when_it_is_final():
    store, gate = MemoryStore(), Gate()
    job_id = garment_job(store)
    await run_once(store, factory(FakeVision(crash=True)), gate=gate)
    assert gate.calls == []  # retried: still holding
    await run_once(store, factory(FakeVision(crash=True)), gate=gate)
    assert gate.calls == [("refund", job_id)]


async def test_a_rejected_job_refunds():
    store, gate = MemoryStore(), Gate()
    item = await add_front(store)
    job_id = queue(store, "back", item["id"], "b1", photo_bytes())
    await run_once(store, factory(FakeVision([])), gate=gate)
    assert gate.calls == [("refund", job_id)]


async def test_a_garment_job_reports_progress_per_piece():
    store = MemoryStore()
    seen = []
    original = store.set_job_progress
    store.set_job_progress = lambda job_id, done, total: (seen.append((done, total)), original(job_id, done, total))
    job_id = garment_job(store)
    await run_once(store, factory())
    assert seen[0] == (0, 2) and seen[-1] == (2, 2)
    assert store.jobs[job_id]["progress"] == {"done": 2, "total": 2}
