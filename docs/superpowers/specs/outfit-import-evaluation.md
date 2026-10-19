# Outfit Photo Import — M0 Research, Proof of Concept and Integration Proposal

**Status:** M0 (research + offline PoC) done. **M1 (free scan backend) built behind `WARDROBE_OUTFIT=on`, off by default** (§8). No generation, app or billing changes.
**Spec:** [Two Input Flows — Garment Photo and Worn Outfit Photo](2026-10-19-outfit-photo-two-step-design.md) · **Task:** [execution brief](../../tasks/outfit-photo-two-step-flow.md)
**Date:** 2026-10-19

Legend used throughout: **[measured]** = actually executed in this PoC, numbers from our own runs · **[source]** = from a cited external document · **[assumption]** = expected, not verified · **[needs owner]** = blocked on photos, budget or a decision.

---

## 1. What exists today (verified in code, `origin/main` @ a67a2e2)

| Area | As built | Relevance to Outfit Photo |
|---|---|---|
| `pipeline/orchestrator.run_photo` | quality → one vision call (`stage1_detect_facts_v4`, `gemini-3.1-flash-lite`) → crop → `stage4_generate_v5` (`gemini-2.5-flash-image`) → local color/OCR verify (1 retry) → local rembg cutout | Garment flow stays as is. Crop, verify, cutout and score stages are reusable per candidate. |
| `stage1_detect_facts_v4.txt` | Explicitly **excludes items worn by a person**; returns `included` + `exclusion_reason` | Must stay unchanged. Useful free signal: the prompt asks for an `exclusion_reason` such as "worn on feet", and the worker already turns an all-excluded result into "No garment to add: <reason>" — so the app could offer "Try as Outfit Photo" with **no extra model call** (§5). **[assumption]** that v4 reliably lists worn garments as excluded rather than omitting them; to measure on real worn photos. |
| `generation_jobs` | kinds `garment / back / turn`, `Idempotency-Key` unique per user, lease-based worker, `result jsonb`, `max_items` (fronts approved, billing on only) | A scan and a generate step fit as two new job kinds (§6). |
| `wardrobe_items` | `source_kind in ('original','crop')`, `unique (job_id, piece_index)`, every path under `<user_id>/` | An outfit item can use `source_kind='crop'` (the garment crop, not the person photo) — no constraint change needed for privacy-friendly provenance. |
| AI Credits | Wallet + append-only ledger (`credit_reserve/settle/release/reconcile`), `WalletGate`, per-action prices from env, `WARDROBE_BILLING` **off by default**, `charge_for = price × min(delivered, max_items)` (mirrored by `credit_job_charge`) | Stage 2 can reuse action `garment` (one front image) and the same hold → settle path, with `max_items = len(selected)`. No new wallet, ledger action or price is needed. |
| App | `useCapture` + `FrontsPicker` (guessed count *before* capture), `CreditsProvider`, `/v1/prices` | Outfit flow replaces the guessed count with a **known** selection after detection. |

Docs drift: `AGENTS.md` → "Credits decision" still says only the M5 hooks exist and there is no wallet; the code has the wallet, ledger, billing M2 and the credits UI. Flagged as a follow-up, not changed here.

**Risk found while researching [source]:** Google's pricing page lists `gemini-2.5-flash-image` (the model behind every front, back and 360 image today) as *deprecated, shutdown Oct 2, 2026*. On 2026-10-19 the API's model list still returns it. This affects the existing product, not only this feature → separate follow-up: plan a migration to `gemini-3.1-flash-image` (Nano Banana 2, $0.067/1K image) or `gemini-nano-banana-2.1` ($0.0336/1K image) with a fidelity re-check.

---

## 2. Research brief

### 2.1 Multi-garment detection on people
- Gemini returns per-object boxes as `box_2d = [ymin, xmin, ymax, xmax]` on a 0–1000 scale, prompted with a JSON schema; recent models also return segmentation polygons. Google recommends structured output and minimal thinking for segmentation [source: [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)]. Mask output format has changed between model versions [source: [Simon Willison, 2025](https://simonwillison.net/2025/Apr/18/gemini-image-segmentation/); [Google forum](https://discuss.ai.google.dev/t/image-understanding-and-segmentation-mask-support/146559)] — so v1 uses **boxes only**.
- No published benchmark for Gemini on *instance-level worn garments with layering* was found. The only honest answer is our own measurement (§4) and later the owner's real photos.
- Design choice in `outfit_detect_v1.txt`: one candidate per physical garment ("jacket over shirt = two candidates"), a `layer` field (outer/inner/single), `visibility` (full/partial/low), plain-language `uncertainty`, and `scene_kind` + `person_count` for routing. The prompt forbids describing the person (face, age, gender, ethnicity, body).

### 2.2 Preview crops vs segmentation (human parsing)
- **FASHN Human Parser** [source: [model card](https://huggingface.co/fashn-ai/fashn-human-parser)]: SegFormer-B4, 64M params, 384×576 input, 18 *semantic* classes (`top, dress, skirt, pants, belt, bag, hat, scarf, …, feet`). It has a single `top` class — a jacket and the shirt under it are **the same class**, so it cannot separate the layered case this feature most needs; there is no shoe class (only `feet`). It is class-level, not instance-level.
- **License blocker:** it inherits the NVIDIA SegFormer Source Code License: *"may be used … non-commercially"*, defined as research or evaluation only [source: [NVlabs/SegFormer LICENSE](https://github.com/NVlabs/SegFormer/blob/master/LICENSE)]. Usable for an internal evaluation at most; not shippable in a paid product without a license from NVIDIA.
- Conclusion: **start with Gemini boxes + original-photo crops + an outline overlay** (zero extra cost, already measured below). Revisit masks only if box previews prove ambiguous on real photos — and then prefer Gemini's own polygon output (same vendor, no new privacy review) over a new model.

### 2.3 Worn garment → complete flat-lay (virtual *try-off*)
- **Try-on ≠ try-off.** Try-on dresses a person in a garment (e.g. `fashn-vton-1.5`, irrelevant here). *Virtual try-off* is the inverse: person photo → standardized garment image [source: [TryOffDiff, arXiv 2411.18350](https://arxiv.org/abs/2411.18350)]; extended to upper/lower/dress in one model [source: [MGT, arXiv 2504.13078](https://arxiv.org/html/2504.13078v2)]; also [TryOffAnyone, arXiv 2412.08573](https://arxiv.org/abs/2412.08573) (SD-1.5-inpainting based).
- **Dedicated option assessed: TryOffDiff.** SD-1.4 + SigLIP, trained on VITON-HD / Dress Code (studio e-commerce photos). Code, data and models under **SSPL**, "not available for commercial use unless the full source is open-sourced" [source: [rizavelioglu/tryoffdiff](https://github.com/rizavelioglu/tryoffdiff)]. Needs a GPU host we don't have, and is trained on studio images, not phone snapshots. **Not a candidate for production**; at most a research comparison.
- **Gemini option (chosen for the PoC):** existing image provider + new versioned prompt `outfit_generate_v1.txt` that takes (1) the candidate crop and optionally (2) the full photo with that candidate outlined, and must remove the body, lay the garment flat, complete hidden areas plainly and keep visible prints/text letter for letter. No new vendor, no new privacy review, same per-image price as today.

### 2.4 Fidelity failure modes (what can honestly be inferred)
| Situation | Expected behaviour | How we flag it |
|---|---|---|
| Hem tucked in, back never visible | Plain continuation of visible fabric is acceptable | `hidden_parts` → existing "completed by AI" tier/tip |
| Jacket over shirt | Shirt front mostly hidden → largely guessed | `layer=inner` + `visibility=low` → warn *before* the user pays; consider blocking `low` in v1 |
| Prints/text partly covered (crossed arms) | Must not invent the missing letters | `visible_text` is only what's readable; OCR note is informational (as today) |
| Shade under room light | Model may "clean" color | existing Lab color check vs crop (crop now includes skin/background — measured below) |
| Pose / perspective / folds | Silhouette length guessed | tier "medium" + "photograph it alone" fallback |
| Shoes | Pair, 3D object, not a flat-lay | excluded from v1 recommendation unless results say otherwise |

### 2.5 Routing
| Option | Extra calls on an ordinary garment photo | Latency | Mis-route risk |
|---|---|---|---|
| **A. Explicit mode at Add** ("Garment photo" / "Outfit photo") | 0 | 0 | Only user error; recoverable (below) |
| B. Cheap classifier call first | +1 vision call each photo (~$0.0005) | +2–4 s **[assumption]** | New failure point on the working flow |
| C. Piggyback on existing calls | 0 | 0 | v4 already reports worn items as excluded → app offers "Try as Outfit Photo"; `outfit_detect_v1` returns `scene_kind` → outfit flow offers "This looks like laid-out clothes — use Garment Photo" |

**Recommendation:** A + C. Explicit choice for the first test, with both cross-suggestions costing nothing extra. Revisit automatic routing only with real data.

### 2.6 Two-stage jobs + storage
| | Scan result in `generation_jobs.result` JSONB (recommended for M1) | Dedicated `outfit_scans` + `outfit_scan_candidates` tables |
|---|---|---|
| Schema change | add 2 job kinds, relax 2 checks | 2 tables, RLS, pgTAP for both |
| Candidates | immutable list (≤ 8) written once by the worker | rows, can be edited (corrections) |
| Re-entry after restart | `GET /v1/jobs/{id}` already exists | new endpoints |
| Corrections (re-label, exclude) | client-side only in v1; rescan = new scan job | natural fit |
| When to switch | if manual region selection or server-side corrections are approved | — |

### 2.7 Wallet integration
- Stage 1 (`outfit_scan` job): `cost_credits = null`, **no hold** — free to the user, real provider cost ≈ 0.1¢ (§4).
- Stage 2 (`outfit_generate` job): created only with explicit `candidate_ids` and the price the user saw. Server checks: scan belongs to the caller and succeeded and isn't expired; IDs exist in that scan; count ≤ cap; `expected_unit_price == prices["garment"]` else **409 price changed**. Then the existing `gate.reserve(user, job, "garment", price × n)`; worker settles `price × items delivered` via the unchanged `charge_for` / `credit_job_charge` (with `max_items = n`). Internal retries are inside one job → never charged twice. Same `Idempotency-Key` → same job (no double hold, no double generation).
- Billing off → `prices == {}` → no hold, the UI shows count only.

---

## 3. Proof of concept — what was built

All of it is offline and off by default (no route, job kind, migration, flag or UI):

- `pipeline/prompts/outfit_detect_v1.txt` → `outfit_detect_v2.txt` (current; text-legibility fix from §4.2), `pipeline/prompts/outfit_generate_v1.txt` — new versions; `stage1_detect_facts_v4.txt` and `stage4_generate_v5.txt` untouched.
- `pipeline/outfit.py` — Stage 1 `detect_candidates` (stable IDs c1…cN top-to-bottom, box parsing, `scene_kind`), `preview_crop` + `outlined` (original-photo previews, no generation), Stage 2 `generate_selected` (only selected IDs; unknown IDs refused before any paid call; per-candidate failure isolation; reuses `stage5_verify` and `cutout`), `facts_for` (maps to the existing `ItemFacts`), cost/latency accounting.
- `scripts/outfit_poc.py` — `synth` / `detect` / `generate` / `report`, everything under gitignored `runs/outfit_poc/`, hard `--max-usd` cap per command.
- `tests/test_outfit.py` — 12 offline tests (fakes, no network).

### Why a synthetic closed loop
No consented photos of people wearing the owner's clothes exist in the repo or `runs/` **[needs owner]**. To still measure *reconstruction fidelity against ground truth* without photos of real people, the PoC builds a closed loop from the owner's **real garment photos** in `runs/`:

1. `synth`: Gemini renders a person wearing 2–3 of those real garments, framed shoulders-down (no face).
2. `detect` on that image → candidates and preview crops.
3. `generate` the selected candidates.
4. Compare with the **real photo crop** of the same garment (ground truth) and with the catalog image the garment flow made from it.

Limits, stated up front: a synthetic photo is cleaner than a phone snapshot, and the synth step itself may already alter the garment — so a failure can come from either step (the report shows the synthetic photo so this is visible). This loop is evidence for "can the prompt and pipeline work", **not** a substitute for the 30–50 real photos in the evaluation plan.

---

## 4. Measurements

Run on 2026-10-19 with the owner's approval (cap US$1.50). **Tiny, synthetic sample: 4 photos, 11 candidates, 9 generated garments.** Ratings below are my (Claude's) visual comparison against the owner's real garment photos, not owner labels — the owner should re-judge in the report. Nothing here is a success rate.

### 4.1 Cost and latency [measured]
| Step | Calls | Model | Latency (each) | Cost (list-price estimate from returned tokens) |
|---|---|---|---|---|
| Synthetic worn photos (eval only, not product) | 4 | gemini-2.5-flash-image | 10.0–15.8 s | $0.157 |
| **Stage 1 detect** (v1) | 4 | gemini-3.1-flash-lite | **2.35–2.70 s** | **$0.0047 total ≈ $0.0012 per photo** |
| **Stage 2 generate** (with context) | 9 | gemini-2.5-flash-image | **8.2–10.4 s** | $0.354 ≈ **$0.039 per garment** |
| Stage 2 generate (crop only, comparison) | 4 (+1 hung) | gemini-2.5-flash-image | 9.0–9.7 s | $0.157 |
| Detect v2 + 1 generate (fix check) | 2 | both | — | $0.041 |
| Generate prompt v2 check (§4.5) | 6 | gemini-2.5-flash-image | — | $0.236 |
| **Total** | 29 (+1 hung) | | | **$0.950** (≤ $0.989 if the hung call was billed), cap $1.50 |

- Every generation passed the existing Lab color check on the first attempt → **cost per accepted front = one image call ($0.039)** in this sample; no automatic retries were triggered. The color check cannot catch invented details (below).
- One crop-only generation request **never returned** (killed after ~15 min). The harness now has a 120 s timeout. The production `GeminiProvider` has **no request timeout** either; the job lease (600 s) eventually recycles the job — worth a follow-up.

### 4.2 Stage 1 — detection and previews [measured, n = 4]
| Photo | scene_kind | Candidates (category / layer / visibility) | Correct? |
|---|---|---|---|
| s1 tee + jeans | worn ✓ | t-shirt / single / partial · jeans / single / partial | ✓ both; claims "hem tucked into trousers" (it is half-tucked) |
| s2 quarter-zip fleece over navy tee + trousers | worn ✓ | sweatshirt / outer / full · t-shirt / inner / partial · trousers · shoes | ✓ **layered tee found as its own candidate** from a hem strip; visibility under-reported (should be low) |
| s3 striped tee + shorts | worn ✓ | t-shirt · shorts · shoes | ✓ |
| s4 crossed arms, tee + shorts | worn ✓ | t-shirt / full · shorts | ✓ (arms occlude the print; still "full") |

- 11/11 candidates are real separate garments; **0 merges, 0 splits, 0 misses** of the target garments; shoes were returned twice although not requested in v1 scope (they were simply not selected).
- Box previews (crop of the real photo + labelled outline) made every target garment unambiguous in this sample — no need for segmentation masks yet.
- **Hallucinated text (important):** for the fleece, v1 returned `visible_text: "supreme"` for a small unreadable chest print. Because facts are binding in the generate prompt, this led the generator to **invent a red "Supreme"-style collar tab** (both variants) and, in the crop-only variant, a legible "Supreme" wordmark. That is exactly the "don't invent logos" failure the product forbids.
- **Fix tried [measured, n = 1]:** `outfit_detect_v2.txt` — only text read with certainty, never guess a brand, describe unreadable prints instead; inner garments showing only a strip are `low`. Re-scan of s2: `visible_text ""` for every candidate, inner tee → `low` ✓; regenerated fleece: **no invented tab, and the white raglan piping of the real garment now appears** — but the unreadable chest print was rendered as made-up letters ("OYTO FRONT"). v2 is now the PoC default; unreadable small prints remain an open failure mode.

### 4.3 Stage 2 — reconstruction vs the real garment [measured, visual, n = 9]
| Garment | Result (with context) | vs real photo |
|---|---|---|
| s1 white graphic tee | clean tee, chest graphic placed/coloured right, characters approximate | recognisable; text not letter-exact (OCR note only, as in the garment flow) |
| s1 light-wash jeans | correct wash, fades, 5-pocket | recognisable ✓ |
| s2 fleece (v1) | colour blocking ✓, **invented red collar tab** | ✗ invented detail (fixed by v2, see above) |
| s2 navy tee (only hem visible) | full plain navy tee | colour and type right; **everything above the hem is guessed** — plausible, unverifiable |
| s2 brown trousers | drawstring, colour ✓ | recognisable; leg shape straighter than the real balloon fit |
| s3 striped tee | stripes, ringer collar, chest print position ✓ | recognisable; print approximate |
| s3 gray shorts | **white rope drawstring added** | ✗ invented detail (the source showed a thin gray cord) |
| s4 pink tee, arms crossed | full tee, mint collar, small chest print ✓ — occlusion by arms handled | recognisable ✓ |
| s4 navy shorts | **white drawstring added** | ✗ invented detail (source: dark cord) |

- **Recognisable as the same piece: 9/9. Free of invented details: 6/9 with v1 prompts** (Supreme tab, 2 × white drawstrings). Both are synthetic-loop results; on real phone photos expect worse.
- Synthetic step losses (visible in the report, not counted against try-off): the open jacket was rendered closed, the requested tuck-in didn't happen, the striped tee's "MANTRA" print and the fleece's "IETS FRANS" text changed, navy sleeves came out near-black. So these photos are easier and less faithful than real ones.

### 4.4 Context vs crop-only [measured, n = 4]
- Same quality for fully visible tops (s1, s4).
- **Inner layer (s2 tee): crop-only produced only the visible strip** (a cut-off half-tee); with the outlined full photo it produced a complete tee. → keep the context image (no extra cost: same single call, one more input image ≈ 260 input tokens).
- Fleece: crop-only produced a *more* legible fake "Supreme" wordmark — context does not cure the text hallucination; the detect fix does more.

### 4.5 Generation prompt v2 (D10) [measured, n = 6]
`outfit_generate_v2.txt` adds: draw cords, tabs, labels or patches only if visible, in the exact color and place; never write letters that can't be read (unreadable print → indistinct mark). Re-run on the 3 failures plus 3 clean controls, same scans (fleece with the v2 scan):

| Garment | v1 | v2 |
|---|---|---|
| s3 gray shorts | white rope drawstring (invented) | thin gray cord as in the photo ✓ |
| s4 navy shorts | white drawstring (invented) | thin dark cord as in the photo ✓ |
| s2 fleece (detect v2) | unreadable print → fake letters "OYTO FRONT" | small indistinct mark ✓; **but body rendered shorter and boxier** than the source |
| s1 white tee (control) | ok | same ✓ |
| s3 striped tee (control) | ok | same, but **a small neck label appeared** that the photo doesn't show |
| s4 pink tee (control) | ok | same, pink slightly more saturated (passed the color check) |

→ v2 fixes the three failures it targeted and introduced one smaller new invention (a neck label) and one proportion change. v2 is now the PoC default. Remaining work is prompt iteration on real photos, not a blocker for the M1 scan API. "Invented detail" needs to be a labelled metric in the real eval (§6), because the color/OCR checks never catch it.

### 4.6 What did not run
- No real person photos, no same-garment pairs photographed by the owner on a body → the core fidelity question on **real phone photos is still open** [needs owner, D7].
- No FASHN parser / TryOffDiff comparison (licenses rule them out for the product; GPU needed).
- No routing measurement on ordinary garment photos (v4 behaviour on worn photos is an assumption).
- **Real web photos (attempted 2026-10-19):** the owner allowed public photos of people. I chose Creative Commons street-style photos via Openverse instead of paparazzi shots (copyright). The search worked (198 candidates), but the session's permission policy blocked bulk-downloading photos of people, so none were evaluated. To unblock: the owner downloads or approves a set, or puts 30–50 photos in `runs/outfit_poc/photos/`, and the harness runs as is.
- **Newer image models (attempted 2026-10-19):** a try-off comparison of `gemini-3.1-flash-image` and `gemini-nano-banana-2.1` on the 4 hardest pieces was refused by the API: `402 RESOURCE_EXHAUSTED — prepayment credits are depleted` ($0 spent). That also stops every image call the live app makes until the AI Studio balance is topped up. The harness takes `--model` and is ready to rerun.
- No app, API, DB, billing or pgTAP changes; Jest/tsc/pgTAP not needed.

---

## 5. Proposed architecture (for approval — not built)

```text
Add tab ── [Garment photo] ──► existing POST /v1/jobs (garment)  ── unchanged
        │                          └─ worker: all detections excluded as "worn"
        │                               → job fails with that reason → app offers "Try as Outfit Photo" (no extra call)
        └─ [Outfit photo] ──► POST /v1/outfit-scans  (Idempotency-Key, photo)          FREE, no hold
                                 job kind outfit_scan: queued → running → succeeded | failed
                                 result = {scene_kind, person_count, candidates[], expires_at}
                              GET /v1/outfit-scans/{id}  → candidates + short-lived signed preview URLs
                                 scene_kind=flat → app suggests Garment photo; 0 candidates → "None found"
                              user selects c1,c3 · sees "2 selected · 2 × <front price>" from GET /v1/prices
                              POST /v1/outfit-scans/{id}/generate  (Idempotency-Key, candidate_ids, expected_unit_price)
                                 → job kind outfit_generate, hold price × n (billing on only)
                                 → worker: generate_selected → items (review state) → settle price × delivered
                              GET /v1/jobs/{id} → per-candidate status; app shows review → Keep / Discard
```

**Scan state** (derived from the job + expiry): `queued → detecting → awaiting_selection → generating → completed | failed | expired`.

**Typed records (proposal)**
```ts
type OutfitCandidate = {
  id: string;                 // "c1"… unique within the scan
  category: string;           // closed vocabulary from outfit_detect_v1
  layer: "outer" | "inner" | "single";
  visibility: "full" | "partial" | "low";
  colors: string[]; pattern: string; visible_text: string; description: string;
  hidden_parts: string[]; uncertainty: string;   // plain language, no % confidence
  box: { x: number; y: number; width: number; height: number };  // px on the uploaded photo
  preview_url: string;        // signed, short-lived, crop of the real photo
};
type OutfitScanOut = { id: string; status: "queued"|"running"|"succeeded"|"failed"; scene_kind: "worn"|"flat"|"mixed"|"none";
                       candidates: OutfitCandidate[]; expires_at: string; error?: string };
type OutfitGenerateIn = { candidate_ids: string[]; expected_unit_price: number | null };  // null while billing is off
```

**Database (one migration, with pgTAP two-account tests)**
- `generation_jobs.kind` += `outfit_scan`, `outfit_generate`; the `item_id is null` check and the `max_items` check extended to them; `outfit_generate` gets `scan_job_id uuid` (same-owner FK to `generation_jobs (id, user_id)`) and `candidate_ids text[]`.
- `wardrobe_items`: `origin text not null default 'garment_photo' check (origin in ('garment_photo','outfit_photo'))`; outfit items store the **garment crop** as `source_path` with `source_kind='crop'` — the full person photo is never an item file. Optional `review_state` (`pending`/`kept`) if review-before-save is approved; pending items hidden from the closet.
- Double-generation guard: partial unique index on `(scan_job_id, candidate_id)` for kept items, or simply allow regeneration as a new paid action (owner decision D4).

**Storage & privacy**
- `<uid>/scans/<scan_id>/upload.<ext>` and `<uid>/scans/<scan_id>/previews/cN.jpg`; signed URLs (existing short TTL); nothing public.
- Person photo + previews deleted when the generate job finishes, and at the latest at `expires_at` (proposal: 24 h) by the existing `scripts/sweep_storage.py` (extend its rules) or the worker's reconcile tick.
- Logs never contain image bytes or model descriptions of the person; the detect prompt doesn't produce any.
- Account switch / sign-out: the app drops in-memory scan state; the server scopes every lookup by token user → someone else's scan answers 404.

**Edge cases:** no candidates → "None found" + retake tip; `person_count > 1` → v1 uses the main person and says so; mixed → offer both flows; stale scan (expired) → 410 and "scan again"; app killed → scan/generate jobs re-found by ID (store last scan ID locally); duplicate taps → same Idempotency-Key; price changed between quote and confirm → 409, re-quote; one candidate fails → others still saved, failed one not charged.

**Build now vs defer**
- M1 (after this review): scan job + endpoints + migration + privacy expiry + tests. No generation.
- M2: generate job, prompt v1 (or v2 after real photos), review state, wallet hold/settle, partial-success tests.
- M3: app — mode choice, candidate picker (crop + outline), price confirm, progress, review.
- Defer: automatic routing, masks/segmentation, manual region selection, server-side candidate corrections, shoes, multi-person.

---

## 6. Evaluation plan (for the real-photo phase, M4 and before M2 ships)

Dataset **[needs owner]**: 30–50 consented photos of the owner/F&F wearing their own clothes, plus a laid-flat photo of the *same* garments (the existing garment flow produces exactly this reference). Mix: simple outfits, open jacket over shirt, tuck-ins, crossed arms, dresses/skirts, prints and text, indoor/outdoor light, mirror selfies. Stored only under `runs/outfit_poc/photos/` (gitignored).

Per candidate, the owner (or a helper) labels in the HTML report:
| Metric | How |
|---|---|
| Detection recall / precision per class | intended garments found / candidates that are real separate garments |
| Merges / splits | jacket+shirt as one candidate; one garment as two |
| Preview clarity | "Could you tell which garment this is from the crop alone?" yes/no |
| Recognizable fidelity (1–5) | color, pattern/text, silhouette, material vs the reference flat-lay |
| Invented details | any logo/text/pocket not on the real piece (yes/no — any yes is a fail) |
| Accepted | "Would you keep this in your closet?" |
| Cost / latency | from `usage.json`: calls, $ per accepted front incl. discarded attempts, p50/p90 |

Thresholds are set **with the owner after the baseline**, not invented here. Suggested shape: accept rate per (category × visibility) bucket; buckets that fail become "photograph it alone" instead of a paid generation.

---

## 7. Open owner decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | Explicit mode choice at Add for v1 (vs auto-routing) | Explicit + free cross-suggestions |
| D2 | v1 garment classes: tops, outerwear, bottoms, dresses/skirts; shoes? | Exclude shoes in v1 |
| D3 | Allow paid generation for `visibility = low` candidates (e.g. shirt under a closed jacket)? | Warn and default-unselected; or block |
| D4 | Charge when the user discards a successful result ("doesn't look like mine")? Manual regenerate = new paid action? | Charge on success (as today), regenerate = new action; revisit after beta data |
| D5 | Review-before-save state for outfit items (spec says yes) | Yes: `review_state` pending → kept |
| D6 | Person-photo retention | Delete after generation, max 24 h |
| D7 | Provide 30–50 consented photos + same-garment flat-lays, and a paid-call budget for the real eval | Measured unit costs: ~$0.0012/detect, ~$0.039/front → 50 photos + ~80 fronts ≈ **$3.20** at list price, plus re-runs |
| D8 | Migrate off `gemini-2.5-flash-image` (deprecated) — whole product | Separate task, before M2 |
| D10 | Adopt generation prompt v2 (§4.5: fixed drawstrings and fake letters, one new neck label) as the M2 baseline, then iterate on real photos | Yes |
| D9 | JSONB scan result (M1) vs dedicated tables | JSONB now; tables when corrections/manual selection land |

---

## 8. M1 as built (2026-10-19)

The owner said to continue with everything, so M1 uses the recommended defaults: D1 explicit mode, D6 24 h retention, D9 JSONB result. Changing any of them later is cheap.

- **Migration** `20261019120000_outfit_scan_jobs.sql`: job kind `outfit_scan`; the item rule is now "only back/360 have an item"; a scan can never carry `cost_credits` or `max_items`. pgTAP `09_outfit_scan.test.sql` checks a free scan with no item, refused prices and fronts, refused cross-user upload paths, a 360 that still needs its item, and two-account isolation. It was run together with the existing 03/05/06/08 tests in a rolled-back transaction on the local stack (58 assertions, all pass). The local database was left unmigrated.
- **API** (`api/routes/v1.py`): `POST /v1/outfit-scans` (photo + `Idempotency-Key`; a key already used for another kind → 409) and `GET /v1/outfit-scans/{id}` (owner only, else 404; expired → 410). Both answer 404 unless `WARDROBE_OUTFIT=on`.
- **Worker** (`api/worker.py`): the `outfit_scan` handler uses `GeminiProvider.detect_outfit` (prompt `outfit_detect_v2`), uploads up to 8 preview crops, stores the candidates and `expires_at`, and never generates. Free kinds skip settle and refund. Existing jobs behave exactly as before.
- **Credits** (`api/credits.py`): `FREE_KINDS = ("outfit_scan",)` → no price lookup, no hold, even with billing on.
- **Retention** (`scripts/sweep_storage.py`): scan photos and previews go after 24 h; other job uploads keep their 7-day rule.
- **Tests:** `tests/api/test_outfit_scan.py` (10) and a provider test. Full suite 321 passed, 25 skipped.
- **Not built:** M2 (select → quote → generate → review, wallet hold/settle), the M3 app screens, and quality-gate thresholds for person photos (stage0 is not run on scans: its blur and size thresholds were tuned for flat-lays).

---

## 9. סיכום לבעלים (עברית)

**מה נעשה:** מחקר, ארכיטקטורה מוצעת, ו-PoC מקומי בלבד (לא באפליקציה, לא ב-API, לא בחיוב). נבנה מבחן "לולאה סגורה": מתמונות אמיתיות של הבגדים שלך נוצרו 4 תמונות סינתטיות של אדם לובש אותם (בלי פנים), ואז זיהוי → בחירה → יצירת תמונת קטלוג, והשוואה לתמונה האמיתית של אותו בגד.

**מה נמדד:** עלות כוללת ‎$0.95‎ (מתוך תקרה ‎$1.50‎). זיהוי: ~2.5 שניות ו-~0.1 סנט לתמונה; זוהו נכון כל 11 הבגדים, כולל חולצה שמתחת לפליז. יצירה: ~9 שניות ו-~4 סנט לבגד; כל 9 הבגדים מזוהים כאותו פריט, אבל ב-3 מתוך 9 הומצאו פרטים (תווית אדומה בסגנון Supreme, שרוכים לבנים במכנסיים קצרים). תיקון בפרומפט הזיהוי (v2) העלים את התווית. פרומפט יצירה v2 תיקן את השרוכים (עכשיו בצבע ובעובי כמו בתמונה) ואת האותיות המומצאות (סימן לא ברור במקום מילים), אבל הוסיף תווית צוואר קטנה לחולצה אחת וקיצר מעט את הפליז.

**חשוב:** הדגימה קטנה וסינתטית, ולכן זו ראיה לכיוון ולא אחוז הצלחה. השאלה המרכזית, נאמנות בתמונות טלפון אמיתיות, עדיין פתוחה.

**עדכון:** M1 נבנה (סריקה חינמית בצד השרת, כבויה כברירת מחדל, `WARDROBE_OUTFIT=on`). שני דברים חסומים: יתרת ה-Gemini נגמרה (שגיאה 402, שעוצרת גם את יצירת התמונות באפליקציה החיה) — צריך להטעין ב-AI Studio; והורדה מרובה של תמונות אנשים מהאינטרנט נחסמה על ידי מדיניות ההרשאות — צריך לאשר או לשים תמונות בתיקייה.

**החלטות שצריך ממך לפני M2:** D1 בחירת מצב מפורשת במסך ההוספה · D2 בלי נעליים בגרסה הראשונה · D3 מה עושים עם בגד שרובו מוסתר · D4 חיוב כשמשתמש פוסל תוצאה שהצליחה · D5 שלב אישור לפני שמירה · D6 מחיקת תמונת האדם (מוצע: עד 24 שעות) · D7 ‏30–50 תמונות שלך/של חברים עם אישור, ותקציב של ~‎$3–5 · D8 מעבר מ-gemini-2.5-flash-image שהוכרז כ-deprecated · D9 שמירת הסריקה ב-JSONB · D10 לאמץ את פרומפט היצירה v2 כבסיס ל-M2 ולהמשיך לשפר אותו על תמונות אמיתיות.
