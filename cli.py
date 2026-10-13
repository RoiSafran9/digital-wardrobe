import argparse
import asyncio
import os
import time
from pipeline.config import require_env
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.providers.gemini import GeminiProvider


def build_providers(logger: RunLogger) -> Providers:
    require_env("GEMINI_API_KEY")
    gemini = GeminiProvider(logger)
    return Providers(vision=gemini, imagegen=gemini)


def main(photos_dir: str, output_root: str = "runs") -> str:
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run_dir = os.path.join(output_root, run_id)
    os.makedirs(run_dir, exist_ok=True)
    logger = RunLogger(os.path.join(run_dir, "run_log.jsonl"))
    providers = build_providers(logger)

    photos = sorted(
        f for f in os.listdir(photos_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    )

    async def _run_all():
        for photo in photos:
            photo_path = os.path.join(photos_dir, photo)
            photo_name = os.path.splitext(photo)[0]
            output_dir = os.path.join(run_dir, photo_name)
            try:
                await run_photo(photo_path, output_dir, providers, logger)
            except Exception as e:
                logger.log(stage="cli", model="n/a", prompt_version="v1",
                            latency_ms=0.0, status="error", error=f"{photo}: {e}")

    asyncio.run(_run_all())
    return run_id


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["run"])
    parser.add_argument("photos_dir")
    parser.add_argument("--output", default="runs")
    args = parser.parse_args()
    run_id = main(args.photos_dir, args.output)
    print(f"run complete: {args.output}/{run_id}")
