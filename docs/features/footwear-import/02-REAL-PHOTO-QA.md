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

### 2026-11-03 — AI-made stand-in photos (not real shoes)

**What this is and isn't:** 12 photo-like images made with `gemini-2.5-flash-image` from text descriptions (10 laid out, 2 worn). They test counting, prompt routing and obvious invention. They **cannot** show that a real owned shoe comes out faithfully, so the release gate still needs real photos. Images, scripts and outputs stayed in the session scratchpad, not in Git. Flat photos ran through `cli.py` (detection v5 → `stage4_generate_footwear_v1` / `stage4_generate_v5`); worn photos through `pipeline/outfit.py` (`outfit_detect_v3` → `outfit_generate_footwear_v1`), with only the shoe candidates generated.

| ID | Pieces found | Count in image | Verdict |
|---|---|---|---|
| SH01 pair of white sneakers | 1, `pair (both shoes)` | 2 | **Pass.** Same canvas sneakers, white sole, laces |
| SH02 one navy sneaker (top-down) | 1, `single shoe` | 1 | **Fail (fidelity).** No invented partner, but brand-like crossing **side stripes and a logo were invented** on sides the photo never showed. White-background image small (35% of a tall canvas); the cutout is fine |
| SH03 black ankle boots + tan loafers | 2 pairs (not 4) | 2 + 2 | Count **pass**. Loafers **pass**. Boots **fail (fidelity)**: drawn as Chelsea boots with **elastic side panels** the top-down photo doesn't show |
| SH04 t-shirt + jeans + sneakers | 3 (t-shirt, jeans, sneakers pair) | 2 shoes | **Pass**, red/blue sole stripes kept. Clothes still on the v5 garment prompt |
| SH05 green sneakers "cut by edge" | 1 pair | 2 | **Pass**, but the stand-in didn't actually cut the shoe at the edge, so the edge case is **not tested** |
| SH06 black derby shoes | 1 pair | 2 | **Pass** |
| SH07 work boots, one on its side | 1 pair | 2 | **Pass**: lug sole, laces, creases kept; both drawn standing |
| SH08 strappy sandals | 1 pair | 2 | **Pass**: crossed straps and buckles kept; slightly lighter tan |
| SH09 worn, full length | hoodie, trousers, **shoes** (`both shoes`) | 2 | **Pass**: same white leather sneakers, no feet, socks or trouser hems |
| SH10 worn, shoes cut off (only the top of one shoe shows) | **shoes**, visibility `full`, `both shoes` | 2 | **Fail (honesty).** Detection overclaimed; a whole pair of brown derbies was invented |
| SH11 red high-top + brown loafer | 2 single shoes (not a pair) | 1 + 1 | **Pass**: no partner invented for either |
| SH12 shirt + bag + sunglasses | 1 (shirt) | — | **Pass**: bag and sunglasses excluded |

SH13–SH17 are app and server flows (First 3 Pieces, Closet/Build My Look, two accounts, retries, Back/360). The automated tests on this branch cover them; they still need a quick look on the phone.

**Cost and latency:** 10 detections ($0.013, about 3.4 s each); 12 shoe images ($0.47) and 3 clothes images ($0.12), about 11–12 s each, all passing on the first or second attempt; 2 outfit scans and 2 worn shoe images (about $0.08). Including the stand-ins themselves and SH18, this QA spent about **$1.40**.

**Prompt fix attempted:** two draft prompts, both now in the repo.
- **`stage4_generate_footwear_v2.txt`** picks a high camera angle from above for top-down photos, and keeps unseen sides plain with no stripes, logos or panels.
  - **Inconclusive**, tested on SH01, SH02, SH03 and SH06 only. SH01 came out closer to the photo. SH02 still had invented stripes and a logo. SH03 still had Chelsea panels, plus an invented zip.
  - Prompt wording alone doesn't stop the model drawing sides it never saw. The next thing to try is rendering top-down photos from directly above (no unseen sides), then a check for side marks.
- **`outfit_detect_v4.txt`** asks for honest shoe visibility ("one shoe", `low`, or leave out a sliver), aimed at SH10. **Run after the top-up (SH09, SH10):** SH09 unchanged (`full`, both shoes, clean pair). SH10 is now `partial` with heels and sides listed as hidden, instead of `full`, but it still says "both shoes" from two toe tips at the photo edge, and the generator still draws a complete pair of derbies. Better, not fixed: worn shoes that are only partly in frame need the pick screen to leave them unselected (as it does for `low`), or no candidate at all.
- **`stage4_generate_footwear_v3.txt`** is v2 with the pose rule replaced: keep the photo's camera angle, so a photo from above becomes a catalog shot from directly above and no unseen side is in view; a side or three-quarter photo keeps that angle; never turn the shoes to show a side the photo doesn't. **Not run, and not the direction.** The owner wants shoes at a three-quarter angle from the side, which the spec already sets and the active `stage4_generate_footwear_v1` already does (the top-down result seen on the phone came from `main`, where shoes still go through the garment prompt). Top-down photos remain the fidelity risk (SH02, SH03); the cheaper fix is a capture hint asking for shoes shot from a low side angle, so the three-quarter view is photographed rather than guessed.
- **No draft is active.** The code still uses `stage4_generate_footwear_v1` and `outfit_detect_v3`, which is what this branch's tests and the results above cover.

**API key out of credit:** during the v2 rerun Gemini answered `402 RESOURCE_EXHAUSTED` ("prepayment credits are depleted"). The server reads its key from the same `.env`, so live generation stops until the AI Studio prepayment is topped up.

### Gate status

**Not ready for testers.** Counting (one pair = one item, singles stay single, two pairs, mismatched shoes, mixed photos, accessories) passed on every stand-in. Fidelity failed in 2 of 12 shoe images: invented side branding (SH02) and invented boot construction (SH03). Honesty failed in 1 of 2 worn photos (SH10). Next steps:
1. Top up the Gemini prepayment.
2. Run the next fix: `stage4_generate_footwear_v3` (keep the photo's camera angle) and `outfit_detect_v4` for SH10.
3. Rerun this matrix on the owner's **real** shoe photos.
