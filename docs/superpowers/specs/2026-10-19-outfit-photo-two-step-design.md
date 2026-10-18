# Digital Wardrobe — Two Input Flows: Garment Photo and Worn Outfit Photo

**Status:** Core flow approved by owner (2026-10-19); details marked *proposed* pending a research spike and product review.
**Feature:** Import from Outfit Photo / Outfit Photo → Individual Garments
**Related task:** [Claude Code execution brief](../../tasks/outfit-photo-two-step-flow.md)
**Scope:** Capture, detection, review, AI catalog generation, user control and AI Credits. This is **not yet implemented**.

## 1. Why this exists

Digital Wardrobe currently accepts photos of one or multiple clothes **laid flat on a bed/floor** and converts them into separate clean catalog images. Many people already have photos of themselves wearing their clothes. We want to let them import selected garments directly from those images without removing, laying out and photographing every item.

The central product promise is a recognizably faithful catalog representation of **the user's actual item**, not a generic replacement garment. When unseen portions must be completed, plausible neutral reconstruction is accepted and clearly distinguishable from observed details. Visible logos, graphics, printed text and distinct fabric details should not be invented, altered or removed.

## 2. Approved high-level product decisions

1. **Two input modes:** (A) garment-only photo, containing one or more pieces not being worn; (B) a person wearing an outfit. Route to the appropriate processing flow.
2. **Preserve A:** keep the existing laid-flat detection, crops, Gemini generation, optional back image and 360 functionality unchanged. The new feature must not degrade it.
3. **For B, use a two-step user-validation experience:** first identify clothing candidates and show inexpensive, recognizable previews; the user selects or corrects candidates; only the selected candidates proceed to **high-quality** image generation.
4. Do **not** perform expensive full-quality generations for unwanted detected garments.
5. **Charge AI Credits for successful user-approved final-generation actions, not the initial candidate detection/selection phase**. One selected candidate's new catalog front image corresponds to one front-image creation action. Failed generations and internal automatic retries are not separately charged.
6. A user can select just a shirt, just trousers or any subset, even when additional garments are visible.
7. Garments partly hidden by bodies, layering, folds or cropped framing may be plausibly reconstructed; the app must not imply guessed details are verified facts.

The specific classifier, parsing provider, candidate-persistence schema, thresholds, exact prompts, billing timing for user-rejected final results and launch scope are **proposals to validate**, not preapproved implementation choices.

## 3. User journey and branching

```text
Take Photo / Choose from Library
             |
      Determine input mode
        /              \
A: garment-only      B: person wearing an outfit
  (as built)                |
  current quality           |  Stage 1: detect candidates
  -> detect/crop            |  + original-image crops or overlays
  -> front generation      |  (no HQ image generation)
  -> existing results      |
  -> closet                v
                      Review detected items
                      [select / deselect / correct / retry]
                           |
                      Confirm selected items
                      and quoted AI Credits cost
                           |
                      Stage 2: HQ catalog image
                      generation ONLY for selected items
                           |
                      Per-item review / feedback
                      and save successful items
                           |
                         Closet
```

### Input-mode routing

- Proposed: automatically distinguish an ordinary garment photo from a person wearing clothes. Prefer piggybacking on the existing vision pass **if measurement shows that accuracy and latency stay acceptable**; do not add a paid classifier on every ordinary photo without benchmarking.
- Always offer a clear user override ("Garment Photo" / "Outfit Photo"), especially when ambiguous or misrouted. The product may initially use explicit mode choice for the experiment before introducing automatic routing.
- Mixed or ambiguous photos: ask the user rather than silently dropping worn items or routing through the old prompt. Both modes must be reachable from the same add entry point.
- Existing classifier currently excludes worn items in `pipeline/prompts/stage1_detect_facts_v4.txt`; version new prompts instead of rewriting the working garment prompt.

## 4. Outfit Stage 1 — Detect candidates, not final products

**Goal:** provide the minimum quality needed for an informed user decision, at low marginal cost.

- Detect individual visible garments and likely category: top/shirt, outerwear/jacket, trousers/shorts, dress/skirt, optionally shoes after evaluation.
- Return per-candidate a stable ID within its own scan, approximate box and/or segmentation mask, category, color/print clues, visible/occluded parts and a brief uncertainty reason.
- First candidate preview is a **crop from the real photo**, optionally with an outline or mask overlay and a label. A partially isolated crop may still include body pixels; make that clear. Do not call it a clean catalog photo.
- Use a segmentation/human-parsing model only if bounding-box crops cannot separate layered or overlapping items adequately. A generic class-level parsing mask often does **not** isolate two separate jackets/tops and may not label shoes; evaluate instance-level separation.
- Do **not** generate low-resolution AI previews by default. Consider them only as an experimental variant if they demonstrably increase user selection accuracy and their costs/latency are worth it.
- Candidate cards let users select/deselect independently, correct a category where supported, mark "Not my item"/"Wrong item"/"Not recognized", and request a rescan. Allow a clear "None of these" path.
- If the model misses an item, offer rescan or a future manual region-selection option; manual selection is proposed, not mandatory for v1.
- Low-confidence candidates should be labeled in ordinary language ("Partly hidden — result may be approximate"), not artificial numeric confidence percentages without calibration.

**Suggested MVP constraints (validate):** one primary person in a photo; visible main garments only; limited candidate count and image size; exclude jewelry, bags, hats, scarves and multi-person disambiguation initially. Shoes and layered outerwear are candidates for inclusion subject to results, not promised.

## 5. Outfit Stage 2 — HQ generation of selected pieces

- Each selected candidate receives an isolated or focused source reference **plus** the original image/candidate metadata where helpful.
- Generate a complete, flat-lay, centered catalog image on white using the existing Gemini image provider where viable; keep existing local crop, verification and cutout components when compatible.
- A new **worn-garment-specific prompt version** must explicitly separate the clothing from the person's body, remove pose, reconstruct naturally hidden surfaces and preserve all visible real-world print, text, seams, wear, color and material.
- Do not reconstruct a face/body as part of the catalog image. Do not invent visible brand marks, graphics or text or silently replace a patterned garment with a generic alternative.
- Allow completion of unobserved regions when needed for a plausible whole garment. A reconstruction may not be perfectly accurate; label it appropriately.
- Present generated results **before commitment** for this path. The user can keep/save a result or request correction, retake or later regenerate under an explicit credit policy. The existing garment-only flow still auto-saves as built.
- Partial success should save/charge only successful authorized candidate actions; other candidates can fail or be rejected independently. Final charging behavior for subjective "doesn't look like my item" remains a separate owner decision.
- Save approved images under the current user's private wardrobe with clear source type / provenance such as `source_kind = outfit_photo` or a separate origin field (choose after schema review), and preserve correct account ownership and deletion semantics.

## 6. Credits and price consent

- Stage 1 detection and crop/selection are free **to the user** (AI calls still cost the app; measure and rate-limit them).
- Before starting Stage 2, present selected candidate count and an exact quote from server-owned `GET /v1/prices`, including available credits, the total and a clear confirmation. Example: "3 selected · 3 AI Credits" **only if the live front price is 1**.
- There is no separate "outfit token" or different wallet. Reuse the existing per-account credit wallet/ledger and per-front action pricing. User-added back and 360 remain separately priced optional actions after the item exists; do not generate these automatically in outfit v1.
- Unlike the current laid-flat `max_fronts` stepper, **candidate selection happens after detection**, so authorization can be for a known set of candidate IDs. Design a safe two-stage reservation/settlement across requests; do not charge or reserve during free detection.
- Prevent replay/double charge, price drift between quote and confirmation, double generation from polling, and cross-account use of scan/candidate IDs. Enforce max selected count and owner-verified identities server-side.
- If billing is disabled (`WARDROBE_BILLING=off`), show no false monetary deduction; keep the same selection UX.
- Do not enable new billing paths or manually invent an additional price without review.

## 7. Architecture: reuse vs new work

| Existing piece | Proposed treatment |
|---|---|
| `pipeline/orchestrator.py`, `stage0_quality` | Keep garment-only path; reuse relevant preprocessing but benchmark quality thresholds on person photos |
| `stage1_detect_facts_v4.txt` | Keep unchanged; create versioned worn-outfit detection prompt and routing decision |
| `pipeline/stages/crop_item.py` | Reuse crop implementation initially; add mask-based isolation only if evidence supports it |
| `stage4_generate_v5.txt` / Gemini image provider | Keep existing prompt untouched; create worn-to-flat catalog prompt and benchmark it |
| `api/routes/v1.py`, `api/worker.py`, `generation_jobs` | Extend with an authenticated, resumable detect/confirm/generate workflow; inspect whether new tables or job kinds are warranted |
| Supabase Auth / private Storage / RLS | Reuse, including verified user identity and signed owner-only preview access |
| `credit_wallets`, `credit_ledger`, `WalletGate` | Reuse existing account wallet and partial settlement; integrate only after robust candidate confirmation |
| `mobile/src/useCapture.ts`, `FrontsPicker` | Preserve old route; add outfit path with candidate picker replacing guessed count once detection finishes |
| `mobile/src/components/*`, `DESIGN.md` | Match existing native iOS UI, dark mode and accessibility conventions |

Possible new entities: an `outfit_scan` session and per-scan `outfit_candidates` in the database, or an equivalent durable result on a generation job. This is a **design choice**, not a prescribed schema. Avoid duplicates/extra infrastructure. Capture scan status, candidate IDs, source image and crop paths, state, expiration/deletion policy, and selected IDs. A user must never be able to forge or select someone else's candidate.

Maintain source privacy: person photos may contain faces, other people, homes and location clues. Upload securely, do not log full image bytes or personal descriptions, avoid identity/biometric inference and inference about protected attributes, minimize retention of full-person originals and temporary crops, define clear deletion/expiry and communicate retention to users. Using third-party models requires license, privacy and retention review.

## 8. Technical uncertainties / research questions

1. Can the existing Gemini vision model detect **layered individually distinct worn garments**, not just broad "top" and "bottom" classes?
2. How much does source crop vs subject/garment mask improve faithful reconstruction, especially a jacket over a shirt?
3. Can the current Gemini image generation produce believable *flat-lay of the same garment* rather than a plausible invented product?
4. What does a person photo do to our existing local color verification and OCR? What new signals are useful for materially wrong detail?
5. How reliable is automatic routing, and can we avoid an extra billable vision call on every ordinary photo?
6. What is the lowest-complexity way to persist a detect → user selection → generate workflow through phone disconnects and app restarts?
7. What should be the first supported set of garment classes and visibility conditions?
8. Does an open-source parsing component materially help? Review actual licenses and inference costs. Example for research, not a mandate: https://github.com/fashn-AI/fashn-human-parser (semantic human parsing; licensing review required).

## 9. Research spike / evaluation gates

**Do not treat feasibility as demonstrated yet.** Before committing the customer-facing flow, test on 30–50 consented real person-outfit photos with **reference flat-lay photos of the very same garments wherever possible**. Include easy, occluded, layered, printed/logos, long garments and varied lighting/poses.

Measure and report:
- Correctly identified distinct clothing candidates per image; false positives/negatives and selections.
- Candidate preview clarity: can humans pick the intended garment without an AI render?
- Final recognizable fidelity: color, pattern/text/graphics, silhouette, materials and invented details.
- Percentage of attempted selected garments that produce an acceptable image, per garment category and occlusion level.
- End-to-end median / slow-case latency; AI provider calls and **cost per accepted generated front**, including discarded attempts.
- Rate of user correction, rescans and rejects; time-to-add relative to the existing laid-flat flow.
- Privacy exposure and storage-retention risk.

Define concrete quantitative pass/fail thresholds **after an initial baseline and with owner review**, rather than inventing a success rate in advance. A clear "not enough information: photograph the piece alone" fallback is a valid product outcome.

## 10. Recommended rollout

- **Phase 0: research + offline proof of concept.** Compare Gemini-only detection/crop with optional parser segmentation; prototype generation on selected crops; report examples and measured limitations. No mobile UI or billing changes.
- **Phase 1: backend candidate session.** Authenticated API/temporary previews and durable candidate selection semantics. No expensive final generation without an explicit selection.
- **Phase 2: mobile candidate picker + review.** Add mode routing/override, previews, selection/corrections, clear generation quote, progress and final review.
- **Phase 3: reliable generation + credits.** Reuse job worker, item persistence, wallet and idempotency; add failure/partial-success tests and two-account privacy tests; feature flag until approved.
- **Phase 4: small F&F experiment.** Observe quality, actual AI cost and user choices, adjust scope before wider release.

## 11. Acceptance criteria for the eventual feature

- Ordinary garment-only pictures follow the existing route without regression or surprise extra generation.
- A person wearing 3+ visible items produces preview candidates without high-quality generation; the user can select just one.
- Only selected candidates receive high-quality generation and become eligible to be saved.
- A user explicitly knows and approves the price before charged generation; credits never debit for free detection or internal retries.
- One failed generated candidate doesn't delete or charge another successfully produced candidate.
- Authenticated user A cannot view/select/generate from user B's scans, originals, previews, candidates or results.
- Uncertain details are labeled as inferred; faces/people do not appear in final product images.
- Restart, network failure and duplicate taps do not lose the job or create duplicate items/charges.
- Tests cover the router, detect/select/generate state machine, input modes, charge boundaries and privacy.
- Quality has been evaluated on actual worn garments with reference photos; failures are honestly reported.

**Product distinction:** "Import from Outfit Photo" is **inbound clothing extraction** from a photo of someone wearing clothes, **not** outfit recommendations or virtual try-on (dressing a person in a garment).
