import os


def runs_dir() -> str:
    return os.environ.get("WARDROBE_RUNS_DIR", "runs")
