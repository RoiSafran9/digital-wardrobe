# Acceptance Criteria & QA — Unified Add Clothes

**Labels:** PASS / FAIL / BLOCKED / NOT RUN. Record actual outcomes; code review/mock tests alone do not pass iPhone/real-photo cases.

## A. Must-pass acceptance requirements

1. There is one **Add Clothes** entry point in populated Home; Home does not expose a second pair of Flat Lay/Worn cards/buttons.
2. Signed-in empty Home has one guided First 3 Pieces CTA, not a duplicate selection grid. Local-mode empty Home remains functional. Bottom Add tab remains accessible.
3. Add tab offers both photo types with clear, consistent copy. Selecting **either** offers **Take Photo** and **Choose from Library**. Worn type exists only when enabled by server.
4. Choosing from Library does **not** first open a camera screen or request camera permission. Native cancellation is harmless.
5. Camera receives a fixed type and has **no** GARMENTS/OUTFIT switch; shutter, camera permission denial and library fallback remain correct.
6. Garment flat/surface/shoes photo → existing free garment pre-scan → choose pieces → existing priced generation/Closet.
7. Worn person photo → existing free outfit scan → pick/review → existing priced generation/Closet.
8. User can correct wrong type **using the same photo** before requesting paid generation, in both directions; no stale selections, incorrect scan IDs, duplicate charge or unintended AI job.
9. First 3 Pieces guided flow remains intact: multiple flat photos, five-piece round cap, camera and library, optional worn onboarding, recoverable jobs, analytics events and saved items.
10. Hanging garment images are supported by versioned prompts and demonstrated on consented real photos; still exclude worn clothing from flat scan.
11. One pair of shoes remains **one item**, its chosen three-quarter generation prompt remains untouched, and outfit look recommendations still recognize footwear.
12. No regressions to account ownership isolation, existing credit/price confirmation, idempotency, private image access, app/navigation functionality or worker health.

## B. Automated tests — required code coverage

| Case | Scope | Expected |
|---|---|---|
| A01 | `HomeScreen.test.tsx`, nonempty | Only one Add Clothes CTA; click opens canonical Add tab |
| A02 | `HomeScreen.test.tsx`, empty signed in | Guided First3 CTA; no duplicate AddRows |
| A03 | `HomeScreen.test.tsx`, local/unsigned | Direct add action still works |
| A04 | `AddScreen.test.tsx` type A | Both source actions present; camera routes with garments mode; library goes straight to preview |
| A05 | `AddScreen.test.tsx` type B | Both source actions present; camera routes with outfit mode; library goes straight to detect |
| A06 | `AddScreen.test.tsx` outfit flag OFF | Worn option absent; no invalid navigation |
| A07 | `AddScreen.test.tsx` old `mode=outfit` link | Preselect/type/source chooser, not unexpected camera auto-push |
| A08 | `CaptureFlow.test.tsx` camera | No mode tabs; selected type respected for capture and same-type library |
| A09 | `CaptureFlow.test.tsx` permissions | Camera permission denied → library for current type; library-only never asks for camera |
| A10 | Garment preview correction | Same local URI to outfit detect; no paid generation call |
| A11 | Worn detect/pick correction | Same local URI to garment preview, no paid generation; handles flat scene |
| A12 | Correction retry / asynchronous scan | No navigation race, unmounted timers, stale preview selection or duplicate charges |
| A13 | `FirstPiecesStart/Photos` | Same language and choices; collect tray/round cap/persistence unchanged |
| A14 | `OutfitScreens.test.tsx` | Worn pick and review, credit sheet, pending results unchanged |
| A15 | `activity` + `api/activity` tests | Exact fixed-choice props for new events; invalid/private values rejected; reporting compatibility preserved |
| A16 | Prompt adapter tests | Hanging recognized as explicit target, garment prompt v6 selected/logged; footwear prompt unchanged |
| A17 | Mixed-item scanner fakes | Shoes pair still grouped as one, clothes preserved, worn garments still excluded from garment photo path |
| A18 | Regression suite | Existing jobs, credits, idempotency, auth and garment/outfit API tests still pass |

Existing tests that assert the old FLAT LAY/WORN buttons or camera mode tab should be **updated to the new UX**, not skipped/deleted to make CI pass.

Commands from repo instructions:

```bash
PYTHONPATH=$PWD .venv/bin/pytest -q
cd mobile && npx jest && npx tsc --noEmit
npx supabase test db
pytest tests/integration
```

Explain any checks unavailable because local Supabase or device environment is not configured. Update snapshots if legitimately changed, not to hide regressions.

## C. Real iPhone manual QA — perform on actual TestFlight candidate build

| Case | Input / steps | Expected |
|---|---|---|
| M01 | New account, empty closet, Home CTA | Guided start works; no confusing second set of type buttons |
| M02 | Existing account, populated Home | Single Add Clothes CTA opens hub |
| M03 | Select Clothes by themselves → Take Photo | Camera opens with laid-out hint; no mode tabs; shutter routes to garment scan |
| M04 | Same type → Photo Library | Library directly, existing image selected → garment scan, no camera prompt |
| M05 | Select Someone wearing them → Take Photo | Camera opens with worn hint; no mode tabs; shutter routes to outfit scan |
| M06 | Same type → Photo Library | Library directly, selected image → outfit scan |
| M07 | Flat photo accidentally selected as worn | Helpful explanation; change to flat with SAME photo, without charge |
| M08 | Worn photo accidentally selected as flat | Same photo offered to outfit scan; no payment before selection |
| M09 | Cancel source picker / deny photo permission | Return to type selection without lost state; appropriate error/retry |
| M10 | Deny camera permission | Library action remains available for selected type |
| M11 | Flat photo with 2 shirts and one shoe pair | Correct candidates, shoe pair once, normal selections/credits |
| M12 | Worn full-length outfit image | Correct main-person clothing, no invented objects, existing review/keep |
| M13 | Jacket on hanger | Selected via Clothes by themselves, recognized and faithfully cataloged |
| M14 | Dress/shirt on hanger | Garment-only detection, no hanger rendered in catalog, plausible cutout |
| M15 | One photo with person + separately laid garments | Clear limitation/recovery; no silent paid cross-routing |
| M16 | First 3 Pieces flat route: camera multi-shot + multi-library | Existing tray, cap, start, persistence, saved item events |
| M17 | First 3 Pieces worn route: camera + library | Existing outfit pick/review, `onboarding=1` preserved |
| M18 | Credits on, low balance, type correction | No hold until deliberate generation; price matches real selected pieces |
| M19 | App resumed/back while scanner running | No navigation loop, duplicate background scan or empty URI crash |
| M20 | VoiceOver + larger text | Cards, source options, correction and capture actions readable and tappable |

## D. Real-photo prompt evaluation

Owner-consented fixture matrix with documented path outside Git (do not commit real user photos):
- H01 clean shirt hanging on a hanger, fully visible;
- H02 jacket hanging with sleeves visible, partly folded;
- H03 dress hanging full length;
- H04 garment partially clipped, should be honest with tier/retake;
- H05 matching pair of sneakers, unchanged pair grouping/pose;
- H06 simple jeans/shirt laid flat, unchanged behavior;
- H07 person wearing a shirt, must NOT be included in laid-out scanner;
- H08 mixed clothes/shoes on surface; no extra accessories.

For each: record category, boxes/grouping, was selected, model/prompt version, generated image usability and fidelity (color, prints, shape), retries, latency and cost. Flag any untruthful hallucinated details. **Do not claim hanging support proven merely because prompt text changed.**

## E. First-five launch telemetry validation

Under authorized QA account, verify:
- `add_photo_type_selected` counts type selections with allowed source and no personal data;
- `add_photo_type_corrected` counts an actual manual correction, not AI model misclassification;
- existing `capture_source` still fires once for actual successful source use;
- `path_selected` / first 3 activation metrics continue to report, no change to `usage_report` denominators;
- first saved item and meaningful return unchanged;
- request/job tracing and Mac health probes from `docs/beta/first-five-mac` remain unaffected.

## F. Delivery / go-no-go

**GO for merge review**: all automated tests runnable locally are green, no security or credit regressions, complete code diff and real-phone manual plan supplied.  
**GO for TestFlight**: owner verifies actual signed build on device, type switching without a new photo works, hung garment photo quality is acceptable, Mac worker/tunnel healthy, pricing/flags known.  
**NO-GO**: false clothing/photo type routing causes unintended paid jobs, broken onboarding, duplicated charged items, privacy leak, or hanging support advertised without realistic examples.

Claude should report per-case PASS/FAIL/BLOCKED/NOT RUN and identify which were simulated vs physically tested.
