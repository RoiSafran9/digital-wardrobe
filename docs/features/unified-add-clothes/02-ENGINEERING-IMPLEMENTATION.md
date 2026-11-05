# Engineering Implementation — Unified Add Clothes

**Implementation type:** Existing React Native / Expo Router UI flow refactor + narrowly scoped hanging-clothes prompt compatibility. **No redesign of API/job/database/credit contracts.**

## 1. Repo mapping verified on 2026-11-05

| File | Existing responsibility | Required work |
|---|---|---|
| `mobile/app/(tabs)/index.tsx` | Home CTAs; `pickInto` library routing; empty/nonempty content | Replace two direct-entry paths with one `Add Clothes` CTA to canonical add hub; keep guided First 3 Pieces for signed-in empty closet and all other Home features |
| `mobile/src/components/home/AddToCloset.tsx` | `AddToCloset` and `AddRows` render different Flat Lay/Worn controls | Refactor to single CTA component or remove obsolete dual-card exports; no duplicate choosing |
| `mobile/src/components/home/HomeEmpty.tsx` | First 3 Pieces CTA + currently children `AddRows` + tips | One primary guided CTA in signed-in empty state; avoid duplicate photo-type controls; update copy |
| `mobile/app/(tabs)/add.tsx` | Two method cards open cameras; legacy `?mode=outfit` auto-pushes camera | Become type-and-source hub. Allow `mode` deep links to preselect type and display source choice rather than surprise-open camera; keep pending review, credits, server paused, first-piece tips |
| `mobile/app/capture/camera.tsx` | Camera takes a `mode` but also lets user switch `GARMENTS / OUTFIT`, includes library shortcut and First 3 collect | Keep `mode` as route data, remove visual type switch and runtime type setter; preserve shutter, library fallback, camera permission, full-screen safe areas, collect tray and correct nextRoute |
| `mobile/app/capture/preview.tsx` | Flat scan runs on mount, shows found pieces and billing | Add same-photo `Change Photo Type` or contextual retry, with pre-generation guard and outfit-enabled flag; preserve existing fallback and quote semantics |
| `mobile/app/outfit/detect.tsx` | Worn scan automatically opens pick | Add manual/change option for mistaken type at failure/scan stage, retaining local URI; don't break async scan cancellation/navigation |
| `mobile/app/outfit/pick.tsx` | Worn selections, sceneNote, corrections, credit confirmation | Add prominent same-photo shortcut for `scene_kind=flat` and accessible `Change Photo Type` before charge; preserve outfit pick/review |
| `mobile/app/first-pieces/index.tsx` | Near/not-near question; conditional Worn photo | Replace the *wording/chooser* with shared visual type selection, reuse the exact type/source labels, keep the `path_selected` semantics |
| `mobile/app/first-pieces/photos.tsx` | Multi-photo tray and library, collect-mode camera | Keep tray architecture, rename garment-only copy where needed; no type toggle while collecting |
| `mobile/src/photoPicker.ts` | `pickPhoto` / `pickPhotos`, iOS HEIC conversion, permissions | Reuse directly; don't create another photo service or request camera permission for library |
| `mobile/src/outfit/outfit.ts` | `isWornRejection`, `sceneNote` and route helper text | Reuse/extend safe routing copy, do not erase useful failure detection |
| `mobile/src/activity/track.ts` + `api/activity.py` | Client event types + backend property allow-list | Add tightly bounded, matching choice/correction events if instrumented; update privacy category registry/tests |
| `pipeline/prompts/stage1_detect_facts_v5.txt` | Garments/shoes detection on a laid surface only | New `stage1_detect_facts_v6.txt` recognizing unworn garments hanging on hanger/hook, with correct boxes and no false positives for clothes worn on people; maintain shoes pair semantics |
| `pipeline/prompts/stage4_generate_v5.txt` | Catalog instruction assumes lying on bed/floor | New `stage4_generate_v6.txt` that also accepts hanging/vertical garment photos, removes hanger/background without inventing details, preserves fidelity; keep footwear-specific prompt dispatch untouched |
| `pipeline/providers/gemini.py` | Reads prompt versions / dispatches garment vs footwear | Switch **garment-only** paths to v6 as appropriate; update structured log prompt version; never replace footwear-specific prompt or add AI calls |

Inspect current files before editing; if path or behavior changed on latest `main`, adapt and document.

## 2. Concrete navigation and type model

Prefer a small, typed shared module/component (names flexible):
- `AddPhotoType = "laid_out" | "worn"` (UI concept).
- Internal mapping: `laid_out → mode:"garments" → /capture/preview`; `worn → mode:"outfit" → /outfit/detect`.
- Source: `camera | library`.
- Entry: `home | add | first_pieces` (event property only if recorded).
- Keep `mode` as existing camera param, not a second user choice.

**Routing map:**

| Entry/type/source | Destination | Next |
|---|---|---|
| Home Add Clothes | `/(tabs)/add` or existing tab URL | Select type on add hub |
| Add + laid_out + camera | `/capture/camera?mode=garments` | Shutter → `/capture/preview` |
| Add + laid_out + library | native single picker | Selected URI → `/capture/preview` |
| Add + worn + camera | `/capture/camera?mode=outfit` | Shutter → `/outfit/detect` |
| Add + worn + library | native single picker | Selected URI → `/outfit/detect` |
| First 3 + laid_out | `/first-pieces/photos` | Camera collect (`collect=1`) or multi-library → guided tray/pick |
| First 3 + worn + camera | `/capture/camera?mode=outfit&onboarding=1` | → `/outfit/detect?onboarding=1` |
| First 3 + worn + library | native picker → `/outfit/detect?onboarding=1` | → outfit pick/review with onboarding preserved |
| Garment pre-gen correction | `/outfit/detect?uri=<same-local-uri>` | Fresh free worn scan, never paid automatically |
| Worn pre-gen correction | `/capture/preview?uri=<same-local-uri>` | Fresh free garment scan, never paid automatically |

Implementation notes:
- Do not stringify or log private photo URIs; Expo Router already transports URI parameters in app navigation.
- Never include a user-controlled URI in server logs, analytics or public links.
- Prefer `router.replace` for type corrections, avoiding back-stack loops. Do not unmount/delete temporary photo until the next screen can open it.
- Switching type invalidates *only* obsolete client preview/selections and never reuses an old scan ID, price quote, selection, or paid job.
- A scan may already have run automatically upon showing a preview. Trigger second free scan **only when user explicitly changes type**; don't repeatedly auto-toggle or retry due to model ambiguity.
- Gracefully handle URI missing, canceled picker, permission denied, scan timeout/expired, server flag disabled, and back navigation.
- If the server's Outfit feature is unavailable, don't offer worn type or correction toward it. Keep default laid-out flow working.
- Type/source selection should be shared/consistent; avoid duplicate business logic in Home/Add/First3. Reuse existing styled `PressScale` / `Sheet` / `Button` components.

## 3. UI wiring details / edge cases

**Home:** Make one obvious Add Clothes CTA. With a signed-in empty closet keep guided First 3 Pieces CTA as primary, suppress `AddRows` duplicating Flat Lay/Worn selection; local-mode has a working Add Clothes fallback. Do not remove `CaptureBanner`, pending/failed job paths, outfit suggestions CTA, category browsing, account status logic.

**Add tab:** Each type card is visually distinct and accessible; tapping either opens **the same source choice**. Ensure source chooser can cancel and return to type selection. A `mode=outfit` deep link should preselect worn type but **not automatically start camera** (old useEffect); test the back/duplicate navigation.

**Camera:** Type is fixed based on initial route; render no mode tabs. Library shortcut inside camera, if retained, must open the library for **this same type** (not silently switch). Do not make collect mode able to switch into worn mid-round; keep its Done/preview behavior. Keep camera-permission fallback. If receiving an invalid mode, resolve to laid_out safely and never route to disabled outfit flow.

**Outfit scan/review:** When `scene_kind=flat`, present the correction action and keep URI. The current timed forward to pick must not make correction unreachable or race it. A practical minimal solution is a visible correction on `/outfit/pick`, with an error/empty-state correction at `/outfit/detect`; if changing timer behavior, add timer cleanup tests. Disable correction once paid job creation starts.

**Errors:** Surface failures without jumping to an unrelated screen, and don't display a generic "No clothes found" with no recovery when a same-photo correction is possible.

**UI copy:** Use titles/captions from `01-PRODUCT-UX-SPEC.md`. Existing descriptions of cost/free scan must not become misleading. Update `mobile/src/components/home/HomeEmpty.tsx` and relevant First3 hints. Use "pieces" rather than "garments" when referring to clothes and shoes together.

## 4. Hanging garment support — narrow backend change

Current contradiction: source scanner `stage1_detect_facts_v5.txt` says `included` only if laid on surface; previous UI says "hung" is supported. The user explicitly wants "laid/spread/hanging" to work.

- Add versioned `stage1_detect_facts_v6.txt` (do not edit v5): include a fully-visible unworn jacket/shirt/dress on a hanger/hook/rail as a candidate; bounding box for the **garment only** (exclude rack/hanger when possible); record hidden/occluded parts honestly; exclude actual garments worn by a person; protect shoe pair rules from v5. Retake if too little garment is visible/poor photo. Don't classify accessories as clothing.
- Add versioned `stage4_generate_v6.txt` (do not edit v5): recognize a vertically hanging garment input; isolate the same item onto white background, unfolded/arranged for accurate catalog depiction; remove hanger/clips but **do not invent missing collar/texture/print/shape**; preserve currently approved garment-fidelity constraints.
- Update `GeminiProvider.detect_items_with_facts` and garment-only `GeminiProvider.generate` prompt version selection and log versions. **Keep `stage4_generate_footwear_v3.txt` (or latest approved footwear version) and `outfit_generate_footwear_v1.txt` decisions untouched.** Do not alter the currently chosen shoe camera angle.
- Test hanger photos across shirt, dress and jacket alongside laid garments and shoes. Unit tests on prompt text alone are insufficient proof of model success. If poor fidelity remains, document the limitation and adjust the UX claim rather than marking hanging support "verified."
- No automatic scene classifier, no database migration and no new model call.

## 5. Analytics for first-five launch

Important: selection and correction are **user UX events**, not backend AI outcomes. Reuse existing `capture_source` after a successful camera/library choice; don't double-count it from both Add and camera.

Add **at most two** small events (example):
- `add_photo_type_selected { type: "laid_out"|"worn", entry: "add"|"first_pieces" }`
- `add_photo_type_corrected { from: "laid_out"|"worn", to: "laid_out"|"worn", stage: "garment_preview"|"outfit_detect"|"outfit_pick" }`

If implemented, add matching strict allow-lists to `mobile/src/activity/track.ts` and `api/activity.py`, matching tests, `PRIVACY_CATEGORIES`, and privacy text only where materially needed. No images, URIs, filenames, user input, photo text, identifiable content or device identifiers in props. Avoid introducing client-side per-user global state for routing; navigation params suffice.

Keep `path_selected {path:"near"|"not_near"}` and `generation_started.path` unchanged, mapping UI types to existing internal values where necessary so launch reporting stays compatible.

## 6. Security, billing and infrastructure

- All existing API ownership checks, per-user storage, job token verification and review-state handling remain unchanged.
- No new payment action or credit price; scan is free and generation uses existing per-piece server-confirmed cost.
- Idempotency, scan expiry, reserved credits and job concurrency remain unchanged. A type correction **before** generating cannot create a paid job.
- Beta server and AI Worker remain **on owner's Mac** via Cloudflare Tunnel, Supabase remains hosted. No config changes, environment secrets, Apple publishing, live restarts or migration to cloud compute without explicit owner authorization.
- Reuse running first-five observability PR #31 correlation and KPI reporting; do not disable or replace it.

## 7. Suggested implementation order

1. Read repo instructions, inspect git status/branches and latest code. Create dedicated feature branch, don't overwrite pending edits.
2. Add typed shared photo-type/source chooser, and route constants/helpers with focused navigation tests.
3. Make Home one CTA and Add canonical chooser. Preserve empty closet guided path, credits and pending items.
4. Fix camera type and source routing, remove duplicate mode tabs. Preserve First3 collect and camera permissions.
5. Add same-photo correction in garment preview and worn scan/pick, with safe cancellation and billing guards.
6. Align First 3 Pieces type wording and library/camera choices; preserve round mechanics and analytics.
7. Version garment detection/generation prompts for hanging items, route them through current Gemini adapter, with fake-provider and real-photo QA plan.
8. Add privacy-safe events if needed, server allowlist updates and tests.
9. Run full checks, document test outcomes and device QA limitations, then open PR targeting `main`. **Do not merge or deploy without approval.**

## 8. What to avoid

- Do **not** build AI automatic photo-type classification.
- Do **not** combine backend pipelines or automatically spend credits on scene change.
- Do **not** add a second "Add Clothes" screen plus the existing Add tab.
- Do **not** change approved shoe prompt strategy, First3 data model, billing configuration or server hosting.
- Do **not** claim live phone, Mac, EAS or real-photo behavior was tested unless it was actually exercised.
