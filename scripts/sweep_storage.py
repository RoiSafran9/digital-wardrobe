"""Remove Storage files nobody can reach any more.

- every file of an account that was deleted (deleting an account removes its rows, not its files);
- job uploads whose job finished or was never recorded, once older than 7 days;
- Outfit Photo scans (the person photo and its preview crops), once older than 24 hours.

Item files are always kept, including those of removed (soft-deleted) items, so removal stays recoverable.
Dry run by default.

Usage (from the repo root, with SUPABASE_URL and SUPABASE_SECRET_KEY set):
  python -m scripts.sweep_storage          # show what would be removed
  python -m scripts.sweep_storage --apply  # remove it
"""
import argparse
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

MAX_UPLOAD_AGE = timedelta(days=7)
# Outfit Photo scans: the person photo and its preview crops go after 24 hours (they may show faces and homes).
MAX_SCAN_AGE = timedelta(hours=24)
FINISHED = {"succeeded", "failed", "canceled", None}  # None: the job row doesn't exist


@dataclass
class Sweep:
    remove: list[str] = field(default_factory=list)
    kept: dict[str, str] = field(default_factory=dict)


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def plan_sweep(store, now: datetime) -> Sweep:
    sweep, users = Sweep(), {}
    for path, modified in sorted(store.list_files("").items()):
        parts = path.split("/")
        owner = parts[0]
        if len(parts) < 2 or not _is_uuid(owner):
            sweep.kept[path] = "not in a user folder"
            continue
        if owner not in users:
            users[owner] = store.user_exists(owner)
        if not users[owner]:
            sweep.remove.append(path)
        elif parts[1] == "scans" and len(parts) >= 3:
            if now - modified < MAX_SCAN_AGE:
                sweep.kept[path] = "scan preview newer than 24 hours"
            else:
                sweep.remove.append(path)
        elif parts[1] == "jobs" and len(parts) >= 3:
            scan = store.job_kind(parts[2]) == "outfit_scan"
            if store.job_status(parts[2]) not in FINISHED:
                sweep.kept[path] = "job still running"
            elif now - modified < (MAX_SCAN_AGE if scan else MAX_UPLOAD_AGE):
                sweep.kept[path] = "scan photo newer than 24 hours" if scan else "newer than 7 days"
            else:
                sweep.remove.append(path)
    return sweep


def apply_sweep(store, sweep: Sweep) -> None:
    for start in range(0, len(sweep.remove), 100):
        store.remove(sweep.remove[start:start + 100])


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="actually remove; without it this is a dry run")
    args = parser.parse_args(argv)
    from api.auth import load_settings
    from api.store import SupabaseStore
    store = SupabaseStore(load_settings({**os.environ, "WARDROBE_AUTH": "on"}))
    sweep = plan_sweep(store, datetime.now(timezone.utc))
    for path in sweep.remove:
        print(f"remove  {path}")
    print(f"\n{len(sweep.remove)} files to remove, {len(sweep.kept)} kept for a reason.")
    if not args.apply:
        print("Dry run: nothing was removed. Re-run with --apply to remove them.")
        return 0
    apply_sweep(store, sweep)
    print(f"Removed {len(sweep.remove)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
