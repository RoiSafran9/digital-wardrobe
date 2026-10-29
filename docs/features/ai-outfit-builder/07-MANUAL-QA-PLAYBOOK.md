# AI Outfit Builder — Manual iOS QA Playbook

**Status:** Ready-to-run baseline, pending review against actual Claude Code PR  
**Date:** 2026-10-29  
**Product:** KIPS / Digital Wardrobe  
**Scope:** The approved Outfit Builder MVP in documents 01–06 in this folder.  
**Important:** These are manual test *scenarios*, not assertions that implementation has already passed. Update exact screen labels, feature flags, and test hooks to match the delivered PR before executing.

## 0. Rules for testing

- Execute on a physical iPhone when available. Run a smoke pass on iOS Simulator too.
- Use only self-owned or explicitly approved synthetic/demo wardrobe items. Never copy another user's real photos.
- Record each case as **PASS / FAIL / BLOCKED / NOT RUN**, with device, build/commit, date, fixture/account, screenshot/video, and issue link.
- For each generated look compare *every displayed garment* against the signed-in account's actual Closet. Matching generic style or color is not enough: the specific item must exist.
- Separate **technical correctness** (ownership, valid slots, correct swap) from **subjective styling quality** (would a person wear this combination?).
- Do not confuse optional slots with errors: a top + bottom may be a complete core outfit even when the user has no shoes. A dress counts as one-piece, not a bottom.
- Manual weather is an input chosen by the tester; there must be **no automatic location/weather service**.
- Some fault cases need a developer-controlled staging toggle/mock (marked **ENG**). If unavailable, mark BLOCKED, not PASS.
- Feature must not call image-generation endpoints or create real outfits as persisted wardrobe objects. Suggestions and edits are ephemeral.
- The docs suggest recommendations may be free in beta, but **pricing remains a product decision**. Until confirmed, report any credit deduction as a question/blocker; never assume it is approved.

## 1. Test setup and fixture wardrobes

Set up a staging/demo environment with two separate accounts A and B, using existing authenticated test setup. Where possible pre-load clearly distinguishable garments and log their exact item IDs in private test notes. Use the existing item catalogue images; no stock/generated substitute in the recommendation UI.

| Fixture | Garments | Purpose |
|---|---|---|
| F0 Empty | No saved/ready items | Empty state |
| F1 Tops only | Five clearly different tops, no bottoms/dresses | No fake full looks |
| F2 Minimal | One top + one bottom | Exactly one valid core combination |
| F3 Small varied | Three tops, two bottoms, one jacket, optional shoes | Multiple suggestions and swaps |
| F4 Dresses/skirts | Two dresses, one skirt, two tops, cardigan | Correct slot mapping |
| F5 Broad | 25–40 varied items, mixed colors/formality/seasons | Quality and diversity |
| F6 Weather contrast | Thick coat/knit + thin tee/linen/shorts | Hot/Cold constraints |
| F7 Uncertain | Valid tops/bottoms with unknown fabric/formality | Honest explanations |
| F8 Similar basics | Several near-identical tops + one bottom | Avoid padded near-duplicates |
| F9 Large | 100–150+ items if practical, seeded synthetic items | Latency, scrolling, bounded work |
| F10 Stale | Valid look, then delete one involved item from normal Closet | Invalidation |
| F11 Account isolation | Account A: recognizable blue top, B: recognizable red top, both with bottoms | Privacy boundary |

If fixture setup is expensive, prioritize F0, F2, F3, F4, F5, F6, F10, F11; mark others BLOCKED and explain. The Outfit Builder should run with normal wardrobe data, not a fabricated test-only catalogue.

## 2. Fast smoke pass — run first after each new build

| ID | Steps | Expected result |
|---|---|---|
| S01 | Sign in with F3; find **Build My Look** in Home/Closet and open it. | Entry is discoverable; navigates to the dedicated screen without affecting existing tabs. |
| S02 | Leave all optional filters as Any; tap **Generate Looks** once. | Loading → 1–3 results; no forced questionnaire or location permission. |
| S03 | Compare every garment image and label on a suggested look against F3 Closet. | Each item is truly owned and active; no external/stock images, duplicates inside one look, or invented clothes. |
| S04 | Open a suggestion; tap one top/bottom; choose **Swap This Piece** and apply another item. | Only selected slot changes; other item images/IDs remain exactly the same. |
| S05 | Close the swap sheet without selecting; go back to results and return to look. | No unintended changes or lost on-screen look within the active session. |
| S06 | Sign out and sign in as Account B. Navigate to Builder. | No A photos/recommendations remain visible, even briefly; B suggestions only. |
| S07 | Open a normal wardrobe item and normal Add entry. | Existing Closet and Add flows still function. |

## 3. Full functional UX matrix

| ID | Preconditions and actions | Expected / what to check | Priority |
|---|---|---|---|
| UX01 | Open Builder on small iPhone and larger iPhone. | Input choices legible, usable without cut-off; visible primary CTA. | P1 |
| UX02 | On F3 select and clear Occasion, Style, Vibe, manual Weather and Colors. | Each field accepts Any, selected state is obvious, Clear/Any returns to defaults. | P1 |
| UX03 | On F3 tap Generate with no filters selected. | Succeeds where viable, does not demand weather, taste profile or extra information. | P0 |
| UX04 | On F3 select Work + Smart Casual + Warm; generate. | Filters reflected in output or honest no-match; copy never claims a live forecast was checked. | P0 |
| UX05 | On F6 choose Hot; generate. Repeat with Cold. | Heavy winter layers strongly disfavored in Hot; Cold can use warmer items. Unknown fabric handled conservatively. | P1 |
| UX06 | Choose Rainy with known mixed outfit. | Does not infer a temperature or claim waterproof fabric without verified metadata. | P0 |
| UX07 | Choose contradictory preferences, e.g. Formal + Sporty, on casual wardrobe. | No crash, no silent fabrication; sensible candidates or clear adjust-preferences state. | P1 |
| UX08 | On F0 attempt Generate. | Helpful empty state, Add Clothes action, no demo outfit presented as personal. | P0 |
| UX09 | On F1 attempt Generate. | Explains missing bottom/one-piece; never invents a full look. | P0 |
| UX10 | On F2 generate. | One valid core outfit only; not three cosmetically renamed duplicates. | P0 |
| UX11 | On F3 generate. | 1–3 different recommendations; count and titles match actual results. | P0 |
| UX12 | On F4 generate. | Dress uses one-piece template; skirt uses bottom slot and needs a top; no nonsensical dress-as-bottom pairing. | P0 |
| UX13 | On F3 remove all shoes and generate. | Can still offer core top+bottom; no fabricated shoes. | P1 |
| UX14 | On F8 generate repeatedly. | Does not pad output with near-identical repeated combinations just to reach three; explicit difference is meaningful. | P1 |
| UX15 | Inspect card images/labels/rationales in results and detail. | Images render sharp, don't overlap; copy is short, readable and accurately reflects owned pieces and chosen inputs. | P1 |
| UX16 | On F3 tap Generate Again / Try Again if included. | Re-run is explicit; results remain valid. No spinner loop or fabricated progress percent. | P1 |
| UX17 | On F3 open look, tap a garment, open swap sheet. | Current piece clearly identified; alternatives only from the relevant structural slot and owner's closet. | P0 |
| UX18 | On F3 select alternative; note all item IDs before/after. | Exactly one slot changes, other slots and source images remain unchanged. | P0 |
| UX19 | Dismiss swap with X, back gesture and system modal close. | Original look unchanged; no hidden mutation. | P1 |
| UX20 | On F2 try swapping the only top/bottom. | Friendly no-alternatives state; no unowned stock images; can return to look. | P1 |
| UX21 | On F3 manually choose a less highly ranked but compatible alternative where browsing is supported. | User choice can override style rank; hard slot/ownership constraints preserved. | P1 |
| UX22 | On F10 generate a look, delete a garment from normal Closet, then try swap/apply. | Stale/deleted item rejected/refresh offered; no crash or stale image exposure; no unrelated item is replaced. | P0 |
| UX23 | Navigate to another tab and back during the same session; then terminate/relaunch app. | In-session navigation behaves predictably; no promise that generated looks or swaps persist after relaunch. | P1 |
| UX24 | On F3 rapidly tap Generate multiple times and tap swap/apply repeatedly. | UI prevents accidental duplicate calls/actions, stuck controls or incorrect composition. | P1 |
| UX25 | Observe opening/processing/results on light/dark mode. | Sufficient contrast and visible controls; no text over images. | P1 |
| UX26 | Enable large text/Dynamic Type and VoiceOver; navigate form/cards/swap. | Controls announced with meaningful labels (garment type/color if known), correct focus order, accessible loading/error states. | P0 |
| UX27 | Enable Reduce Motion, test loading and sheet transitions. | No required information conveyed only by animation; no distracting essential transitions. | P2 |
| UX28 | On F9, generate and browse results/swap options. | No freezing, oversized delay or unusable scroll; record observed latency, device, wardrobe size. | P1 |

## 4. Recommendation engine — human evaluation

Run the same scenarios using F5/F6/F7 and capture screenshots of results, **without** showing the person scoring them the AI's internal explanations if possible. Use at least two human reviewers for subjective evaluations. Each look is scored 1–5 on: **occasion fit, style coherence, manual-weather fit, wearability, and diversity of the set**. Also capture the binary/uncertain question **Would you actually wear it? Yes / No / Unsure**.

| ID | Input / fixture | What must be verified |
|---|---|---|
| REC01 | F5; defaults Any | 1–3 structurally valid real-owned combinations; different enough to be useful. |
| REC02 | F5; Work + Smart Casual | Workplace-appropriate combinations where wardrobe permits, not extreme streetwear/formal extremes without explanation. |
| REC03 | F5; Going Out + Bold | Proposals differ from minimal casual baseline if appropriate pieces exist; no hallucinated accessories. |
| REC04 | F6; Hot | Summer-appropriate selection; avoids heavy coat when alternatives exist. |
| REC05 | F6; Cold | Can sensibly layer when appropriate; doesn't invent warmer items that aren't owned. |
| REC06 | F5; Rainy | No claim of verified current weather or waterproof clothing, no implied temperature. |
| REC07 | F5; Colors Neutral vs Colorful | Color preference visibly influences ranking if inventory allows; no false claim about exact garment color. |
| REC08 | F7; sparse metadata | Rationale avoids asserting unverified fabric, warmth or formality; still produces conservative valid looks. |
| REC09 | F4; dress/skirt category mix | Fashion-structural sense of one-piece vs top+skirt, independent of styling taste. |
| REC10 | F8; duplicates | Three recommendations are not artificially padded by almost-identical pieces. |
| REC11 | F3; swap bottom while keeping top/jacket | Alternative complements fixed pieces and user parameters; one item changes only. |
| REC12 | F5; repeat same selections three times | Never produces invalid outfits; note variability and any repeated looks (repetition is not automatically a bug if options are limited). |

**Suggested qualitative decision rule:** All ownership and structural checks must pass. If a majority of human-reviewed looks are considered unwearable or irrelevant, treat it as a release-quality blocker even if backend tests pass. Do **not** advertise a statistically proven recommendation-quality improvement from a small beta sample.

## 5. Reliability, account safety and scope integrity

| ID | Setup / action | Expected | Type |
|---|---|---|---|
| REL01 | F11 sign out A → sign in B while Builder visible; re-enter. | No A images, item names or suggestions leak into B view. | P0 |
| REL02 | **ENG:** inject an invalid/nonexistent or other-account ID in model output. | Server rejects invalid item before display and returns valid deterministic fallback or controlled error. | P0 |
| REL03 | **ENG:** attempt unowned/stale item in swap request. | No foreign item appears or can be applied; controlled rejection. | P0 |
| REL04 | Disconnect network before Generate; reconnect and Retry. | Clear offline message/recovery; no fabricated recommendation, no unrelated wardrobe mutation. | P1 |
| REL05 | **ENG:** model times out / returns malformed JSON. | Valid deterministic fallback when candidate pool exists, or understandable retry; no crash. | P0 |
| REL06 | **ENG:** backend returns 429 or 5xx. | Recoverable error; existing valid looks remain where possible; controls don't freeze. | P1 |
| REL07 | Generate and swap 2–3 times; check account wallet, asset count and Closet. | No new image-generation requests, no look history table/record, no unexpected credit charges; actual wardrobe items unchanged. | P0 |
| REL08 | Inspect any weather prompts/permissions. | No GPS prompt, no forecast call and no automatic use of city/IP weather. | P0 |
| REL09 | Leave Builder, open other tabs, relaunch. | No outfit diary/saved outfit history created; no unrelated changes to First 3 Pieces Onboarding or garment generation. | P1 |
| REL10 | **ENG:** verify logs/telemetry for a recommendation request. | No private image URLs, original outfit photos, private item IDs in analytics or location data. | P0 |

## 6. Mini field-test script — real tester, no coaching

Give the tester a staging account with a varied demo wardrobe or their own approved items. Do not tell them where the controls are. Ask them to:

1. **"Find a look for work on a warm day."** Observe navigation, input understanding and time to first usable suggestion.
2. **"I like this outfit, but not these pants. Change only the pants."** Observe whether tapping the clothing image makes swap obvious.
3. **"Would you wear any of the offered looks? Which, and why?"** Record spontaneous reactions, not just a rating.
4. **"Now imagine it's rainy; adjust the recommendations."** Check discoverability and interpretation of manual weather.
5. **"Exit and come back. What do you expect to have been saved?"** Check that users understand the ephemeral nature of suggestions.

Record: task success without hints, time, confusion, unexpected expectations, reason a look felt wrong, and whether the tester would use it on another day.

## 7. Test-run report template

**Run ID:**  
**Date:**  
**App build / PR / commit:**  
**Device + iOS version:**  
**Tester:**  
**Account/fixture ID (non-sensitive):**  
**Feature flag + AI mode:**  

| Test ID | Status: PASS/FAIL/BLOCKED/NOT RUN | Actual behavior | Screenshot/video or issue link |
|---|---|---|---|
| S01 | | | |
| S02 | | | |
| S03 | | | |
| S04 | | | |
| S05 | | | |
| S06 | | | |
| S07 | | | |

**Human-rated recommendation example:**

| Scenario | Look # | Wear? Yes/No/Unsure | Occasion 1–5 | Coherence 1–5 | Weather 1–5 | Diversity 1–5 | Why? |
|---|---|---|---|---|---|---|---|
| Work + Smart Casual + Warm | 1 | | | | | | |

**Bug report template:**

- Title: [Outfit Builder][P0/P1/P2] concise problem
- App build, device/iOS, signed-in test fixture (no private credentials)
- Preconditions and selected filters
- Exact steps to reproduce
- Expected vs actual result
- Screenshot or short recording (redact personal images)
- Frequency and whether it reproduces after retry
- Related test ID

### Prioritization

- **P0 / Block release:** another user's item exposed, fabricated/unowned item, charges/new images unexpectedly triggered, invalid core outfit presented as wearable, app crash on core path, swap mutates unrelated slot.
- **P1 / Fix before broad rollout:** failed core interactions, hard-to-understand empty state, no swap recovery, bad handling of explicit weather/formality, inaccessible core controls, repeated spinner.
- **P2 / Polish:** alignment, spacing, secondary animation, minor copy inconsistencies.

**Recommended release gate:** All P0 scenarios PASS; no unresolved P0/P1 bugs from core flows; human fashion-quality review shows that suggestions are regularly useful rather than merely structurally valid; cost and latency measured. One manual pass is *not* a substitute for backend auth/idempotency/unit tests.

## 8. Claude Code QA handoff

When the feature PR is ready, ask Claude Code to:

1. Read this document and 01–06 specs.
2. Point each manual test to the actual mobile route, real backend endpoint and any required test fixture/flag.
3. Set up only safe dev/staging fixtures and fault-injection hooks; do not touch production customer data.
4. Provide simulator/physical-device setup steps and a suggested first 7-case smoke sequence.
5. Report which cases are automated, truly manual, or require engineering mock setup.
6. Do **not** mark manual scenarios PASS without a real human/device run or explicit reproducible evidence.

QA plan may be amended against the actual PR implementation, but never silently relax ownership, real-catalog-image, no-weather-service or no-history invariants.
