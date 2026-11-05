# Implementation Report — Unified Add Clothes

**Date:** 2026-11-05 · **Branch:** `feat/unified-add-clothes` (PR to `main`, not merged) · **Base:** `main` at `288015f`.
Not deployed, the Mac server was not restarted, no EAS/TestFlight build was made.

## What the user sees

| Surface | Before | After |
|---|---|---|
| Home (pieces) | `FLAT LAY` (Camera / Library) and `WORN` (Choose Photo) tiles | One **Add Clothes** row → Add tab |
| Home (empty, signed in) | First 3 Pieces card + garment/outfit Camera/Library rows | First 3 Pieces card only |
| Home (empty, local mode) | garment/outfit rows | One **Add Clothes** row → Add tab |
| Add tab | Two method cards that always opened the camera; `?mode=outfit` auto-opened the camera | "Choose what your photo shows." → **Clothes by themselves** / **Someone wearing them**; the chosen card shows **Take Photo** and **Choose from Library**. Library opens the picker directly. `mode=` links preselect a type and wait |
| Camera | `GARMENTS` / `OUTFIT` tabs | No tabs. Header and hint follow the route's type; library button and camera-refused fallback keep that type |
| Garment preview | "Try it as an outfit photo" only for some worn rejections | **Change Photo Type** (after the free scan, before generating; also on the fallback quote). Worn rejection: "This looks like someone wearing the clothes. Try as a worn photo." |
| Outfit detect / pick | Scene note only | Detect failure: **Change Photo Type**. Pick: "These clothes look laid out. Try as clothes by themselves." + button when `scene_kind = flat`, otherwise **Change Photo Type**; hidden once generating starts and when the photo URI is missing |
| First 3 Pieces | "Are you near your wardrobe?" Yes / Not right now | "What will your photos show?" with the same two cards. Laid out → the multi-photo tray; worn → Take Photo / Choose from Library in onboarding mode. Tray buttons: **Take Photos** / **Choose from Library** |

Outfit import off (`WARDROBE_OUTFIT` not on): only "Clothes by themselves" is offered anywhere, the camera treats `mode=outfit` as laid out, and no correction toward the worn flow is shown.

## Code paths

- `mobile/src/addPhoto.ts` — types (`laid_out` / `worn`), copy, `typeOfMode`, `cameraRoute`, `photoRoute`.
- `mobile/src/components/add/PhotoTypeChooser.tsx` — type cards + source buttons; `ChangePhotoType`.
- `mobile/src/useChangePhotoType.ts` — same-URI correction via `router.replace`; records the event; First 3 Pieces' worn→laid-out adds the photo to the tray.
- Screens: `app/(tabs)/index.tsx`, `app/(tabs)/add.tsx`, `app/capture/camera.tsx`, `app/capture/preview.tsx`, `app/outfit/detect.tsx`, `app/outfit/pick.tsx`, `app/first-pieces/index.tsx`, `app/first-pieces/photos.tsx`; `src/components/home/AddToCloset.tsx` (now `AddClothesButton`), `HomeEmpty.tsx`; `src/outfit/outfit.ts` (`sceneNote` copy).
- Events: `add_photo_type_selected {type, entry: add|first_pieces}`, `add_photo_type_corrected {from, to, stage: garment_preview|outfit_detect|outfit_pick}` in `mobile/src/activity/track.ts` and `api/activity.py` (allow-list + privacy category "app use"). `capture_source` still fires once, on the actual camera shot or library pick. `path_selected` keeps `near` / `not_near`.
- Prompts: new `pipeline/prompts/stage1_detect_facts_v6.txt` and `stage4_generate_v6.txt`; `GeminiProvider` uses and logs them as `v6` for garments. `stage1_detect_facts_v5.txt`, `stage4_generate_v5.txt`, `stage4_generate_footwear_v1.txt` and `outfit_generate_footwear_v1.txt` are unchanged (byte hashes asserted in `tests/providers/test_hanging_prompts.py`); shoes still use `footwear_v1`.

No API endpoint, job, database, credit, price or config change. Scan IDs, picks and quotes are never carried across a type change; the new screen runs its own free scan and every paid action still goes through the existing confirmation.

### Deviations from the docs

- The docs list `stage4_generate_footwear_v3.txt` as possibly current; the code on `main` routes shoes to `stage4_generate_footwear_v1.txt` (approved three-quarter view; v3 "not pursued"). That routing is untouched.
- The Add hub shows the sources inline under the chosen card rather than in an action sheet (the spec allows either); tapping the chosen card again hides them.
- Detect keeps its timed hand-off to pick; the `scene_kind = flat` suggestion lives on pick (the spec's suggested minimum), plus a correction on detect's error state.
- `first-pieces/pick.tsx` (tray scan) and `capture/processing.tsx` (after a refused paid job, credits released) keep their existing "Try it as an outfit photo" hand-off unchanged.

## Automated checks (run 2026-11-05 on the owner's Mac, worktree)

| Check | Result |
|---|---|
| `PYTHONPATH=$PWD .venv/bin/pytest -q` | PASS — 756 passed, 30 skipped (integration, run separately below) |
| `cd mobile && npx jest` | PASS — 57 suites, 535 tests |
| `cd mobile && npx tsc --noEmit` | PASS |
| `npx supabase test db` (local stack) | PASS — 18 files, 213 tests |
| `pytest tests/integration` (local stack, `SUPABASE_TEST_*` from `supabase status`) | PASS — 30 passed |

Acceptance cases in 03 §B: A01–A03 `HomeScreen.test.tsx`; A04–A07 `AddScreen.test.tsx`; A08–A09 `CaptureFlow.test.tsx` (camera); A10, A12 `CaptureFlow.test.tsx` (preview) and `OutfitScreens.test.tsx` (detect timer); A11 `OutfitScreens.test.tsx`; A13 `FirstPiecesStart/Photos.test.tsx`, `firstPieces.analytics.test.tsx`; A14 existing `OutfitScreens.test.tsx`; A15 `addPhoto.test.tsx`, `tests/api/test_activity.py`, `test_v1_events.py`; A16–A17 `tests/providers/test_hanging_prompts.py`, `test_footwear_prompts.py`; A18 the full suites above. These are simulated (mocked router, camera, picker, model); they do not stand in for device or real-photo results.

## Manual iPhone QA (03 §C) — all NOT RUN

Nothing below was exercised on a device; it needs a dev build or TestFlight candidate from this branch.

| Case | Status | Case | Status |
|---|---|---|---|
| M01 empty closet guided start | NOT RUN | M11 2 shirts + shoe pair | NOT RUN |
| M02 populated Home → hub | NOT RUN | M12 worn full outfit | NOT RUN |
| M03 laid out → Take Photo | NOT RUN | M13 jacket on hanger | NOT RUN |
| M04 laid out → Library | NOT RUN | M14 dress/shirt on hanger | NOT RUN |
| M05 worn → Take Photo | NOT RUN | M15 person + laid-out garments | NOT RUN |
| M06 worn → Library | NOT RUN | M16 First 3 laid out, camera + library | NOT RUN |
| M07 flat photo chosen as worn | NOT RUN | M17 First 3 worn, camera + library | NOT RUN |
| M08 worn photo chosen as flat | NOT RUN | M18 credits on, low balance, correction | NOT RUN |
| M09 cancel picker / deny photos | NOT RUN | M19 resume/back while scanning | NOT RUN |
| M10 deny camera | NOT RUN | M20 VoiceOver + larger text | NOT RUN |

Worth extra attention on device: the camera hint now wraps to two lines on narrow phones; the Add hub's cards at the largest text sizes; the back stack after a type change (it replaces the scan screen, so Back returns to where the photo was chosen).

## Real-photo prompt evaluation (03 §D) — NOT RUN

No Gemini call was made (paid, and needs the owner's consented photos). v6 has only been checked by prompt-text and fake-provider tests, which **do not prove hanging support**. Before TestFlight, run H01–H08 on the Mac with real photos kept outside Git, e.g. a dev server on this branch and the app, recording per photo: category, boxes/grouping, selected, prompt version (`v6` in the run log), generated image fidelity (color, print, shape, no hanger drawn), retries, latency and cost. Expected risk areas: the back of a hanging garment, collars under the hanger hook, knitwear stretched by hanging, several garments on one rail.

**If hanging results are poor:** revert `DETECT_PROMPT`/`GENERATE_PROMPT` in `pipeline/providers/gemini.py` to v5 (one-line change, prompts are separate files) and drop "hanging" from `PHOTO_TYPES.laid_out.body` and the camera hint in `mobile/src/addPhoto.ts`. The UI copy "Laid out, hanging, or shoes together." is the spec's exact wording and currently promises hanging support that is unverified.

## Telemetry (03 §E) — NOT RUN

Server allow-list and client calls are covered by tests; no events were checked in the live database.

## Go / no-go

- **Merge review:** GO from the automated side — all runnable checks pass; no API, database, credit, auth or privacy contract changed.
- **TestFlight:** needs the device checks above and the hanging real-photo evaluation; not done.
