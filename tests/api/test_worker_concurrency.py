"""WARDROBE_WORKER_CONCURRENCY: the in-process worker can run more than one job at a time."""
import asyncio
import pytest
from api.controls import worker_concurrency
from api.store import MemoryStore
from api.worker import run_forever
from tests.api.test_worker import FakeImageGen, factory, garment_job


class GatedImageGen(FakeImageGen):
    """Each generate call waits until the test opens the gate; counts how many wait at once."""
    def __init__(self):
        super().__init__()
        self.gate, self.waiting, self.most = asyncio.Event(), 0, 0

    async def generate(self, crop_path, facts, violations, complete_edges=False):
        self.waiting += 1
        self.most = max(self.most, self.waiting)
        await self.gate.wait()
        self.waiting -= 1
        return await super().generate(crop_path, facts, violations, complete_edges)


async def until(check, seconds=10.0):
    for _ in range(int(seconds / 0.02)):
        if check():
            return True
        await asyncio.sleep(0.02)
    return False


async def run_two_jobs(concurrency):
    store, imagegen = MemoryStore(), GatedImageGen()
    jobs = [garment_job(store, key="k1"), garment_job(store, key="k2")]
    task = asyncio.create_task(run_forever(store, factory(imagegen=imagegen), idle_seconds=0.01, concurrency=concurrency))
    try:
        await until(lambda: imagegen.waiting > 0)
        await asyncio.sleep(0.3)  # time for a second loop to pick up the other job, if there is one
        overlapped = sum(store.jobs[j]["status"] == "running" for j in jobs)
        imagegen.gate.set()
        assert await until(lambda: all(store.jobs[j]["status"] == "succeeded" for j in jobs))
    finally:
        task.cancel()
    return store, jobs, overlapped


async def test_by_default_jobs_run_one_at_a_time():
    store, jobs, overlapped = await run_two_jobs(1)
    assert overlapped == 1
    first, second = (store.jobs[j] for j in jobs)
    assert first["finished_at"] <= second["started_at"]  # oldest first, strictly one after the other


async def test_two_loops_run_two_jobs_at_once_and_each_job_runs_once():
    store, jobs, overlapped = await run_two_jobs(2)
    assert overlapped == 2
    assert all(store.jobs[j]["attempts"] == 1 for j in jobs)
    assert len(store.list_items("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")) == 4  # two pieces per photo, no duplicates


async def test_an_error_in_one_loop_does_not_stop_the_others(monkeypatch):
    store = MemoryStore()
    real_claim, calls = store.claim_job, []

    def flaky_claim(lease_seconds):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("database unreachable")
        return real_claim(lease_seconds)

    monkeypatch.setattr(store, "claim_job", flaky_claim)
    job = garment_job(store)
    task = asyncio.create_task(run_forever(store, factory(), idle_seconds=0.01, concurrency=2))
    try:
        assert await until(lambda: store.jobs[job]["status"] == "succeeded")
    finally:
        task.cancel()


@pytest.mark.parametrize("raw, expected", [(None, 1), ("", 1), ("2", 2), ("0", 1), ("9", 4), ("lots", 1)])
def test_concurrency_comes_from_the_environment_within_bounds(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("WARDROBE_WORKER_CONCURRENCY", raising=False)
    else:
        monkeypatch.setenv("WARDROBE_WORKER_CONCURRENCY", raw)
    assert worker_concurrency() == expected
