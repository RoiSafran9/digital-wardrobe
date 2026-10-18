"""Storage sweeper: files of deleted accounts and stale job uploads go; everything else stays."""
from datetime import datetime, timedelta, timezone
from api.store import MemoryStore
from scripts.sweep_storage import apply_sweep, plan_sweep

A, GONE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
NOW = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)
OLD, NEW = NOW - timedelta(days=8), NOW - timedelta(days=1)


def put(store, path, when):
    store.upload(path, b"x", "image/png")
    store.file_times[path] = when


def job(store, status, key):
    j, _ = store.create_job(A, "garment", key, None)
    store.jobs[j["id"]]["status"] = status
    return j["id"]


def setup():
    store = MemoryStore()
    store.deleted_users.add(GONE)
    put(store, f"{GONE}/items/i1/generated.png", NEW)
    put(store, f"{A}/items/i1/generated.png", OLD)
    done, running, recent = job(store, "succeeded", "k1"), job(store, "running", "k2"), job(store, "failed", "k3")
    put(store, f"{A}/jobs/{done}/upload.jpg", OLD)
    put(store, f"{A}/jobs/{running}/upload.jpg", OLD)
    put(store, f"{A}/jobs/{recent}/upload.jpg", NEW)
    put(store, f"{A}/jobs/00000000-0000-4000-8000-000000000000/upload.jpg", OLD)  # job never recorded
    put(store, "stray.png", OLD)
    return store, done, running, recent


def test_the_plan_removes_only_dead_files():
    store, done, running, recent = setup()
    sweep = plan_sweep(store, NOW)
    assert sorted(sweep.remove) == sorted([
        f"{GONE}/items/i1/generated.png",
        f"{A}/jobs/{done}/upload.jpg",
        f"{A}/jobs/00000000-0000-4000-8000-000000000000/upload.jpg",
    ])
    assert sweep.kept["stray.png"] == "not in a user folder"
    assert sweep.kept[f"{A}/jobs/{running}/upload.jpg"] == "job still running"
    assert sweep.kept[f"{A}/jobs/{recent}/upload.jpg"] == "newer than 7 days"
    assert f"{A}/items/i1/generated.png" not in sweep.remove


def test_planning_deletes_nothing():
    store, *_ = setup()
    before = dict(store.files)
    plan_sweep(store, NOW)
    assert store.files == before


def test_applying_removes_the_planned_files():
    store, *_ = setup()
    sweep = plan_sweep(store, NOW)
    apply_sweep(store, sweep)
    assert not set(sweep.remove) & set(store.files)
    assert f"{A}/items/i1/generated.png" in store.files and "stray.png" in store.files
