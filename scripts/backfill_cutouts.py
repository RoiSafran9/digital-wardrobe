"""Create transparent cutouts for closet items generated before cutouts existed.

Usage (from the repo root): python -m scripts.backfill_cutouts
"""
import glob
import os
from api.config import runs_dir
from pipeline.stages import cutout


def main() -> None:
    made = skipped = 0
    for generated in sorted(glob.glob(os.path.join(runs_dir(), "*", "*", "item_*", "generated.png"))):
        out = os.path.join(os.path.dirname(generated), "cutout.png")
        if os.path.exists(out):
            continue
        if cutout.run(generated, out):
            made += 1
        else:
            skipped += 1
            print(f"kept white background: {generated}")
    print(f"cutouts created: {made}, kept white background: {skipped}")


if __name__ == "__main__":
    main()
