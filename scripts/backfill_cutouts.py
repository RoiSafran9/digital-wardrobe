"""Create transparent cutouts for closet items (fronts and backs).

Usage (from the repo root):
  python -m scripts.backfill_cutouts          # only items without a cutout
  python -m scripts.backfill_cutouts --force  # redo every cutout (after a cutout fix)
"""
import glob
import os
import sys
from api.config import runs_dir
from pipeline.stages import cutout


def main() -> None:
    force = "--force" in sys.argv
    made = skipped = 0
    fronts = glob.glob(os.path.join(runs_dir(), "*", "*", "item_*", "generated.png"))
    backs = glob.glob(os.path.join(runs_dir(), "*", "*", "item_*", "back", "generated.png"))
    for generated in sorted(fronts + backs):
        out = os.path.join(os.path.dirname(generated), "cutout.png")
        if os.path.exists(out) and not force:
            continue
        if cutout.run(generated, out):
            made += 1
        else:
            skipped += 1
            print(f"kept white background: {generated}")
    print(f"cutouts created: {made}, kept white background: {skipped}")


if __name__ == "__main__":
    main()
