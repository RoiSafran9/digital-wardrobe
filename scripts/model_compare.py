"""Compare Gemini image models on the EXISTING garment flow (front, prompt stage4_generate_v5), offline.

Why: gemini-2.5-flash-image is marked deprecated on Google's pricing page. This reruns the
unchanged front generation on real crops from runs/ with other models, so a migration can be
judged on fidelity first. Output (gitignored): runs/model_compare/<run>/<item>/<model>.png + grid.jpg

    python -m scripts.model_compare --runs /path/to/runs --items 20261016-150035-756 ... --max-usd 0.50
"""
import argparse
import asyncio
import glob
import json
import os
import shutil
import sys
import time
from pipeline import outfit
from pipeline.providers import gemini
from pipeline.types import ItemFacts

MODELS = ["gemini-3.1-flash-image", "gemini-nano-banana-2.1"]
OUT = "runs/model_compare"


def _item_dir(runs: str, ref: str) -> str:
    run, _, item = ref.partition("/")
    found = glob.glob(os.path.join(runs, run, "*", item or "item_0"))
    if not found:
        sys.exit(f"{ref} not found")
    return found[0]


async def main(args):
    from dotenv import load_dotenv
    load_dotenv(os.environ.get("DOTENV", ".env"))
    provider = gemini.GeminiProvider()
    spent, log = 0.0, []
    for ref in args.items:
        src = _item_dir(args.runs, ref)
        facts = ItemFacts.model_validate_json(open(os.path.join(src, "facts.json")).read())
        dest = os.path.join(OUT, ref.replace("/", "_"))
        os.makedirs(dest, exist_ok=True)
        shutil.copy(os.path.join(src, "crop.png"), os.path.join(dest, "crop.png"))
        shutil.copy(os.path.join(src, "generated.png"), os.path.join(dest, "gemini-2.5-flash-image.png"))
        for model in args.models:
            out = os.path.join(dest, f"{model}.png")
            if os.path.exists(out):
                continue
            price = outfit.IMAGE_PRICES[model][0] + 0.003
            if spent + price > args.max_usd:
                sys.exit(f"budget stop at ${spent:.3f}")
            gemini.MODEL_IMAGE = model  # the provider reads the module constant at call time
            work = os.path.join(dest, f"_{model}_crop.png")
            shutil.copy(os.path.join(src, "crop.png"), work)
            start = time.monotonic()
            try:
                generated = await asyncio.wait_for(provider.generate(work, facts, None), 120)
                os.replace(generated, out)
                ok = True
            except Exception as e:
                print(f"{ref} {model}: failed {str(e)[:120]}")
                ok = False
            os.remove(work)
            spent += price if ok else 0
            log.append({"item": ref, "model": model, "ok": ok, "latency_s": round(time.monotonic() - start, 1)})
            print(f"{ref} {model}: {'ok' if ok else 'failed'} ({log[-1]['latency_s']} s)")
    with open(os.path.join(OUT, "log.json"), "a") as f:
        f.write(json.dumps(log) + "\n")
    print(f"spent ~${spent:.3f}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--runs", default="runs")
    p.add_argument("--items", nargs="+", required=True)
    p.add_argument("--models", nargs="+", default=MODELS, choices=MODELS)
    p.add_argument("--max-usd", type=float, required=True)
    asyncio.run(main(p.parse_args()))
