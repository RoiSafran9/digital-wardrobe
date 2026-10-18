"""The in-memory store behaves like the database rules the API and worker rely on."""
from datetime import datetime, timedelta, timezone
from api.store import MemoryStore

A, B = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"


def item_row(user, job_id=None, piece=None, **extra):
    return {"user_id": user, "job_id": job_id, "piece_index": piece, "facts": {"category": {"value": "shorts"}},
            "tier": "high", "source_path": f"{user}/items/x/source.jpg", "display_path": f"{user}/items/x/generated.png", **extra}


def test_job_keys_are_idempotent_per_user():
    s = MemoryStore()
    job, created = s.create_job(A, "garment", "k1", f"{A}/jobs/1/upload.jpg")
    again, created_again = s.create_job(A, "garment", "k1", f"{A}/jobs/2/upload.jpg")
    other, created_other = s.create_job(B, "garment", "k1", None)
    assert (created, created_again, created_other) == (True, False, True)
    assert again["id"] == job["id"] and other["id"] != job["id"]
    assert s.job_by_key(A, "k1")["id"] == job["id"]


def test_users_only_get_their_own_jobs_and_items():
    s = MemoryStore()
    job, _ = s.create_job(A, "garment", "k1", None)
    item = s.insert_item(item_row(A))
    assert s.get_job(B, job["id"]) is None and s.get_job(A, job["id"])["id"] == job["id"]
    assert s.get_item(B, item["id"]) is None and s.list_items(B) == []
    assert s.update_item(B, item["id"], {"deleted_at": "now"}) is None
    assert s.get_item(A, item["id"])["deleted_at"] is None


def test_claim_takes_the_oldest_queued_job_and_leases_it():
    s = MemoryStore()
    first, _ = s.create_job(A, "garment", "k1", None)
    s.create_job(B, "garment", "k2", None)
    claimed = s.claim_job(60)
    assert claimed["id"] == first["id"] and claimed["status"] == "running" and claimed["attempts"] == 1
    assert s.claim_job(60)["id"] != first["id"]
    assert s.claim_job(60) is None


def test_an_expired_lease_is_reclaimed_until_attempts_run_out():
    s = MemoryStore()
    job, _ = s.create_job(A, "garment", "k1", None)
    s.claim_job(60)
    s.jobs[job["id"]]["locked_until"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert s.claim_job(60)["attempts"] == 2
    s.jobs[job["id"]]["locked_until"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    assert s.claim_job(60) is None  # max_attempts reached: marked failed instead
    assert s.get_job(A, job["id"])["status"] == "failed"


def test_items_from_a_job_are_not_duplicated_on_retry():
    s = MemoryStore()
    job, _ = s.create_job(A, "garment", "k1", None)
    one = s.insert_item(item_row(A, job["id"], 0))
    two = s.insert_item(item_row(A, job["id"], 0))
    assert one["id"] == two["id"] and len(s.list_items(A)) == 1


def test_first_facts_edit_keeps_the_original():
    s = MemoryStore()
    item = s.insert_item(item_row(A))
    s.update_item(A, item["id"], {"facts": {"category": {"value": "pants"}}})
    s.update_item(A, item["id"], {"facts": {"category": {"value": "jeans"}}})
    assert s.get_item(A, item["id"])["facts_original"] == {"category": {"value": "shorts"}}


def test_deleted_items_are_hidden():
    s = MemoryStore()
    item = s.insert_item(item_row(A))
    s.update_item(A, item["id"], {"deleted_at": "2026-10-18T00:00:00Z"})
    assert s.list_items(A) == [] and s.get_item(A, item["id"]) is None


def test_files_and_signed_urls():
    s = MemoryStore()
    s.upload(f"{A}/x.png", b"png", "image/png")
    assert s.download(f"{A}/x.png") == b"png"
    assert s.sign([f"{A}/x.png"])[f"{A}/x.png"].startswith("https://storage.test/")
    s.remove([f"{A}/x.png"])
    assert f"{A}/x.png" not in s.files
