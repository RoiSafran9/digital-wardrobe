"""Move the owner's local wardrobe (runs/) into their Supabase account.

Dry run by default: reads runs/ and prints what would be migrated; nothing is written anywhere.

Usage (from the repo root):
  python -m scripts.migrate_runs                                  # dry run of ./runs
  python -m scripts.migrate_runs --email you@example.com --apply  # upload (needs SUPABASE_URL, SUPABASE_SECRET_KEY)

Re-running is safe: items already migrated (same legacy_key) are skipped. Local files are never
changed or deleted. Legacy items kept only their crop, so it becomes the item's source photo.
"""
import argparse
import glob
import json
import os
import re
import sys
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from api.item_loader import load_item
from pipeline.turn import TURN_ORDER
from pipeline.types import ItemFacts

ITEM_DIR = re.compile(r"item_\d+(-\d+)?$")


@dataclass
class LegacyItem:
    legacy_key: str
    path: str
    deleted: bool
    skip: str | None = None
    tier: str | None = None
    facts: dict | None = None
    facts_original: dict | None = None
    has_back: bool = False
    back_text: str = ""
    turn_views: list[str] = field(default_factory=list)


@dataclass
class Report:
    created: int = 0
    existing: int = 0
    skipped: int = 0


def _iso(path: str) -> str:
    return datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).isoformat()


def _text(facts_path: str) -> str:
    try:
        with open(facts_path) as f:
            value = ItemFacts.model_validate_json(f.read()).visible_text.value
    except (OSError, ValueError):
        return ""
    return " ".join(value) if isinstance(value, list) else value


def _turn_views(item_dir: str) -> list[str]:
    try:
        with open(os.path.join(item_dir, "turn", "status.json")) as f:
            done = json.load(f).get("state") == "done"
    except (OSError, ValueError, AttributeError):
        return []
    return [v for v in TURN_ORDER if done and os.path.exists(os.path.join(item_dir, "turn", f"{v}.png"))]


def _read(item_dir: str, root: str, deleted: bool) -> LegacyItem:
    item = LegacyItem(legacy_key=os.path.relpath(item_dir, root), path=item_dir, deleted=deleted)
    loaded = load_item(item_dir)
    if loaded is None:
        item.skip = "unreadable facts or result"
        return item
    _, result, facts = loaded
    if not os.path.exists(os.path.join(item_dir, "generated.png")):
        item.skip = "retake only (no catalog image)"
        return item
    item.tier, item.facts = result.tier, facts.model_dump(mode="json")
    original = os.path.join(item_dir, "facts.original.json")
    if os.path.exists(original):
        try:
            with open(original) as f:
                item.facts_original = ItemFacts.model_validate_json(f.read()).model_dump(mode="json")
        except (OSError, ValueError):
            pass
    item.has_back = os.path.exists(os.path.join(item_dir, "back", "generated.png"))
    item.back_text = _text(os.path.join(item_dir, "back", "facts.json")) if item.has_back else ""
    item.turn_views = _turn_views(item_dir)
    return item


def plan_migration(runs_dir: str) -> list[LegacyItem]:
    """Everything that looks like an item under runs/ (closet and trash), read-only."""
    items = []
    for deleted, pattern in ((False, os.path.join(runs_dir, "*", "*", "item_*")),
                             (True, os.path.join(runs_dir, ".trash", "*", "*", "item_*"))):
        for item_dir in sorted(glob.glob(pattern)):
            if not os.path.isdir(item_dir) or not ITEM_DIR.match(os.path.basename(item_dir)):
                continue
            if not any(os.path.exists(os.path.join(item_dir, f)) for f in ("result.json", "facts.json")):
                continue  # e.g. a trashed item folder that only holds an old back
            items.append(_read(item_dir, runs_dir, deleted))
    return items


def summary(items: list[LegacyItem]) -> str:
    todo = [i for i in items if i.skip is None]
    skipped = Counter(i.skip for i in items if i.skip)
    lines = [
        f"{len(todo)} items to migrate ({sum(not i.deleted for i in todo)} in the closet, {sum(i.deleted for i in todo)} removed)",
        f"{sum(i.has_back for i in todo)} with a back, {sum(bool(i.turn_views) for i in todo)} with a 360 view",
        f"{sum(skipped.values())} skipped" + "".join(f"\n  {reason}: {n}" for reason, n in sorted(skipped.items())),
    ]
    return "\n".join(lines)


def apply_migration(store, user_id: str, items: list[LegacyItem]) -> Report:
    report = Report()
    for item in items:
        if item.skip:
            report.skipped += 1
            continue
        if store.find_legacy(user_id, item.legacy_key):
            report.existing += 1
            continue
        item_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"wardrobe:{user_id}:{item.legacy_key}"))
        base = f"{user_id}/items/{item_id}"

        def put(rel: str, name: str) -> str | None:
            local = os.path.join(item.path, rel)
            if not os.path.exists(local):
                return None
            with open(local, "rb") as f:
                store.upload(f"{base}/{name}", f.read(), "image/png")
            return f"{base}/{name}"

        crop = put("crop.png", "crop.png")
        row = {
            "id": item_id, "user_id": user_id, "tier": item.tier, "facts": item.facts, "facts_original": item.facts_original,
            "source_path": crop or put("generated.png", "source.png"), "source_kind": "crop",
            "display_path": put("generated.png", "generated.png"), "crop_path": crop,
            "cutout_path": put("cutout.png", "cutout.png"), "legacy_key": item.legacy_key,
            "created_at": _iso(os.path.join(item.path, "generated.png")),
            "deleted_at": _iso(item.path) if item.deleted else None,
        }
        if item.has_back:
            row["back"] = {"generated_path": put("back/generated.png", "back/legacy/generated.png"),
                           "cutout_path": put("back/cutout.png", "back/legacy/cutout.png"),
                           "crop_path": put("back/crop.png", "back/legacy/crop.png"), "visible_text": item.back_text}
        if item.turn_views:
            row["turn"] = {"state": "done", "views": [
                {"angle": v, "path": put(f"turn/{v}.png", f"turn/legacy/{v}.png"),
                 "cutout_path": put(f"turn/{v}_cutout.png", f"turn/legacy/{v}_cutout.png")} for v in item.turn_views]}
        store.insert_item(row)
        report.created += 1
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--runs", default="runs")
    parser.add_argument("--email", help="the account to migrate into (required with --apply)")
    parser.add_argument("--apply", action="store_true", help="actually upload; without it this is a dry run")
    args = parser.parse_args(argv)

    items = plan_migration(args.runs)
    print(summary(items))
    if not args.apply:
        print("\nDry run: nothing was uploaded. Re-run with --email <account> --apply to migrate.")
        return 0
    if not args.email:
        parser.error("--apply needs --email")

    from api.auth import load_settings
    from api.store import SupabaseStore
    settings = load_settings({**os.environ, "WARDROBE_AUTH": "on"})
    store = SupabaseStore(settings)
    profiles = store._rows("profiles", {"email": f"eq.{args.email.strip().lower()}"})
    if not profiles:
        print(f"No account with the email {args.email}; sign in once in the app first.", file=sys.stderr)
        return 1
    report = apply_migration(store, profiles[0]["id"], items)
    print(f"\nMigrated {report.created} new, {report.existing} already there, {report.skipped} skipped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
