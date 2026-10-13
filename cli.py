import argparse
import asyncio
import os
import time
from pipeline.config import require_env
from pipeline.orchestrator import run_photo, Providers
from pipeline.run_log import RunLogger
from pipeline.providers.gemini import GeminiProvider
from pipeline.providers.replicate_sam import ReplicateSamProvider
from pipeline.providers.claude import ClaudeProvider


def build_providers(logger: RunLogger) -> Providers:
    require_env("GEMINI_API_KEY")
    require_env("ANTHROPIC_API_KEY")
    require_env("REPLICATE_API_TOKEN")
    gemini = GeminiProvider(logger)
    claude = ClaudeProvider(logger)
    segment = ReplicateSamProvider(logger)
    return Providers(vision=gemini, segment=segment, imagegen=gemini, judge=claude)


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
            await run_photo(photo_path, output_dir, providers, logger)

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
