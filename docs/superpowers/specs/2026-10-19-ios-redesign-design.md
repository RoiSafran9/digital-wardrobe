# iOS Redesign (design handoff) — Design

Status: **Draft for owner approval** · 2026-10-19
Source: `docs/design/design_handoff_digital_wardrobe/` (README.md + `Digital Wardrobe.dc.html`, 25 journey steps / 31 states, walked in a browser on 2026-10-19).
Plan: [`docs/superpowers/plans/2026-10-19-ios-redesign.md`](../plans/2026-10-19-ios-redesign.md).

## 1. Intent

The owner commissioned a high-fidelity prototype of the whole iOS app. This redesign rebuilds every screen of `mobile/` to that prototype: new onboarding, a two-step sign-in, a starter-credits screen, a richer Home and Closet, a Garment Details sheet with Front / Back / 360° tabs, both Add flows as full-screen step-by-step flows, and a grouped Account screen with AI Credits.

**Precedence rule (from the handoff itself):** visual design follows the prototype; **where the repo's docs or API contradict the prototype on business rules (prices, credit amounts, flow steps), the repo wins.** Where the prototype conflicts with a written repo *design* commitment (DESIGN.md, PRODUCT.md "Brand Commitments"), it is not silently resolved: it is listed in §6 for the owner.

## 2. Goals, non-goals, anti-goals

**Goals**
- Every prototype screen and state exists in the app, reachable on the phone in Expo Go, in light and dark mode, honoring Reduce Motion.
- The four tabs keep working in both **account mode** and **local mode** (local mode: no onboarding sign-in, no credits UI).
- All credit numbers come from the server (`GET /v1/credits`, `GET /v1/prices`); with billing off, no credit amounts are shown (as today).
- Existing behavior survives the restyle: fidelity rules, image fallback order (cutout → white generated → crop), soft delete, idempotent jobs, `max_fronts`, outfit scan → pick → generate → keep/discard, 360 turntable swing, unsaved-edit guard.

**Non-goals** (unchanged from ROADMAP/PRD)
- Purchases, packs, payments, any purchase UI ("No purchase UI" — handoff).
- Outfit recommendations, sharing.
- The automatic welcome grant itself (TestFlight track); this redesign only *displays* whatever the server granted.
- Hosting, TestFlight build, remote push notifications.

**Anti-goals** (would make it a failure even if it "works")
- Showing a hardcoded credit amount ("25", "of 25 left") or price anywhere.
- Charging without an explicit confirmation showing the exact cost.
- Tints, filters, glows or invented details on garment images; the 360 view losing its "AI" label.
- Breaking local mode or account mode, or a new native dependency that isn't in Expo Go.

## 3. Constraints

- Expo Go only. New deps must be in Expo Go: planned `expo-camera`, `expo-blur`, `expo-linear-gradient`, `@expo-google-fonts/instrument-serif` (JS + `expo-font`, already installed) — the last only if D2 says yes. Install with `npx expo install`.
- Motion stays on React Native `Animated` + `PanResponder` (no Reanimated / Gesture Handler today; adding them is not needed).
- Server-owned prices and balances; identity only from the verified token; jobs carry `Idempotency-Key`.
- Prompt files are versioned, never edited in place; prompt changes need a manual run on a real photo.
- Checks: `cd mobile && npx jest && npx tsc --noEmit`; `PYTHONPATH=$PWD .venv/bin/pytest -q`; `npx supabase test db` for migrations.

## 4. Design system (M0)

Adopt the handoff tokens as the new `palettes` in `mobile/src/theme.ts` (pending D1), mapped to existing names so screens migrate gradually:

| Handoff | theme key | Light | Dark |
|---|---|---|---|
| bg | `background` | #FFFFFF | #000000 |
| bg2 | `grouped` (new) | #F4F4F2 | #1C1C1E |
| card / sheet | `card` | #FFFFFF | #1C1C1E |
| tile | `tile` | #F3F2EF | #1B1B1D |
| ink | `label` | #131315 | #F5F5F7 |
| ink2 | `secondaryLabel` | #6E6E73 | #98989F |
| ink3 | `tertiaryLabel` (new) | #A1A1A6 | #636366 |
| line | `separator` | rgba(20,20,25,.08) | rgba(255,255,255,.10) |
| fill | `fill` (new) | rgba(120,120,128,.12) | rgba(120,120,128,.26) |
| accent | `tint` | #1F6BFF | #3D86FF |
| accentSoft | `tintSoft` (new) | rgba(31,107,255,.10) | rgba(61,134,255,.18) |
| success | `success` (new) | #23A55A | #30C26A |
| danger | `destructive` | #E5484D | #FF5A5F |
| warning | `warning` (new) / `warningText` | #E8A33D / #C27C12 | same |

- `onTint` stays white in light; dark-mode on-tint is decided by the contrast test (white on #3D86FF is < 4.5:1 → keep black, as today, unless the test passes).
- **Contrast (my call):** `ink3` (#A1A1A6 on white ≈ 2.6:1) is used only for non-essential glyphs (inactive tab icon, placeholder, disabled), never for body text; `theme.test.ts` keeps every *text* pair ≥ 4.5:1 and adds the new pairs. If #1F6BFF on white or #E5484D fails 4.5:1 for text, the test will say so and the builder darkens the text variant by the smallest step that passes, noting it in DESIGN.md.
- Type: SF Pro everywhere via `type.*`, adding `screenTitle` (32/700), `largeTitle` tracking −0.02em, `eyebrow` (13/600 uppercase, +0.05em), `stat` (26/600 tabular), `section` (22/700). Editorial `type.display` (46/42/40) uses Instrument Serif **only if D2 = yes**, otherwise system 700 at the same sizes — one token, so the switch is one line.
- Radii: segment 8, input/search 12, button-48 14, primary-54 16, grouped list 18, garment tile 20–22, feature card 26–30, floating sheet 34.
- Shadows (pending D1): tiles `0 12 30 rgba(0,0,0,.08)`, sheets `0 -10 40 rgba(0,0,0,.12)`, cut-outs drop-shadow `0 8 10 rgba(0,0,0,.13)` — the cut-out shadow is not a tint/filter on the garment's pixels, but it is new; covered by D1.
- Shared components (new, `mobile/src/ui/`): `Button` (primary 54/16, secondary 48/14, text, destructive), `Sheet` (bottom sheet: slide 0.38s `cubic-bezier(.2,.8,.2,1)`, backdrop rgba(0,0,0,.32), tap-out dismiss, grabber, radius 34 floating or 28 top), `Toast` (top-center ink pill, 14/600, 2.6s), `Segmented`, `Chip`, `Swatch`, `GroupedList`/`Row`, `ProgressBar` (amber at ≤ 3 credits), `Shimmer`, `PopIn` (scale .9 + 8pt → 1, 0.6s, stagger .12s), `CreditPill`, `InsufficientCreditsSheet`, `CostSheet`.
- Tab bar: 84pt, translucent `rgba(250,250,250,.94)` + `BlurView` intensity ~20, hairline top, active = tint, inactive = ink3 icon / ink2 label (contrast), label 10.5/500. Tabs hidden on onboarding, camera, processing and flow screens (those are Stack routes outside `(tabs)`).
- Haptics: selection on toggles/chips/segments, success on confirms (existing `expo-haptics`).
- DESIGN.md is rewritten in M0 to record the new system (it currently says "no shadows", "#2563EB", "no custom font").

## 5. Screen map

Legend: **R** = restyle of existing code, **N** = new screen/component, **B** = needs backend/API that doesn't exist.

| # | Prototype state | Today | Type | Data / API | Repo rule applied |
|---|---|---|---|---|---|
| 01 | Welcome (collage, "Your closet, beautifully digital.") | none | N `app/welcome.tsx` | none; collage uses bundled placeholder art (no fake garments of the user) | shown once (AsyncStorage `onboarding.seen`), account mode only |
| 02 | Intro 3 pages + Skip | none | N `app/intro.tsx` | none | illustrations drawn with views/SF Symbols; no invented photos |
| 03 | Email sign-in | `sign-in.tsx` email step | R → `app/sign-in.tsx` | `AuthProvider.sendCode` | Continue disabled until valid; existing error messages kept |
| 04 | Verification code (6 boxes, auto-advance) | `sign-in.tsx` code step | R+N `app/sign-in-code.tsx` | `AuthProvider.verifyCode` | resend cooldown 60s kept; "Code expires in N min" uses Supabase `otp_expiry` → **my call:** omit the minutes (hosted value not known to the app), say "The code works for a limited time" only if needed |
| 05 | Starter credits ("A welcome gift", big number, price chips) | none | N `app/welcome-credits.tsx` | `GET /v1/credits` (`granted`, `available`), `GET /v1/prices` | **never "25"**: shows the server's available balance and server prices; shown only per D7 |
| 06 | Home dashboard | `(tabs)/index.tsx` | R (large) | `getItems`, credits | greeting per D8; credit pill hidden when billing off; marquee single row (handoff) |
| 07 | Home empty state + tips | Home empty state | R | — | tips copy from prototype (matches PRODUCT) |
| 08 | Closet grid, search, chips, color swatches | `(tabs)/closet.tsx` | R + N search/swatches | client-side filter over `getItems` | category grouping per D4; names per D3 |
| 09 | Garment Details sheet | `ItemSheet.tsx` | R (large) | existing item/back/turn APIs | info rows per D5; actions show price only when billing on |
| 10 | 360° viewer (drag, ‹ ›, angle pill) | `TurnView.tsx` | R | `getTurn` | keep turntable swing (owner preference), keep "AI view" label, add ‹ › buttons + angle pill |
| 11 | Back image empty / generating / toast | ItemSheet "+ Back", `useAddBack` | R + N states | `POST /v1/items/{id}/back` | cost shown → confirm → job → toast "Back image ready" (+ "· 1 credit used" from job `cost_credits`, never hardcoded) |
| — | 360 empty / generating | ItemSheet "View in 360" | R | `POST …/turn` | ask-first confirm kept (CostSheet) |
| — | Edit sheet (Name, Category, Pattern) + "Changes saved" toast | `ItemEditForm.tsx` (category, colors, pattern, details, text) | R | `PATCH /v1/items/{id}` (+ `name` per D3 → **B**) | keep colors/details/text fields (owner control principle) below the prototype's fields |
| — | Remove confirmation sheet | native `Alert` | R → `Sheet` | `DELETE` (soft) | copy "Credits used for its images are not returned" only when billing on |
| 12 | Add Clothes chooser (2 cards, balance footer, first-piece hint) | `(tabs)/add.tsx` segmented mode switch | R (large) | prices/credits, `outfit` flag | Outfit card shown only when server says `outfit: true` |
| 13 | Camera (dark, brackets, GARMENTS/OUTFIT, library thumb) | system camera via `expo-image-picker` | N `app/capture/camera.tsx` per D9 | — | — |
| 14 | Preview & cost ("3 garments found", badges) | `FrontsPicker` before the photo | R per **D6** | `max_fronts` on `POST /v1/jobs` | repo rule: user approves *max* fronts; no free pre-detection unless D6 = b (**B**) |
| 15 | AI processing (blur→sharp card, checklist, n of N) | `ProcessingStatus` (timed stages) | N `app/capture/processing.tsx` | job polling (`POLL_MS`) | stages advance on real job status where known, timed otherwise; "n of N" per D11 (**B**) ; footer copy per D10 |
| 16 | Error & retry ("Credits for unfinished items were returned") | inline error | N state | job `failed` | copy only when billing on; true per M2 (failed job releases hold) |
| 17 | Results (deselect, "Add N to Closet") | `JustAdded` on Home | N `app/capture/results.tsx` per **D12** | items from the job; `DELETE` for deselected | tier + retake/edge tips shown per item (PRD 13–14) |
| 18 | Outfit: choose photo grid | library picker | R per D9 | — | — |
| 19 | Detecting (scan band, boxes pop in, "Detection is free") | `useOutfitScan` + spinner | N visuals | `POST/GET /v1/outfit-scans` (already returns `box`; add `box` to `OutfitCandidate` type) | boxes shown when the scan returns (staggered pop-in), not faked mid-scan |
| 20 | Select & correct (boxes on photo, rows, low-confidence unselected, Edit, "+ Mark a missed garment") | `app/outfit/pick.tsx` | R | scan candidates | **repo wins:** shoes not offered (D2 of outfit spec), mostly-hidden start unselected (D3); Edit/Mark-missed per **D13** |
| 21 | Confirm cost sheet | inline footer quote | N `CostSheet` | `expected_unit_price` | "Detection was free"; 409 price-changed handled |
| 22 | Review vs original (crop | generated, Keep switch, Regenerate) | `app/outfit/review.tsx` | R | `keep` / `DELETE` | Regenerate per **D14** |
| 23 | Saved (fan of tiles, "Added to your closet") | none | N `app/capture/saved.tsx` (shared by both flows) | — | "N credits used" from job `cost_credits`; hidden when billing off |
| 24 | Account (profile, credits card, how-it-works, price list, activity, settings, sign out, delete) | `(tabs)/account.tsx` + `CreditsCard` + `CreditsSheet` | R + N | `/v1/credits`, `/v1/prices` | denominator = server `granted` ("of N granted", never a fixed number); settings per D15–D17 |
| 25 | Insufficient credits sheet | inline "Not enough AI credits" | N `InsufficientCreditsSheet` | credits/prices | **no purchase UI**; body adds "Ask the app owner for more credits." (existing copy) |

## 6. Owner decisions (open — most important first)

Each has my recommendation; the plan builds the recommendation unless told otherwise, and each decision is isolated to one milestone.

- **D1 · Adopt the handoff's visual system over DESIGN.md?** The handoff changes the tint (#2563EB → #1F6BFF), makes screens white with warm-grey grouped cards (DESIGN: grey background, white cards), adds soft shadows (DESIGN: "no shadows"), larger radii and a single-row marquee (DESIGN: two rows). *Recommend: yes, adopt and rewrite DESIGN.md in M0* — the owner commissioned the handoff and it says visual design follows it.
- **D2 · Instrument Serif for the four editorial headlines** (Welcome 46, Home greeting 42, "A welcome gift" / "Added to your closet" 40)? PRODUCT.md "Brand Commitments" says system font, native category standard. *No recommendation either way — owner's brand call.* Built behind one `type.display` token so either answer is a one-line change.
- **D3 · Garment names** ("Oxford Shirt"). Items have only a category word today; the prototype shows names everywhere and edits a Name. Options: (a) app derives a name from color + category ("Cream sweater"), no backend; (b) (a) now, plus an editable `name` stored in `facts` (PATCH accepts `name`, no migration, no prompt change); (c) (b) plus the detect prompt also proposes a short name (new prompt versions, same single call, needs a real-photo run). *Recommend (b).*
- **D4 · Category groups.** Prototype chips are broad groups (Tops, Outerwear, Bottoms, Dresses, Shoes, Bags); the model writes free words ("t-shirt"). ROADMAP "Later" lists a fixed category list as undecided. *Recommend:* a client-side map from the model's word to a group for chips, Home "Browse by category" and stats; the specific word stays on the item ("Tops · T-shirt"); unknown words fall into "Other". Edit sheet keeps free-text category plus group chips as shortcuts.
- **D5 · Material row.** The prototype shows Material ("Merino wool"); nothing extracts it, and guessing fabric from a photo risks stating an invention as fact. *Recommend: no Material row;* show Color, Pattern, Details, Printed text (existing facts).
- **D6 · Garment-photo preview: detect first, or approve a max first?** The prototype detects pieces (free) and then quotes "Generate 3 Items · 3 credits". The owner's approved rule (CREDITS §6) is "approve a max number of fronts before the photo, charge only what's created". *Recommend: keep the approved rule now* — Preview shows the photo + "Pieces in this photo" stepper + cost card ("Up to N front images · N credits · balance after"), no numbered badges. Option b (later, backend): a free garment scan that the generate step reuses (no extra model call), which would allow the prototype's exact screen.
- **D7 · Starter-credits screen.** No automatic welcome grant exists yet. *Recommend:* show the screen once after first sign-in only when the server reports `granted > 0` and billing is on, with the server's real balance and prices; otherwise skip straight to Home (or the Add tab's first-piece hint).
- **D8 · Name in greeting / profile.** No display name is stored. *Recommend:* "Good morning" with no name, avatar initials from the email; adding a profile name is a separate small feature (column + edit field).
- **D9 · Custom camera.** The prototype has a full-screen dark camera with a GARMENTS/OUTFIT switch and an in-app photo grid with "Full body" badges. *Recommend:* custom camera with `expo-camera` (in Expo Go) for capture; the system photo picker (not an in-app grid via `expo-media-library`) for library picks — keeps "limited photo access" privacy and avoids a fake "Full body" classifier.
- **D10 · "We'll notify you when your pieces are ready" + "Notify when ready" switch.** Real notifications need server push (APNs) and a hosted server; not workable in Expo Go on the LAN. *Recommend:* copy "You can leave this screen — your pieces will appear in your closet." (true today: the job runs on the server) and no switch until TestFlight.
- **D11 · Real per-item progress ("1 of 3").** Jobs report only status. *Recommend:* small backend addition — the worker writes `progress {done, total}` on the job row as items finish (no model calls; one migration + pgTAP); until then the card shows timed stages without "n of N".
- **D12 · Results step for garment photos.** Today items go straight to the closet and fronts are charged when created. The prototype lets you deselect before "Add N to Closet". *Recommend:* keep items saved; Results shows each created piece (with tier/tips) and deselecting removes it on "Add N to Closet" (soft delete), with "Credits for removed pieces are not returned" when billing on. Alternative: put garment results in the outfit flow's `pending` review state (backend change).
- **D13 · Outfit "Edit" before generating and "+ Mark a missed garment".** The outfit spec lists both as "not in v1". *Recommend:* "Not a garment" = remove the box from the pick list (client only); hide Edit-before-generate and Mark-missed for now.
- **D14 · "↻ Regenerate · 1 credit" in outfit review.** Not built; whether regenerations are charged is an open CREDITS question. *Recommend: hide* until that policy is set.
- **D15 · Delete Account.** No backend exists; it's an App Store requirement and on the TestFlight list. *Recommend:* build it as the last milestone (M8, backend + sheet) — or leave it to the TestFlight track and hide the row.
- **D16 · Appearance setting.** DESIGN says dark follows the system; prototype has Light/Dark. *Recommend:* System / Light / Dark (default System) via `Appearance.setColorScheme`, persisted locally.
- **D17 · Help & Support, Privacy rows.** No URLs exist. *Recommend:* hide until the owner gives a support email and privacy page.
- **D18 · Delivery workflow.** Owner's default is commits straight to `main`. *Recommend for this redesign:* one branch + PR per milestone (`feat/redesign-mN`), merged in order, so each can be checked on the phone and reverted on its own.

## 7. Backend / API gaps

| Gap | For | Size | Decision |
|---|---|---|---|
| `name` in item facts, editable via PATCH (local + `/v1`) | Names everywhere, Edit sheet | small (no migration) | D3 |
| Job `progress {done,total}` written by the worker | "n of N" on processing | small (migration + worker + pgTAP) | D11 |
| `DELETE /v1/account` (auth user + rows + Storage) | Delete Account | medium | D15 |
| Free garment scan reused by generate | Prototype Preview with badges | large | D6 (b, later) |
| Outfit candidate corrections / manual regions / regenerate | Outfit Edit, Mark missed, Regenerate | large | D13, D14 (later) |
| Display name on `profiles` | Greeting, profile card | small (migration) | D8 (later) |
| Push notifications | Notify when ready | large (hosting/APNs) | D10 (later) |

No backend is needed for: onboarding, sign-in, starter screen (reads existing endpoints), Home, Closet search/filters, details sheet, cost/insufficient sheets, Account credits, appearance.

## 8. Behavior notes the prototype doesn't state

- Billing off: every price, balance, "· 1 credit", cost card and "credits used" disappears; buttons read "Generate" / "Add Back Image"; the Account credits card shows the existing "Billing is off" note.
- Local mode: no welcome/intro/sign-in/starter screens; Account shows the local-mode row; Outfit card hidden.
- `402` from the server at any start opens the Insufficient Credits sheet (the server is the authority even if the app's quote said affordable).
- Outfit `409` (price changed) re-fetches prices and re-opens the Cost sheet with the new total.
- Leaving the processing screen: the job keeps running; Home shows a small "Creating N pieces…" row that opens the processing screen again (replaces today's Just added card for in-flight work; finished work opens Results).
- Pending outfit results still resume after restart ("N pieces waiting for review").
- Reduce Motion: marquee still, pop-ins become fades, scan band static, shimmer off, number count-up off.

## 9. Testing

- Jest + Testing Library per screen and per shared component (existing `__tests__/` pattern, `jest.setup.js` mocks); `tsc --noEmit`.
- `theme.test.ts` extended to every new text/background pair, both palettes.
- pytest for each backend addition (local + `/v1`, two users), pgTAP for any migration.
- Manual on the owner's iPhone per milestone: light + dark, Reduce Motion, account mode with billing on (owner's server runs `WARDROBE_BILLING=on`, prices 1/1/3) and local mode.
