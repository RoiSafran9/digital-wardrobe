"""Outfit Photo PoC harness (M0). Offline, local, never part of the app.

Everything it reads and writes lives under runs/outfit_poc/ (gitignored): person photos and
generated images must never go to git. Paid Gemini calls stop at --max-usd.

    # 0. (optional) synthetic worn photos from your own real garment photos, for a closed-loop test
    python -m scripts.outfit_poc synth --max-usd 0.30
    # 1. Stage 1: candidates + preview crops (cheap vision call per photo)
    python -m scripts.outfit_poc detect --max-usd 0.05
    # 2. Stage 2: generate only the chosen candidates (photo:c1,c2 or "all")
    python -m scripts.outfit_poc generate --select all --max-usd 0.80
    # 3. Side-by-side HTML report
    python -m scripts.outfit_poc report

Layout: runs/outfit_poc/photos/<name>.jpg  (your consented photos, or synth output)
        runs/outfit_poc/manifest.json      {"<name>": {"references": [{"category", "photo", "catalog"}]}}
        runs/outfit_poc/out/<name>/...     scan.json, previews, generated images, usage
"""
import argparse
import asyncio
import glob
import html
import json
import os
import sys
import time
from pipeline import outfit
from pipeline.providers.gemini import MODEL_IMAGE

ROOT = os.environ.get("OUTFIT_POC_DIR", "runs/outfit_poc")
PHOTOS, OUT = os.path.join(ROOT, "photos"), os.path.join(ROOT, "out")
MANIFEST = os.path.join(ROOT, "manifest.json")

SYNTH_PROMPT = """The images above are photos of real garments owned by one person ({labels}).
Create a realistic smartphone photo of an adult WEARING exactly these garments together, {styling}.
Frame the photo from the shoulders down to the feet: the face must NOT be visible. Ordinary room,
natural window light, slight phone-camera noise, relaxed standing pose.
The garments must stay exactly as in the photos: same colors, shade, fabric, fit, prints, text
(letter for letter) and details. Do not add logos, text or accessories."""

# Owner's own garments from runs/ (real photos), combined into test outfits. Edit to taste.
DEFAULT_SYNTH = [
    {"name": "s1_graphic_tee_jeans", "styling": "t-shirt untucked over the jeans",
     "garments": ["t-shirt:20261016-150035-756", "jeans:20261017-181248-252"]},
    {"name": "s2_open_jacket_layered", "styling": "the jacket worn OPEN over the t-shirt, trousers below",
     "garments": ["jacket:20261016-230116-995", "t-shirt:20261016-150202-766", "pants:20261016-230605-99"]},
    {"name": "s3_tucked_striped_tee", "styling": "the t-shirt tucked into the shorts",
     "garments": ["t-shirt:20261016-011230-988", "shorts:20261016-100535-450"]},
    {"name": "s4_arms_crossed", "styling": "arms crossed over the chest, partly covering the t-shirt print",
     "garments": ["t-shirt:20261016-104507-433/item_2", "shorts:20261016-104507-433/item_1"]},
]


class Budget:
    def __init__(self, max_usd: float, usage: outfit.Usage):
        self.max_usd, self.usage = max_usd, usage

    def check(self, next_usd: float):
        if self.usage.usd + next_usd > self.max_usd + 1e-9:
            sys.exit(f"budget stop: spent ${self.usage.usd:.3f}, next call ~${next_usd:.3f}, cap ${self.max_usd:.2f}")


def _client():
    from dotenv import load_dotenv
    from google import genai
    load_dotenv(os.environ.get("DOTENV", ".env"))
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def _load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def _save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _append_usage(name: str, usage: outfit.Usage, stage: str):
    path = os.path.join(OUT, name, "usage.json")
    calls = _load(path, [])
    calls += [{**c, "stage": stage} for c in usage.calls]
    _save(path, calls)


def _item_dir(runs: str, ref: str) -> str:
    run, _, item = ref.partition("/")
    matches = glob.glob(os.path.join(runs, run, "*", item or "item_0"))
    if not matches:
        sys.exit(f"garment {ref} not found under {runs}")
    return matches[0]


async def cmd_synth(args):
    client, usage = _client(), outfit.Usage()
    budget = Budget(args.max_usd, usage)
    manifest = _load(MANIFEST, {})
    os.makedirs(PHOTOS, exist_ok=True)
    for spec in DEFAULT_SYNTH:
        dest = os.path.join(PHOTOS, spec["name"] + ".jpg")
        if os.path.exists(dest):
            continue
        budget.check(outfit.IMAGE_USD_PER_IMAGE + 0.001)
        refs, contents = [], []
        for g in spec["garments"]:
            category, _, ref = g.partition(":")
            item = _item_dir(args.runs, ref)
            refs.append({"category": category, "photo": os.path.join(item, "crop.png"),
                         "catalog": os.path.join(item, "generated.png")})
            contents += [f"Garment photo ({category}):", outfit._image_part(refs[-1]["photo"])]
        prompt = SYNTH_PROMPT.format(labels=", ".join(r["category"] for r in refs), styling=spec["styling"])
        start = time.monotonic()
        try:
            response = await client.aio.models.generate_content(model=MODEL_IMAGE, contents=contents + [prompt])
            data = outfit._first_image(response)
            ok = True
        except Exception as e:
            print(f"{spec['name']}: synth failed: {str(e)[:120]}")
            data, ok = None, False
        tin, _ = outfit._tokens(response) if ok else (0, 0)
        usage.add("synth", MODEL_IMAGE, time.monotonic() - start,
                  (outfit.IMAGE_USD_PER_IMAGE + tin / 1e6 * outfit.IMAGE_USD_PER_M_IN) if ok else 0.0, ok)
        if data:
            import cv2
            import numpy as np
            image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
            cv2.imwrite(dest, image, [cv2.IMWRITE_JPEG_QUALITY, 92])
            manifest[spec["name"]] = {"synthetic": True, "references": refs}
            _save(MANIFEST, manifest)
            print(f"{spec['name']}: ok")
        _save(os.path.join(OUT, spec["name"], "usage.json"), [{**c, "stage": "synth"} for c in usage.calls[-1:]])
    print(f"synth spent ~${usage.usd:.3f}")


def _photos(only: list[str] | None):
    paths = sorted(p for p in glob.glob(os.path.join(PHOTOS, "*")) if p.lower().endswith((".jpg", ".jpeg", ".png")))
    names = [(os.path.splitext(os.path.basename(p))[0], p) for p in paths]
    return [(n, p) for n, p in names if not only or n in only]


async def cmd_detect(args):
    client = _client()
    total = outfit.Usage()
    budget = Budget(args.max_usd, total)
    for name, photo in _photos(args.only):
        out = os.path.join(OUT, name)
        if os.path.exists(os.path.join(out, "scan.json")) and not args.force:
            continue
        budget.check(0.002)
        usage = outfit.Usage()
        try:
            scan = await outfit.detect_candidates(client, photo, usage)
        except Exception as e:
            print(f"{name}: detect failed: {str(e)[:160]}")
            total.calls += usage.calls
            _append_usage(name, usage, "detect")
            continue
        total.calls += usage.calls
        os.makedirs(os.path.join(out, "previews"), exist_ok=True)
        for c in scan.candidates:
            outfit.preview_crop(photo, c, os.path.join(out, "previews", f"{c.id}.jpg"))
        outfit.outlined(photo, scan.candidates, os.path.join(out, "overlay.jpg"))
        _save(os.path.join(out, "scan.json"), scan.model_dump())
        _append_usage(name, usage, "detect")
        print(f"{name}: {scan.scene_kind}, {len(scan.candidates)} candidates: "
              + ", ".join(f"{c.id}={c.category}/{c.layer}/{c.visibility}" for c in scan.candidates)
              + f" ({usage.calls[0]['latency_s']}s)")
    print(f"detect spent ~${total.usd:.4f}")


def _selection(spec: str, name: str, scan: outfit.OutfitScan) -> list[str]:
    if spec == "all":
        return [c.id for c in scan.candidates]
    for part in spec.split(";"):
        photo, _, ids = part.partition(":")
        if photo == name:
            return [i for i in ids.split(",") if i]
    return []


async def cmd_generate(args):
    client = _client()
    total = outfit.Usage()
    budget = Budget(args.max_usd, total)
    variant = args.variant or ("crop_only" if args.crop_only else "with_context")
    for name, photo in _photos(args.only):
        scan_path = os.path.join(OUT, name, args.scan_dir or "", "scan.json")
        if not os.path.exists(scan_path):
            continue
        scan = outfit.OutfitScan.model_validate(_load(scan_path, {}))
        selected = _selection(args.select, name, scan)
        if not selected:
            continue
        out_dir = os.path.join(OUT, name, variant)
        done = _load(os.path.join(out_dir, "results.json"), {})
        todo = [cid for cid in selected if cid not in done or args.force]
        for cid in todo:
            budget.check((outfit.IMAGE_USD_PER_IMAGE + 0.001) * args.max_attempts)
            usage = outfit.Usage()
            done.update(await outfit.generate_selected(client, photo, scan, [cid], out_dir, usage,
                                                       with_context=not args.crop_only, max_attempts=args.max_attempts,
                                                       prompt_name=args.prompt))
            total.calls += usage.calls
            _append_usage(name, usage, f"generate:{variant}")
            _save(os.path.join(out_dir, "results.json"), done)
            print(f"{name} {cid} [{variant}]: {done[cid]['status']} ({len(usage.calls)} call(s), ~${usage.usd:.3f})")
    print(f"generate spent ~${total.usd:.3f}")


def _img(path: str | None, caption: str) -> str:
    if not path or not os.path.exists(path):
        return f'<figure class="missing"><div>—</div><figcaption>{html.escape(caption)}</figcaption></figure>'
    return f'<figure><img src="{_thumb(path)}" loading="lazy"><figcaption>{html.escape(caption)}</figcaption></figure>'


def _thumb(path: str, side: int = 640) -> str:
    """Embedded JPEG thumbnail, so the report is one file that opens anywhere (still private)."""
    import base64
    import cv2
    image = cv2.imread(path)
    if image is None:
        return ""
    scale = side / max(image.shape[:2])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return "data:image/jpeg;base64," + base64.b64encode(data.tobytes()).decode()


def _ref_for(candidate: dict, refs: list[dict]) -> dict | None:
    groups = {"t-shirt": "top", "shirt": "top", "polo": "top", "top": "top", "sweater": "top", "hoodie": "top",
              "sweatshirt": "top", "jacket": "outer", "coat": "outer", "cardigan": "outer", "vest": "outer",
              "jeans": "bottom", "trousers": "bottom", "pants": "bottom", "shorts": "bottom", "skirt": "bottom"}
    want = groups.get(candidate["category"], candidate["category"])
    return next((r for r in refs if groups.get(r["category"], r["category"]) == want), None)


def cmd_report(args):
    manifest = _load(MANIFEST, {})
    rows, totals = [], {"calls": 0, "usd": 0.0}
    for name, photo in _photos(args.only):
        out = os.path.join(OUT, name)
        scan = _load(os.path.join(out, "scan.json"), None)
        usage = _load(os.path.join(out, "usage.json"), [])
        totals["calls"] += len(usage)
        totals["usd"] += sum(c["usd"] for c in usage)
        refs = manifest.get(name, {}).get("references", [])
        head = (f"<h2>{html.escape(name)}{' · synthetic' if manifest.get(name, {}).get('synthetic') else ''}</h2>"
                f"<p class=meta>{'scene: ' + scan['scene_kind'] + ' · ' + str(len(scan['candidates'])) + ' candidates' if scan else 'not scanned'}"
                f" · {len(usage)} paid calls · ~${sum(c['usd'] for c in usage):.3f}"
                f" · detect {next((c['latency_s'] for c in usage if c['stage'] == 'detect'), '—')}s</p>")
        top = '<div class="row">' + _img(photo, "photo") + _img(os.path.join(out, "overlay.jpg"), "Stage 1 overlay") + "</div>"
        cards = []
        for c in (scan or {}).get("candidates", []):
            ref = _ref_for(c, refs)
            figs = [_img(os.path.join(out, "previews", f"{c['id']}.jpg"), f"{c['id']} preview crop")]
            # detect_v2: a re-scan with the v2 detect prompt, then with_context (IDs happened to match v1 here)
            for variant in ("with_context", "crop_only", "detect_v2", "gen_v2"):
                res = _load(os.path.join(out, variant, "results.json"), {}).get(c["id"])
                if res:
                    v = (res.get("verification") or {})
                    note = res["status"] + (f", {res.get('attempts')} attempt(s)" if res.get("attempts") else "")
                    if v.get("violations"):
                        note += " · " + "; ".join(v["violations"])
                    figs.append(_img(os.path.join(out, variant, c["id"], "generated.png"), f"generated ({variant}) — {note}"))
            if ref:
                figs += [_img(ref["photo"], f"reference: real photo ({ref['category']})"),
                         _img(ref["catalog"], "reference: catalog from garment flow")]
            facts = (f"<b>{html.escape(c['id'])} · {html.escape(c['category'])}</b> · {c['layer']} · visibility {c['visibility']}"
                     f"<br>{html.escape(c['description'])}"
                     + (f"<br>text: “{html.escape(c['visible_text'])}”" if c["visible_text"] else "")
                     + (f"<br>hidden: {html.escape(', '.join(c['hidden_parts']))}" if c["hidden_parts"] else "")
                     + (f"<br><i>{html.escape(c['uncertainty'])}</i>" if c["uncertainty"] else ""))
            cards.append(f'<div class="card"><p>{facts}</p><div class="row">{"".join(figs)}</div></div>')
        rows.append(f"<section>{head}{top}{''.join(cards)}</section>")
    page = f"""<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Outfit PoC report</title><style>
:root{{color-scheme:light dark;--bg:#f2f2f7;--card:#fff;--fg:#111;--muted:#666}}
@media (prefers-color-scheme:dark){{:root{{--bg:#000;--card:#1c1c1e;--fg:#eee;--muted:#999}}}}
body{{font:15px -apple-system,system-ui,sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:16px}}
section{{margin-bottom:40px}}.meta{{color:var(--muted)}}.card{{background:var(--card);border-radius:12px;padding:12px;margin:12px 0}}
.row{{display:flex;gap:10px;flex-wrap:wrap}}figure{{margin:0;width:220px}}figure img{{width:220px;height:260px;object-fit:contain;background:#fff;border-radius:8px}}
figcaption{{font-size:12px;color:var(--muted)}}.missing div{{width:220px;height:260px;display:grid;place-items:center;background:var(--bg);border-radius:8px}}
</style><h1>Outfit Photo PoC — side by side</h1>
<p class=meta>Private: contains photos. Total {totals['calls']} paid calls, ~${totals['usd']:.3f} (list-price estimate).</p>
{''.join(rows)}"""
    path = os.path.join(ROOT, "report.html")
    with open(path, "w") as f:
        f.write(page)
    print(path)


def main(argv=None):
    p = argparse.ArgumentParser(prog="outfit_poc")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("synth")
    s.add_argument("--max-usd", type=float, required=True)
    s.add_argument("--runs", default="runs")
    for name in ("detect", "generate"):
        q = sub.add_parser(name)
        q.add_argument("--max-usd", type=float, required=True)
        q.add_argument("--only", nargs="*")
        q.add_argument("--force", action="store_true")
        if name == "generate":
            q.add_argument("--select", required=True, help='"all" or "photo:c1,c2;other:c1"')
            q.add_argument("--crop-only", action="store_true", help="variant without the outlined full photo")
            q.add_argument("--max-attempts", type=int, default=2)
            q.add_argument("--prompt", default=outfit.GENERATE_PROMPT, help="generation prompt file to compare")
            q.add_argument("--variant", help="output folder name for this run (default with_context / crop_only)")
            q.add_argument("--scan-dir", help="read scan.json from this subfolder (e.g. detect_v2)")
    r = sub.add_parser("report")
    r.add_argument("--only", nargs="*")
    args = p.parse_args(argv)
    if args.cmd == "report":
        cmd_report(args)
    else:
        asyncio.run({"synth": cmd_synth, "detect": cmd_detect, "generate": cmd_generate}[args.cmd](args))


if __name__ == "__main__":
    main()
