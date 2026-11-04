# KIPS — Footwear Scanning & Catalog Generation MVP

**Status:** Implementation-ready feature specification and Claude Code handoff. **Implemented on branch `claude/footwear-scanning-catalog-gen-d2cdcf` (2026-11-03), pending review and the [real-photo QA](02-REAL-PHOTO-QA.md).**  
**Prepared:** 2026-11-02  
**Source inspected:** `RoiSafran9/digital-wardrobe`, `main` as inspected on 2026-11-02  
**Owner's request:** Expand existing garment scanning and catalog-image generation to **shoes/footwear**, including the ways users currently add items.

## 1. Executive conclusion

This is an **extension of the existing pipeline**, not a separate product, new AI provider, or new database model.

KIPS **already recognizes footwear downstream**:
- `mobile/src/categoryGroups.ts` has a `Shoes` group.
- `api/outfit_builder/taxonomy.py` maps sneakers, boots, sandals etc. to the `footwear` slot.
- `pipeline/prompts/outfit_detect_v3.txt` has category `shoes` and states **a pair of shoes is ONE candidate**.

The missing / unreliable portions are **upstream image capture and catalog generation**:
- `pipeline/prompts/stage1_detect_facts_v4.txt` says to include clothing, *not accessories*, despite a `sandal` category example. It does not explicitly permit footwear or require a whole pair to be one detection. The wording can lead the model to exclude shoes as "not clothing", or count two shoes separately. Actual production failure rates have **not** been measured.
- `pipeline/prompts/stage4_generate_v5.txt` instructs the model to unfold, smooth, lay flat, front-up and symmetrize a *garment*. These are wrong directions for three-dimensional footwear.
- `pipeline/prompts/outfit_generate_v3.txt` uses the same garment-specific directions on worn items, even though outfit detection already accepts shoes.
- `pipeline/stages/stage5_verify.py` validates color and notes OCR misses, **but does not verify shoe identity, shoe count, shape or left/right consistency**. A wrong yet similarly colored product could pass.
- `pipeline/stages/cutout.py` is optimized for garment outlines; a shoe pair may reveal gaps, white soles or laces that deserve regression testing.
- `mobile/src/components/ItemSheet.tsx` can expose garment-style Back and AI ghost-mannequin 360 actions; current `pipeline/prompts/stage4_generate_back_v2.txt` and `turn_view_v2.txt` are **not footwear-specific**.

**Recommendation:** make shoe recognition explicit; route selected footwear through **versioned shoe-specific catalog prompts** in the existing image generation flow; keep one logical pair as one catalog item, one generation and one user-visible credit action; preserve existing account isolation and AI cost controls; test real shoe photographs before the TestFlight beta.

## 2. Product rules — footwear MVP

### In scope
1. **Garment Photo flow (laid-out items):** take or choose a photo of shoes on a bed, floor or suitable surface; free scan identifies shoes as eligible items; user can select them; one selected pair produces one catalog entry. A mixed photo of clothes and shoes must work.
2. **First 3 Pieces onboarding:** the same normal scan/generation pipeline may count a pair of shoes as **one** of the first three pieces and **one** of the five available items in a round. No separate shoe-onboarding screen or change to the round cap.
3. **Outfit Photo (worn flow, only when `WARDROBE_OUTFIT=on`):** shoes visible on the principal person's feet remain a possible **single candidate per pair**, can be selected, generated and kept/discarded in the existing review flow.
4. Generated shoes appear under **Shoes** in Home/Closet, have an accurate category/color/name, can be viewed/edited/removed, and are eligible for the already-built `footwear` slot in Build My Look.
5. Existing source photo, owner-scoped storage, generation queue, idempotency, quality tiers, retry ceilings, scan expiration, pricing confirmation and private item URLs are reused unchanged.
6. Basic English capture instructions and error/retake copy updated so people know how to photograph shoes.

### Explicitly out of scope
- A shoe-size database, brands/product matching, shopping links, ecommerce catalogue matching.
- A new "Shoes" top-level tab, a separate generation service, new vector index, training a shoe model, new payments/credit prices.
- New dedicated outsole/back/side galleries, 3D shoe reconstruction, ghost-mannequin shoe 360, automatic shoe try-on.
- Guessing shoes missing from a partly visible photo or reconstructing logos, sole pattern and distinctive material details that are not supported by the reference.
- Sending raw outfit photos or images to an additional third-party monitoring service.

### One pair = one item (critical invariant)
- Two matching shoes photographed together constitute **ONE footwear candidate** with a bounding rectangle that encompasses **both** shoes, **ONE** item in the closet, and **ONE front-image generation action** (and corresponding server-defined credit price if billing is on).
- Two *different* pairs in one photo should be **TWO** selectable candidates, not four shoes.
- Do not count the left and right shoe as separate garment items. The scan confirmation UI must show the pair together so the user can catch incorrect grouping *before spending credits*.
- If a photo clearly shows only **one shoe**, a single-shoe image may be generated and stored as **one footwear item**, but it must display only the evidenced shoe; do not synthesize its unobserved partner. Encourage the user to photograph both shoes together for a pair catalog shot. Never claim "a pair was verified" if only one shoe was seen.
- If two shoes cannot reliably be established as a matching pair, show separate selectable candidates or an uncertainty/retake message rather than confidently grouping mismatched shoes. Never merge different pairs just because both are footwear.

### Image fidelity and composition
- For a visible pair: make a clean commercial **paired-shoes catalog image** on plain white with soft neutral light, showing both real shoes in a natural close side-by-side / modest three-quarter configuration. Preserve actual left/right composition, relative shape, color, textures, laces, soles, wear, marks, visible text and logos exactly to the extent evidenced by the photo.
- For one visible shoe: make a single-shoe packshot. Do not manufacture a matching shoe.
- Do not "improve" worn shoes into brand-new shoes, change their model, add a logo, invent heel/sole construction, put them on a model, or erase visible wear.
- Shoes are three-dimensional. Do **not** flatten, unfold, mirror one shoe to create another, make them symmetric garments, or invent unseen outsoles.
- Ensure the full item(s) fit within the catalog canvas. White background; transparent cutout when usable and existing white-background fallback when not.

## 3. Current code map and implementation changes

| Area | Current path / fact | Implementation |
|---|---|---|
| Flat-lay scanner instructions | `pipeline/prompts/stage1_detect_facts_v4.txt` clothing-only semantics | Add `stage1_detect_facts_v5.txt` explicitly accepting footwear, with pair grouping, two-pairs rule, footwear-specific visible/occluded parts and useful exclusion reasons. Keep non-footwear accessory exclusions. |
| Scanner model adapter | `pipeline/providers/gemini.py`: `GeminiProvider.detect_items_with_facts` reads v4; `DetectionFields` is generic | Switch to v5; retain existing `DetectedItemWithFacts`, `BBox`, `ItemFacts` if sufficient. Do not split a pair in post-processing. If real tests show grouping errors, add a narrowly scoped, reviewable solution, not a speculative global heuristic. |
| Flat-lay generator | `GeminiProvider.generate` + `stage4_generate_v5.txt` | Add `stage4_generate_footwear_v1.txt`; dispatch by a **central shared footwear category predicate** to the footwear prompt. Keep v5 unchanged for apparel; use existing `image_content`, timeout, fallback, token/cost logging and retries. |
| Worn photo detection | `pipeline/prompts/outfit_detect_v3.txt` includes shoes pair = one candidate | Verify whether v3 actually detects shoes in real fixtures; version to v4 **only if** findings justify prompt changes for visible feet, shoe crop and uncertainty. Preserve person/privacy exclusions. |
| Worn photo generation | `pipeline/outfit.py` uses `outfit_generate_v3.txt` for every candidate | Add `outfit_generate_footwear_v1.txt` and dispatch on candidate category in `generate_selected` / `generate_flatlay` without changing the approved clothing path or new model calls. Use crop and existing optional outlined-context image where helpful. |
| Output verification | `pipeline/stages/stage5_verify.py` color check + OCR note only | Preserve existing verifier but design a **shoe-specific QA gate**: verify shoe count against visible source, rough silhouette, color/pattern, distinct logo/text and pairing. Prefer a human-reviewed fixture set first; if adding automated checks, avoid unproven expensive image-model calls. Don't treat passing color distance as proof of correct shoes. |
| Transparent cutouts | `pipeline/stages/cutout.py`, `isnet-general-use`, `_solidify` | Test paired-shoe gaps, shoe laces, light soles, transparent areas and thin straps; make conditional changes only if reproduced. Keep image fallback. |
| Category / Closet | `mobile/src/categoryGroups.ts` already has Shoes; `mobile/src/categories.ts` stores model category | Add common missing shoe-category aliases as needed (e.g. `mules`, `slides`, `clogs`, `flip-flops`, `pumps`) with tests. Avoid a taxonomy migration. |
| Outfit Builder | `api/outfit_builder/taxonomy.py` already maps core shoe types to `footwear` | Keep mapping in sync with frontend shoe aliases. Verify new footwear appears in output and swap candidates when structurally valid. |
| Capture copy | `mobile/app/(tabs)/add.tsx`, `mobile/src/components/home/AddToCloset.tsx`, `mobile/app/first-pieces/photos.tsx`, camera hints | Update *existing* garment-photo CTA/copy to "Clothes & Shoes" or equivalent and say: "Place matching shoes together, fully in frame, with good light; one pair counts as one item." No extra screens. |
| Legacy side views | `mobile/src/components/ItemSheet.tsx`, `api/routes/v1.py` Back/Turn, `pipeline/turn.py` | This MVP does not add shoe-specific Back/360. Hide or explain unsupported actions for footwear in UI; add backend eligibility checks **before** reserving credits for unsupported shoe Back/360 jobs, without breaking already-existing non-shoe flows. Any legacy stored back/turn should remain safely viewable. |
| API, queue, billing | `api/routes/v1.py`: `POST /v1/garment-scans`, `/.../generate`; `api/worker.py` | Reuse endpoints and jobs. The scan already stores selected detections and generation reuses them. Ensure pair index counts once, owner isolation, accurate `max_items` and credits, and idempotent retry. Avoid migrations unless code inspection proves unavoidable. |

### Suggested stable category recognition
Use a narrow shared predicate such as `is_footwear(category)` with exact tokens/aliases, not substring `"shoe" in category` or a vague "accessory" classifier. Include common types: sneaker/trainer, boot, sandal, loafer, heel/pump, flat, slipper, mule, slide, clog, flip-flop, dress shoe, hiking shoe. Respect the actual model category vocabulary and keep mobile/backend classification aligned. `footwear` is a type/slot, not a new mandatory data field.

### Note on flags and serving
Do not require an additional beta feature flag unless strictly necessary. The owner's first-five beta uses **FastAPI and AI Worker on their Mac behind Cloudflare Tunnel**, Supabase for user data. Do not migrate the backend to cloud compute, deploy anything, restart the live Mac service, switch `WARDROBE_BILLING` or enable `WARDROBE_OUTFIT` without explicit owner approval.

## 4. Suggested footwear-aware prompt requirements

### Flat-lay detection v5
- "Find articles of clothing **and footwear** laid on the capture surface. Shoes/sneakers/boots/sandals/slippers are eligible, not accessories. Exclude bags, sunglasses, jewelry, unrelated objects and clothing/shoes worn by people from the *flat-lay* flow."
- "A photographed matching pair of shoes is a **single candidate** and its box encloses BOTH shoes. Two separate pairs are two candidates. A single visible shoe is a single candidate without assuming its partner."
- "For footwear, describe observed toe shape, upper material if directly visible, laces, straps, sole edge, heel, wear, marks, visible logos/text; hidden or unreadable parts remain unknown."
- "Keep category values compatible with Closet grouping. Use the existing fields and enum vocabularies; do not infer brand or shoe size."

### Footwear generation v1
- "This is a photograph of a *real owned shoe or matching pair*. Recreate the exact evidenced shoe(s) as a clean product catalog image, not a redesigned shoe."
- "For two visible matching shoes, show the same TWO shoes, naturally positioned together. If there is only one visible shoe, show ONLY one."
- "Preserve observed right/left shoes, toe and heel proportions, sole thickness, laces/straps/hardware, material, color and visible wear. Never mirror a shoe to invent its mate or invent brand marks."
- "White background, modest three-quarter/side view that displays shape and sole line, generous crop margins. Do not unfold/flatten or render a mannequin/person."
- "If a reference is partially hidden, do not claim unseen details; follow a conservative continuation of known geometry and never invent distinctive details."

### Outfit-photo footwear generation v1
- Reuse all fidelity constraints above; remove feet, legs, socks and ground/background while keeping the **photographed footwear itself**.
- Preserve the actual pair/single-shoe evidence. No changing type, adding soles/logos, inventing the unseen sides.
- Keep any unverified visible/hidden distinction honest. The existing person-privacy restrictions remain mandatory.

## 5. Quality tests and fixture matrix

Use synthetic or owner-consented footwear photos, never private tester photos in Git. Suggested initial manual comparison set:

| ID | Source | Expected |
|---|---|---|
| SH01 | Matching pair of sneakers on floor | **One** pre-scan candidate, one selected generation, **two real shoes visible** in one catalog image |
| SH02 | A single sneaker on floor | One candidate; **one shoe** in the catalog, no invented counterpart |
| SH03 | Two distinct pairs photographed apart | Two candidates and separate image results, not four |
| SH04 | Sneakers + shirt + trousers in same flat photo | One pair + two garments, all in appropriate categories; no other object included |
| SH05 | One pair partly clipped by photo edge | Existing cut-off behavior preserved, honest lower tier/tip; no impossible invented shoe details |
| SH06 | White/light sneakers and black shoes | Correct shoe edge on white; reasonable cutout and white-background fallback |
| SH07 | Black boots with visible sole and textured material | Silhouette, proportions, marks and details preserved |
| SH08 | Sandals with thin straps | No lost straps, connected-component / cutout regression |
| SH09 | Shoes on feet in outfit photo, full length | One footwear candidate; generation strips feet/legs; user can keep it |
| SH10 | Shoes partly outside a worn outfit photo | Honest candidate visibility/uncertainty or no-match; do not invent the unseen pair |
| SH11 | Wrongly paired / mismatched shoes in same photo | Do not claim they are a matching pair or charge one pair incorrectly |
| SH12 | Non-shoe accessories (bag/sunglasses) | Still excluded from *Garment Photo* flow |
| SH13 | First 3 Pieces: one shoe pair + two garments | Three logical items; round cap unaffected |
| SH14 | New shoe in Closet / Build My Look | Classified `Shoes`, available in footwear slot and compatible swap |
| SH15 | Authorized user A and separate user B | No cross-user access to either shoes or images |
| SH16 | Scan → generate retry / same idempotency key | No duplicate shoe item, second image call or second credit charge |
| SH17 | Back or 360 attempted for footwear | Clear unsupported behavior **before** any billing, while non-shoe actions continue |
| SH18 | Pure clothes-only legacy photo | Unchanged count, prompt quality and billing behavior |

### Automated checks
- Unit tests: footwear predicate; category/group/slot alias mapping; prompt choice flat vs footwear; no garment prompt used for shoes.
- Scanner/parser tests: fake vision result with one pair candidate yields one index and one billed front, two pairs yield two, single shoe never auto-completed.
- API/worker integration with existing fake providers: scan → select → generate → item stored under correct owner → retrieved under Shoes; idempotent duplicate request; no cross-user item access; no double charge.
- First 3 Pieces React/logic regression: a shoe pair is one pick and counts once toward five.
- Outfit photo path: one pair of worn shoes = one candidate; branch to correct footwear generation prompt; conservative result validation.
- Non-shoe back/360 routes still function; shoe attempts cannot create unsupported paid jobs.
- Existing automated suites: `PYTHONPATH=$PWD .venv/bin/pytest -q`, `cd mobile && npx jest && npx tsc --noEmit`, Supabase pgTAP/integration when available.
- Prompt changes MUST be evaluated on **real consented example photos**, not only mocked tests. Record prompt versions, input category, whether pair count and category are right, perceived faithfulness, latency and estimated cost; do not claim visual verification from unit tests.

### Initial release gate
All ownership, pair cardinality, idempotency and billing tests **must pass**. Manually inspect outputs from at least several shoe categories, light/black shoes and a worn photo before enabling for the first-five TestFlight group. Aim for a clear majority of human-reviewed images to be faithful and usable; **do not invent a quality percentage** before a representative pilot exists. If hallucination is material, keep footwear generation off in the beta rather than silently saving wrong catalog images.

## 6. Operational and analytics safeguards

- Existing free scanning and server price confirmation apply to footwear. The front generation price is the current `garment` action price **per selected shoe pair or single shoe item**, not per physical left/right shoe.
- Keep `GARMENT_SCAN_PICKS_MAX`, First 3 Pieces five-item cap, worker concurrency, model-call timeouts, retry ceiling, daily spend caps and bill/refund behavior unchanged.
- Reuse `api/activity.py` event allow-list; a modest aggregated `item_kind=footwear` breakdown may be useful **only if** updated on both app and server, privacy policy and reporting. Do not add personal brand, images, free text or source photo to logs or analytics.
- Compare footwear-specific failure rate, generation duration, estimated Gemini cost per usable shoe catalog item, quality complaints, retake rate and the rate at which shoes become part of user-generated looks.
- Note: existing color/OCR verification is insufficient as proof of shoe-fidelity. Do not label every pass "accurate" automatically.

## 7. Claude Code — implementation handoff (copy/paste)

> **START IMPLEMENTING FOOTWEAR SUPPORT IN KIPS — NOT JUST PLANNING**
>
> Pull and inspect the latest `main` of `RoiSafran9/digital-wardrobe`, run `git status` first, and read `AGENTS.md`, `CLAUDE.md`, `README.md`, `PRODUCT.md`, `DESIGN.md` and the current architecture/PRD. Read this full file:
> `docs/features/footwear-import/01-FOOTWEAR-SCAN-CATALOG-MVP.md`.
>
> **Goal:** support footwear (single shoe and matching pairs) through KIPS's existing Garment Photo, First 3 Pieces, and — when enabled — Outfit Photo import flows, all the way from scan to faithful catalog image, owned Closet entry and Build My Look footwear use. A matching pair must be ONE item, ONE selection, ONE generation and ONE user-priced front action. A single visible shoe must NOT be turned into a fabricated pair.
>
> **Implement now**, not just a design proposal:
>
> 1. Inspect actual detection, generation, crop/verification, worker, API, billing and mobile flows. Reconcile path names against current code.
> 2. Create versioned prompts to explicitly include/describe shoes and to generate real footwear rather than flattened garments. Dispatch on normalized footwear classification; preserve the current clothing prompt path.
> 3. Ensure pair grouping/counting, scan UX, source evidence, catalogue image correctness and no invented second shoe. Handle mixed photos and common shoe types.
> 4. Update existing capture and First 3 Pieces copy minimally; make Shoes grouping and outfit footwear slot robust without new screens or DB models unless evidence requires it.
> 5. Do not expose garment ghost-mannequin Back/360 generation for footwear without a separate approved shoe-specific implementation; reject unsupported requests before credits are reserved. Keep existing saved legacy assets visible.
> 6. Add comprehensive automated tests for one pair, single shoe, two pairs, mixed photo, worn shoes, First 3 Pieces, credits/idempotency, auth isolation, quality fallback and clothing regressions.
> 7. Execute available test/type checks; document all tests you could not run and prepare **real-photo manual QA instructions**. Do not falsely claim that you inspected actual shoe photos unless you did.
> 8. Update code-related documentation and produce an implementation summary with paths changed, prompts versioned, test results, costs and limitations.
>
> **Git:** Work on a dedicated branch (coordinate with ongoing beta observability work; don't overwrite it) and open a PR to `main`. Do not merge until reviewed.
>
> **Infrastructure:** FastAPI and AI Worker stay on the owner's Mac behind Cloudflare Tunnel; Supabase remains as is. No cloud migration, new vendor, deployment, live server restart, production config edits, new payment behavior or activation of feature flags without explicit approval.
>
> **Stop only** for an actual safety/product blocker. Otherwise, implement the MVP and tests and present the PR.

## 8. External research used

- Google AI for Developers, **Gemini Image Generation**: reference-image editing, explicit geometry and detail preservation, and model limitations. https://ai.google.dev/gemini-api/docs/image-generation
- Google AI for Developers, **Image Understanding**: image classification, detection, segmentation and limitations. https://ai.google.dev/gemini-api/docs/image-understanding
- Zalando Partner, **Shoe Image Guide** (updated 2026-10-06): full silhouette, toe-to-heel/sole, side or slight angled primary product views. https://partner.zalando.com/university/article/shoes-image-guide
- Profoto, **How to choose your angles for footwear photo/video shoots**: selecting one shoe vs pair and useful views. https://www.profoto.com/int/en/studio-solutions/tips-tricks/how-to-choose-your-angles-for-footwear-photo-and-video-shoots

The external sources explain general photographic/model practices; they do **not** prove KIPS's actual footwear quality. Only testing real reference photos can do that.
