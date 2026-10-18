"""Moving the owner's local runs/ into their account: planned read-only, applied idempotently."""
import json
import os
from api.store import MemoryStore
from scripts.migrate_runs import apply_migration, plan_migration, summary

A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


def _field(v):
    return {"value": v, "confidence": 0.9, "basis": "observed"}


def facts(category="hoodie", text=""):
    return {"category": _field(category), "colors": _field(["gray"]), "pattern": _field("solid"),
            "visible_text": _field(text), "trims": _field(""), "visible_parts": _field(["front"]),
            "occluded_parts": _field([])}


def write_item(root, rel, generated=True, edited=False, back=False, turn=None, broken=False):
    d = root / rel
    d.mkdir(parents=True)
    (d / "crop.png").write_bytes(b"crop")
    if generated:
        (d / "generated.png").write_bytes(b"generated")
        (d / "cutout.png").write_bytes(b"cutout")
    (d / "facts.json").write_text("{" if broken else json.dumps(facts("coat" if edited else "hoodie")))
    if edited:
        (d / "facts.original.json").write_text(json.dumps(facts("hoodie")))
    (d / "result.json").write_text(json.dumps({"tier": "high", "reason": "ok", "retake_instruction": None, "visible_fraction": 1.0}))
    if back:
        (d / "back").mkdir()
        for name in ("crop.png", "generated.png", "cutout.png"):
            (d / "back" / name).write_bytes(b"back-" + name.encode())
        (d / "back" / "facts.json").write_text(json.dumps(facts(text="TEAM 9")))
    if turn:
        (d / "turn").mkdir()
        (d / "turn" / "status.json").write_text(json.dumps({"state": turn, "error": None, "started_at": "2026-10-17T00:00:00+00:00"}))
        if turn == "done":
            for view in ("front", "right", "back", "left"):
                (d / "turn" / f"{view}.png").write_bytes(view.encode())
                (d / "turn" / f"{view}_cutout.png").write_bytes(view.encode())
    return d


def fixture(tmp_path):
    root = tmp_path / "runs"
    write_item(root, "run1/photo/item_0", back=True, turn="done")
    write_item(root, "run1/photo/item_1", generated=False)                 # retake only
    write_item(root, "run2/photo/item_0", edited=True, turn="running")     # turn never finished
    write_item(root, "run2/photo/item_1", broken=True)                     # unreadable facts
    write_item(root, ".trash/run3/photo/item_0")                           # removed by the owner
    (root / ".trash/run1/photo/item_0/back-1700000000").mkdir(parents=True)  # an old back, not an item
    return root


def by_key(items):
    return {i.legacy_key: i for i in items}


def test_the_plan_finds_items_and_says_why_it_skips_others(tmp_path):
    items = by_key(plan_migration(str(fixture(tmp_path))))
    assert set(items) == {"run1/photo/item_0", "run1/photo/item_1", "run2/photo/item_0", "run2/photo/item_1",
                          ".trash/run3/photo/item_0"}
    assert items["run1/photo/item_1"].skip == "retake only (no catalog image)"
    assert items["run2/photo/item_1"].skip == "unreadable facts or result"
    assert items[".trash/run3/photo/item_0"].deleted and items[".trash/run3/photo/item_0"].skip is None
    first = items["run1/photo/item_0"]
    assert first.has_back and first.back_text == "TEAM 9" and first.turn_views == ["front", "right", "back", "left"]
    assert items["run2/photo/item_0"].turn_views == [] and items["run2/photo/item_0"].facts_original["category"]["value"] == "hoodie"


def test_planning_never_writes(tmp_path):
    root = fixture(tmp_path)
    before = sorted((p, os.path.getmtime(p)) for p in map(str, root.rglob("*")))
    summary(plan_migration(str(root)))
    assert sorted((p, os.path.getmtime(p)) for p in map(str, root.rglob("*"))) == before


def test_summary_counts(tmp_path):
    text = summary(plan_migration(str(fixture(tmp_path))))
    assert "3 items to migrate (2 in the closet, 1 removed)" in text
    assert "1 with a back, 1 with a 360 view" in text
    assert "2 skipped" in text and "retake only (no catalog image): 1" in text


def test_apply_uploads_into_the_owners_folder_and_is_idempotent(tmp_path):
    store = MemoryStore()
    items = plan_migration(str(fixture(tmp_path)))
    report = apply_migration(store, A, items)
    assert (report.created, report.existing, report.skipped) == (3, 0, 2)
    assert all(path.startswith(f"{A}/items/") for path in store.files)

    rows = {r["legacy_key"]: r for r in store.items.values()}
    first = rows["run1/photo/item_0"]
    assert first["source_kind"] == "crop" and store.files[first["source_path"]] == b"crop"
    assert store.files[first["display_path"]] == b"generated" and first["deleted_at"] is None
    assert first["back"]["visible_text"] == "TEAM 9" and store.files[first["back"]["generated_path"]] == b"back-generated.png"
    assert first["turn"]["state"] == "done" and len(first["turn"]["views"]) == 4
    assert rows["run2/photo/item_0"]["facts_original"]["category"]["value"] == "hoodie"
    assert rows["run2/photo/item_0"]["facts"]["category"]["value"] == "coat" and rows["run2/photo/item_0"]["turn"] is None
    assert rows[".trash/run3/photo/item_0"]["deleted_at"] is not None

    files = dict(store.files)
    again = apply_migration(store, A, items)
    assert (again.created, again.existing) == (0, 3)
    assert len(store.items) == 3 and store.files == files
