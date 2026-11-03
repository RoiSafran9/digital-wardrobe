# KIPS — Footwear real-photo QA

**Status:** To run before footwear reaches the first-five TestFlight group. **No real shoe photo has been run through the new prompts yet**; the automated tests use faked model calls and prove routing, counting, billing and isolation only — not image quality.
**Prepared:** 2026-11-03, with the footwear MVP implementation (spec: [01-FOOTWEAR-SCAN-CATALOG-MVP.md](01-FOOTWEAR-SCAN-CATALOG-MVP.md)).

## What changed that needs eyes on real photos

| Prompt | Used for | New / changed |
|---|---|---|
| `stage1_detect_facts_v5.txt` | Every garment-photo scan (clothes **and** shoes) | Replaces v4. Footwear eligible; a pair is one item; single shoe stays single; visible_parts starts with `pair (both shoes)` / `single shoe` |
| `stage4_generate_footwear_v1.txt` | Garment-photo pieces whose category is footwear | New. Clothes still use `stage4_generate_v5.txt` unchanged |
| `outfit_generate_footwear_v1.txt` | Outfit-photo picks whose category (after any correction) is footwear | New. Worn clothes still use `outfit_generate_v3.txt` |
| `outfit_detect_v3.txt` | Outfit scan | Unchanged (it already lists `shoes` and "a pair is ONE candidate"). Version it only if SH09/SH10 show a need |

`stage1_detect_facts_v5` also runs on **clothes-only** photos, so SH18 is a required regression check, not optional.

## Setup (owner's Mac, nothing live touched)

1. Use consented photos only: your own shoes, or synthetic/stock you may use. **Never commit them** (they go under `runs/`, which is git-ignored).
2. From this branch's worktree, local mode (no account, no credits): `GEMINI_API_KEY` in `.env`, then
   `.venv/bin/python cli.py run <folder of shoe photos> --output runs/footwear-qa`
   This runs scan → generation → cutout for every piece and writes `runs/footwear-qa/<run>/<photo>/item_N/{crop,generated,cutout}.png`, `facts.json`, `result.json` and `run_log.jsonl` (prompt version, latency, tokens, estimated cost per call).
3. For the app flows (pick screens, First 3 Pieces, outfit review), run a **second** server on another port from the worktree against the **local** Supabase stack (README → Accounts). Do not restart or reconfigure the launchd server on port 8000, and do not touch `.env.server`.
4. Outfit cases (SH09, SH10) need `WARDROBE_OUTFIT=on` on that second, local server only.

## Fixture matrix — record one row per photo

For each run record: photo id, scene, **pieces found** (and which), **pair/single label** on the pick screen, prompt versions (from `run_log.jsonl`), **shoe count in the catalog image**, faithful? (color, shape, sole, laces/straps, logos/text, wear), cutout usable?, tier/tip, latency, estimated cost.

| ID | Photo | Pass when |
|---|---|---|
| SH01 | Matching pair of sneakers on the floor | 1 piece labelled "· pair"; 1 image with **both real shoes**; one front charged |
| SH02 | One sneaker alone | 1 piece "· single shoe"; image shows **one** shoe, no invented partner |
| SH03 | Two different pairs, apart | 2 pieces (not 4), 2 images |
| SH04 | Sneakers + shirt + trousers in one flat photo | 3 pieces: 1 pair + 2 garments, right categories; clothes images look as good as before |
| SH05 | Pair partly cut by the photo edge | Medium tier with the shoe tip; no invented details in the completed part |
| SH06 | White sneakers and black shoes (separate photos) | Clean shoe edge on white; cutout or white-background fallback OK |
| SH07 | Black boots, visible textured sole | Shape, shaft height, sole and marks preserved |
| SH08 | Sandals with thin straps | No lost straps in the generated image or the cutout |
| SH09 | Outfit photo, full length, shoes on feet | One "Shoes" candidate; image has no feet/legs/socks; can be kept |
| SH10 | Outfit photo, shoes partly out of frame | Honest visibility note or no candidate; no invented hidden shoe |
| SH11 | Two mismatched shoes together | Not merged into one "pair"; two singles or a clear uncertainty |
| SH12 | Bag + sunglasses + a garment | Bag and sunglasses still excluded |
| SH13 | First 3 Pieces: one pair + two garments | Three picks; the pair counts once toward 5 |
| SH14 | New shoe in Closet / Build My Look | Under **Shoes**; can appear in a look's footwear slot; swap offers other shoes |
| SH15 | Account A shoes, account B signed in | B never sees A's shoes or images (also automated) |
| SH16 | Retry a generate with the same key | No duplicate item, call or charge (also automated) |
| SH17 | Open a shoe in the item sheet | No Add Back / Generate 360; note says they aren't available for shoes; a garment still offers both |
| SH18 | Clothes-only photos you have run before | Same piece count and image quality as with v4 — compare old and new `runs/` side by side |

Also try a few shoe types the predicate covers (loafers, heels/pumps, slippers, mules/slides, clogs) and check the Closet group.

## Release gate (from the spec)

- All automated ownership, pair-count, idempotency and billing tests pass (they do on this branch).
- A human has looked at outputs from several shoe types, light and dark shoes, a single shoe and a worn photo.
- A clear majority of reviewed shoe images are faithful and usable. **No percentage is claimed until that pilot exists.**
- SH18 shows no clothing regression from detection v5. If it does, revert the `DETECT_PROMPT` constant in `pipeline/providers/gemini.py` to v4 (clothes behave exactly as before; shoes stop being eligible) and file the finding.
- If shoe images hallucinate materially, keep footwear off for the beta rather than saving wrong catalog images.

## Known limits to watch

- The local color check (`stage5_verify`) compares color only; passing it is **not** proof the shoes are right (count, silhouette, logos, left/right). Only human review covers that today.
- Pair/single comes from the detection's own `visible_parts` words. If the model omits them the count is "unknown": the prompt then asks for only the shoes visible and the pick screen shows no pair/single label.
- The cutout (`isnet-general-use`) was not tuned for shoes; gaps between a pair, laces and white soles are untested on real photos.
- Back and 360 are refused for shoes (409, before any hold). Shoes saved before this change with a back or 360 keep showing them.

## Results

### 2026-11-03 — SH18 detection regression, v4 vs v5 (clothes only)

- **Input:** the 10 front crops in the owner's local `runs/` (5 t-shirts, 2 shorts, jeans, pants, a jacket; some crops show the edge of a neighbouring piece). Local mode keeps only crops, not the original photos, so these are a stand-in for the original garment photos. There are no shoes in `runs/`.
- **Method:** the same crop through `stage1_detect_facts_v4.txt` and then `v5`, vision calls only (`gemini-3.1-flash-lite`), no image generation. Script and raw output stayed in the session scratchpad, not in Git.
- **Result:** 9/10 crops gave the same included pieces and categories under v4 and v5. The tenth (a shorts crop with a cut-off t-shirt and trousers at its edges) changed between runs **under v4 alone** too: over 4 repeats, v4 gave 1 or 3 pieces and called the trousers "jeans" or "pants", and v5 did the same. That is model variance on edge-cut neighbours, not a v5 change.
- **Cost / latency:** v5 sends about 400 more input tokens per scan (2,033 vs 1,634 on average; about $0.00004 per scan) and took the same time (3.5 s vs 3.9 s on average). 26 calls in total, about $0.037.
- **Not covered:** full multi-piece original photos and generation quality (v5 changes detection only; the clothing image prompt is the same file as before).

### Still open

SH01–SH17 need real shoe photos; none have been run yet.
