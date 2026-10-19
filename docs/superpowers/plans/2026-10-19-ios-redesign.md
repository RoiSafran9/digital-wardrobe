# iOS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every screen of the Expo app in `mobile/` to the design handoff (onboarding, sign-in, starter credits, Home, Closet, Garment Details, both Add flows, Account, credit sheets) without changing approved business rules.

**Architecture:** A new design-system layer (`mobile/src/theme.ts` tokens + `mobile/src/ui/` components) lands first; each later milestone restyles or adds one area on top of it, reusing the existing API clients (`src/api/client.ts`, `src/api/v1.ts`), `AuthProvider`, `CreditsProvider` and hooks (`useAddBack`, `useTurn`, `useOutfitScan`). Flow screens become Stack routes outside `(tabs)` so the tab bar hides. Backend changes are small and isolated (item `name`, job `progress`, account deletion).

**Tech Stack:** Expo SDK 57 / Expo Router / React Native 0.86 `Animated` + `PanResponder`, TypeScript, Jest + Testing Library; FastAPI + pytest; Supabase migrations + pgTAP.

**Spec:** [`docs/superpowers/specs/2026-10-19-ios-redesign-design.md`](../specs/2026-10-19-ios-redesign-design.md) — read it first; decision IDs (D1–D18) below refer to its §6. Visual reference: `docs/design/design_handoff_digital_wardrobe/README.md` and `Digital Wardrobe.dc.html` (serve the folder with `python3 -m http.server` and open it; the sidebar jumps to each state).

## Global Constraints

- Expo Go only. New deps limited to `expo-camera`, `expo-blur`, `expo-linear-gradient`, and `@expo-google-fonts/instrument-serif` (only if D2 = yes), each added with `npx expo install <pkg>`.
- Every color from `colors.*`, every text style from `type.*`; no raw `fontSize` outside `theme.ts`. Every new text pair passes 4.5:1 in both palettes (`__tests__/theme.test.ts`).
- No hardcoded credit amounts or prices. Prices from `useCredits().prices`, balance from `useCredits().credits`. With `billing === false` no amount, balance or "credits used" text renders.
- Never start a paid action without a confirmation that shows its exact cost (billing on). Detection is free. No purchase UI anywhere; out of credits says "Ask the app owner for more credits." (`ASK_FOR_MORE`).
- Garment images: cutout → white generated → crop (`GarmentImage`); no tint, filter or glow on garment pixels; 360 stays labelled as AI.
- Local mode (no Supabase settings) keeps working: no onboarding, no sign-in, no credits UI, no Outfit card.
- Reduce Motion (`useReducedMotion`): no translate, drift, scan band, shimmer or count-up; short fades stay.
- Every tappable ≥ 44pt (`hitSlopFor`), every state control has `accessibilityRole` + `accessibilityState`.
- Copy is English and taken from the handoff unless the spec's §5 says otherwise.
- Workflow (D18 recommendation): branch `feat/redesign-mN` per milestone off latest `main`, PR, owner phone check, merge in order. Commits end with the Co-Authored-By line.
- After each milestone: `cd mobile && npx jest && npx tsc --noEmit`; backend milestones also `PYTHONPATH=$PWD .venv/bin/pytest -q` (and `npx supabase test db` for migrations). Update `docs/SCREENS.md` (and `docs/PRD.md` / `docs/ARCHITECTURE.md` when behavior or API changes) in the same PR.

## Review Focus

1. **Billing off / local mode** — every screen that shows a price or balance must render cleanly with `billing: false` and `credits: null` (no "undefined credits", no "0 credits"). Pinned in Tasks 0.3, 1.3, 3.1, 4.2, 5.2, 6.3, 7.1.
2. **Server says 402 despite the app's quote** (balance changed on another device) — must open the Insufficient Credits sheet, not a raw error. Pinned in Tasks 4.3, 5.2, 6.3.
3. **Leaving the processing screen mid-job and coming back / app restart** — work keeps running on the server and lands in the closet; Home shows the in-flight row; pending outfit results still resume. Pinned in Tasks 5.1, 5.3, 6.4.
4. **Long / missing data** — long category words, no colors, no name, unknown category → group "Other", 0 items, 1 item, 200 items in the closet grid and search. Pinned in Tasks 2.2, 3.2.
5. **Dark mode + Reduce Motion** — every new color has a dark pair; marquee, scan band, shimmer and pop-ins stop moving. Pinned in Tasks 0.1, 0.2, 3.1, 6.2.

---

## M0 — Design foundation (`feat/redesign-m0`)

### Task 0.1: Tokens and type scale

**Files:**
- Modify: `mobile/src/theme.ts`
- Test: `mobile/__tests__/theme.test.ts`

**Interfaces:**
- Produces: `colors` keys `background, grouped, card, tile, label, secondaryLabel, tertiaryLabel, separator, fill, tint, tintSoft, onTint, success, destructive, destructiveBg, warning, warningText, tabBar` (all light/dark via `DynamicColorIOS`); `type` adds `screenTitle {32,700}`, `section {22,700}`, `eyebrow {13,600,uppercase,letterSpacing 0.65}`, `stat {26,600,tabular-nums}`, `display(size: 46|42|40)`; `radius` = `{segment:8, input:12, button:14, primary:16, list:18, tile:22, feature:26, stage:28, sheet:34, pill:999}`; `shadow.tile`, `shadow.sheet`, `shadow.cutout` (iOS `shadowColor/Offset/Opacity/Radius` objects).

- [ ] **Step 1: Write failing tests** — extend the pair list in `theme.test.ts` with `label/grouped`, `secondaryLabel/grouped`, `secondaryLabel/card`, `tint/background`, `tint/grouped`, `onTint/tint`, `destructive/card`, `warningText/card`, `success/card` for both palettes, each `expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)`; add `test("tertiaryLabel is never used as text")` that greps `mobile/app` and `mobile/src` for `color: colors.tertiaryLabel` inside a `<Text` style and expects 0 hits (helper reads files with `fs`).
- [ ] **Step 2: Run** `cd mobile && npx jest __tests__/theme.test.ts` — Expected: FAIL (missing keys).
- [ ] **Step 3: Implement** — palettes from spec §4 table (keep existing key names; add new ones). Where a handoff value fails 4.5:1 as text, darken (light) / lighten (dark) in steps of 2% lightness until it passes and record the shipped value in a comment. `type.display` returns `{ fontFamily: DISPLAY_FONT, fontSize, lineHeight: size * 1.0 }` where `DISPLAY_FONT` is `"InstrumentSerif_400Regular"` if D2 = yes, else `undefined` with `fontWeight: "700"`.
- [ ] **Step 4: Run** the test — Expected: PASS. Run the full `npx jest` — fix any snapshot/color test that referenced old values.
- [ ] **Step 5: Commit** `feat(theme): handoff tokens, type scale, radii and shadows`.

### Task 0.2: Shared UI kit

**Files:**
- Create: `mobile/src/ui/Button.tsx`, `Sheet.tsx`, `Toast.tsx`, `Segmented.tsx`, `Chip.tsx`, `Swatch.tsx`, `GroupedList.tsx`, `ProgressBar.tsx`, `Shimmer.tsx`, `index.ts`
- Create: `mobile/src/motion/PopIn.tsx`
- Modify: `mobile/app/_layout.tsx` (mount `ToastProvider`)
- Test: `mobile/__tests__/ui.test.tsx`

**Interfaces:**
- Produces:
  - `Button({ title, onPress, variant: "primary"|"secondary"|"text"|"destructive", size?: "large"|"medium", icon?: IconName, disabled?, loading? })` — large = 54pt/radius 16, medium = 48pt/radius 14, disabled opacity 0.4, wraps `PressScale`.
  - `Sheet({ visible, onClose, title?, floating?: boolean, children })` — `Modal transparent`, backdrop `rgba(0,0,0,.32)` tap-to-close, slide-up 380ms `Easing.bezier(.2,.8,.2,1)`, grabber, radius 34 floating / 28 top.
  - `ToastProvider` + `useToast(): { show(message: string): void }` — top-center ink pill, 2.6s, fade in/out.
  - `Segmented<T extends string>({ options: {value:T,label:string}[], value: T, onChange(v:T) })` — haptic selection on change.
  - `Chip({ label, count?, selected?, onPress, variant?: "filled"|"outlined" })`; `Swatch({ color, selected, onPress, size=28 })` (double ring when selected).
  - `GroupedList({ header?, children })`, `Row({ label, value?, accessory?: "chevron"|ReactNode, onPress?, destructive? })`.
  - `ProgressBar({ value: 0..1, warning?: boolean, height?: number })`; `Shimmer({ active })`; `PopIn({ delay?, children })`.
- [ ] **Step 1: Write failing tests** in `ui.test.tsx`: `Button disabled does not call onPress`; `Sheet calls onClose on backdrop press` (`accessibilityLabel="Close"` on backdrop); `useToast().show renders the message then removes it after 2600ms` (fake timers); `Segmented marks the selected option accessibilityState.selected`; `Swatch toggles selected state`; `PopIn renders children immediately under Reduce Motion` (mock `useReducedMotion` → true).
- [ ] **Step 2: Run** `npx jest __tests__/ui.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the components with the interfaces above; reuse `PressScale`, `haptics`, `useReducedMotion`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(ui): shared buttons, sheet, toast, segmented, chips, lists`.

### Task 0.3: Credit sheets and pill

**Files:**
- Create: `mobile/src/ui/CreditPill.tsx`, `mobile/src/ui/CostSheet.tsx`, `mobile/src/ui/InsufficientCreditsSheet.tsx`
- Modify: `mobile/src/credits/credits.ts` (add `quote()`)
- Test: `mobile/__tests__/creditSheets.test.tsx`, `mobile/__tests__/credits.test.ts`

**Interfaces:**
- Consumes: `useCredits()`, `creditsLabel`, `ASK_FOR_MORE`.
- Produces:
  - `quote(lines: {label: string; action: CreditAction; count: number}[], prices, available: number | null): { lines: {label, credits}[]; total: number; after: number | null; affordable: boolean }`.
  - `CreditPill({ onPress })` — renders `null` unless `billing && credits`; shows `credits.available`.
  - `CostSheet({ visible, title, subtitle?, lines, note?, confirmLabel, onConfirm, onClose })` — "Total", "Balance X → Y", note (e.g. "Detection was free"); confirm label already includes "· N credits" from the caller.
  - `InsufficientCreditsSheet({ visible, needed, onAdjust?, onClose, body? })` — big "available / needed credits needed", amber bar, "Not enough credits", body + `ASK_FOR_MORE`, primary "Adjust Selection" if `onAdjust` else "OK", secondary "View Price List" → `router.push("/account")`.
- [ ] **Step 1: Write failing tests**: `quote([{label:"Front image", action:"garment", count:4}], {garment:1}, 18)` → `{total:4, after:14, affordable:true}`; with available 2 → `affordable:false`; `CreditPill renders nothing when billing is off`; `CostSheet shows "Balance 18 → 14"`; `InsufficientCreditsSheet shows "2" and "/ 4 credits needed" and no "Buy"`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(credits): cost and insufficient-credit sheets, balance pill`.

### Task 0.4: Tab bar and DESIGN.md

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`, `mobile/src/components/Icon.tsx` (add `plusCircle`, `sparkles`, `search`, `chevronLeft`, `person`, `gear`)
- Modify: `DESIGN.md` (rewrite to the new system; record any contrast-driven value changes), `PRODUCT.md` Brand Commitments (one line pointing at the handoff, per D1/D2)
- Test: `mobile/__tests__/RootNavigator.test.tsx` (existing, keep green)

- [ ] **Step 1:** `npx expo install expo-blur`.
- [ ] **Step 2: Implement** tab bar: height 84, `tabBarBackground` = `BlurView intensity={20}` over `colors.tabBar`, hairline `separator` top border, active `tint`, inactive icon `tertiaryLabel` / label `secondaryLabel` 10.5/500. Add tab icon is the handoff's accent "+" circle.
- [ ] **Step 3: Run** `npx jest && npx tsc --noEmit` — PASS.
- [ ] **Step 4: Commit** `feat(nav): translucent tab bar; docs: DESIGN.md for the handoff system`.

---

## M1 — Onboarding and sign-in (`feat/redesign-m1`)

### Task 1.1: Onboarding state and routing

**Files:**
- Create: `mobile/src/onboarding.ts`
- Modify: `mobile/src/RootNavigator.tsx`
- Test: `mobile/__tests__/RootNavigator.test.tsx`

**Interfaces:**
- Produces: `useOnboarding(): { seen: boolean | null; markSeen(): Promise<void>; starterShown: boolean | null; markStarterShown(): Promise<void> }` — AsyncStorage keys `onboarding.seen`, `onboarding.starter.<userId>`.
- Routes (signed out, account mode): `welcome` → `intro` → `sign-in` → `sign-in-code`; once `seen`, signed-out lands on `sign-in` with Back to `welcome`. Signed in: `(tabs)`, plus `welcome-credits` before `(tabs)` when Task 1.3's rule says so. Local mode never sees these.
- [ ] **Step 1: Failing tests**: `signed out, first launch shows Welcome`; `signed out after onboarding shows Sign in`; `local mode skips onboarding and shows Home`.
- [ ] **Step 2–4:** run (FAIL) → implement guards with `Stack.Protected` → run (PASS).
- [ ] **Step 5: Commit** `feat(onboarding): first-launch routing`.

### Task 1.2: Welcome, Intro, Email, Code screens

**Files:**
- Create: `mobile/app/welcome.tsx`, `mobile/app/intro.tsx`, `mobile/app/sign-in-code.tsx`, `mobile/src/components/CodeBoxes.tsx`
- Modify: `mobile/app/sign-in.tsx` (email step only; code step moves out)
- Test: `mobile/__tests__/SignInScreen.test.tsx`, `mobile/__tests__/Onboarding.test.tsx`

**Interfaces:**
- Consumes: `useAuth().sendCode(email)`, `verifyCode(email, code)`; existing messages in `src/auth/messages.ts`.
- Produces: `CodeBoxes({ value, onChange, error?, complete? })` — one hidden `TextInput` (`keyboardType="number-pad"`, `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, `maxLength=6`) under 6 visual boxes (62pt, radius 14, gap 8); current box `tint` border; all `success` when 6 digits.
- Welcome: 5 rotated tiles (−10°…+6°, `PopIn` stagger 0.05–0.45s) drawn from bundled neutral silhouettes (SF Symbol `tshirt`, etc. on `tile`), title "Your closet,\nbeautifully digital." (`type.display(46)`), body, "Get Started" → `intro`, "I already have an account" → `sign-in` (both `markSeen`).
- Intro: horizontal paging `ScrollView`, 3 pages (titles "Snap any garment" · "Or import an outfit" · "Browse what you own", body copy from prototype), dots (active 22×7 pill), "Next"/"Continue", "Skip" top-right → `sign-in`.
- Email: "Sign in with email", subtitle, 56pt input, Continue disabled (0.4) until `/^\S+@\S+\.\S+$/`, Terms footnote (plain text, no links per D17), → `sign-in-code?email=`.
- Code: "Check your inbox", "Enter the code we sent to {email}", `CodeBoxes`, verify 600ms after 6 digits, "Resend code" with existing 60s cooldown, Back → email.
- [ ] **Step 1: Failing tests**: `Continue is disabled until the email is valid`; `entering 6 digits calls verifyCode after 600ms` (fake timers); `wrong code shows the existing message and clears the boxes`; `Resend is disabled for 60s`; `Skip on Intro opens Sign in`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(auth): handoff welcome, intro, email and code screens`.

### Task 1.3: Starter-credits screen (D7)

**Files:**
- Create: `mobile/app/welcome-credits.tsx`
- Test: `mobile/__tests__/WelcomeCredits.test.tsx`

- Shown once per user (`markStarterShown`) after sign-in when `billing && credits && credits.granted > 0`; otherwise never. 168pt `tintSoft` circle with `credits.available` (64/700 tint) + "AI credits"; "A welcome gift" (`type.display(40)`); body "Credits are only used when AI creates an image, and you'll always see the cost first."; price chips built from `prices` (`Front · {garment}`, `Back · {back}`, `360° · {turn}`, only those present); "Digitize Your First Piece" → `/(tabs)/add?firstPiece=1`; "Explore first" → `/(tabs)`.
- [ ] **Step 1: Failing tests**: `shows the server's available balance, not a fixed number` (credits.available 37 → "37"); `not shown when billing is off`; `not shown when granted is 0`; `price chips come from the server prices`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(credits): starter-credits screen from server balance`. Update `docs/SCREENS.md` §0 and open the M1 PR.

---

## M2 — Item names and category groups (`feat/redesign-m2`, small backend; D3 = b, D4)

### Task 2.1: Editable `name` (backend)

**Files:**
- Modify: `pipeline/types.py` (`ItemFacts.name: FactField | None = None`), `api/schemas.py` (`ItemPatch.name: str | None = None`), `api/facts_edit.py`
- Test: `tests/api/test_item_edits.py`, `tests/api/test_v1_items.py`

- `patch_error`: name, when given, is 1–60 chars after strip. `apply_patch`: sets `name` as `FactField(value=name, confidence=1.0, basis="observed")`. No prompt change, no migration (facts is JSON).
- [ ] **Step 1: Failing tests**: `test_patch_name_local` (PATCH `{"name": "Oxford shirt"}` → item facts.name.value == "Oxford shirt"); `test_patch_name_v1_other_user_404`; `test_patch_name_too_long_400` (61 chars); `test_old_items_without_name_still_load`.
- [ ] **Step 2:** `PYTHONPATH=$PWD .venv/bin/pytest -q tests/api/test_item_edits.py tests/api/test_v1_items.py` — FAIL. **Step 3:** implement. **Step 4:** PASS (full pytest too).
- [ ] **Step 5: Commit** `feat(api): editable item name`.

### Task 2.2: App naming and grouping helpers

**Files:**
- Create: `mobile/src/garmentName.ts`, `mobile/src/categoryGroups.ts`
- Modify: `mobile/src/api/types.ts` (`ItemFacts.name?: FactField`, `ItemPatch.name?: string`), `mobile/src/closetStats.ts` (group counts + `addedThisWeek` kept)
- Test: `mobile/__tests__/garmentName.test.ts`, `mobile/__tests__/categoryGroups.test.ts`, `mobile/__tests__/closetStats.test.ts`

**Interfaces:**
- Produces: `garmentName(item): string` — `facts.name` if set, else `"{First color} {category}"` capitalized once ("Cream sweater"), else category, else "Garment". `CATEGORY_GROUPS = ["Tops","Outerwear","Bottoms","Dresses","Shoes","Bags","Accessories","Other"]`; `groupOf(item): string` via a lowercase keyword map (t-shirt, shirt, blouse, sweater, hoodie, tank, top, polo → Tops; jacket, coat, blazer, cardigan, vest, parka → Outerwear; jeans, pants, trousers, shorts, skirt, leggings, chinos → Bottoms; dress, jumpsuit → Dresses; sneakers, boots, shoes, sandals, loafers → Shoes; bag, tote, backpack → Bags; belt, scarf, hat, cap → Accessories; else Other). `closetStats` returns `groups: {name,count}[]` (only non-zero, in `CATEGORY_GROUPS` order).
- [ ] **Step 1: Failing tests**: `garmentName uses facts.name`; `falls back to color + category` ("cream","sweater" → "Cream sweater"); `no colors → "Sweater"`; `groupOf("Denim jacket") === "Outerwear"`; `unknown "kimono" → "Other"`; `groups skip empty groups and keep order`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(app): garment names and category groups`. PR M2.

---

## M3 — Home and Closet (`feat/redesign-m3`)

### Task 3.1: Home

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`, `mobile/src/motion/Marquee.tsx` (single row, 118×148 tiles radius 20, alternating 10pt offset, ~4s per item, pauses on touch, still under Reduce Motion)
- Create: `mobile/src/components/home/{Greeting,StatsRow,DigitizeCard,RecentlyAdded,CategoryPills,HomeEmpty}.tsx`
- Remove from Home: `JustAdded` (moves to the flow Results in M5; keep the file until M5 lands)
- Test: `mobile/__tests__/HomeScreen.test.tsx`

- Greeting: eyebrow date (`toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})` uppercased), "Good morning/afternoon/evening" (5–12/12–18/else) per D8 without name, `type.display(42)`; `CreditPill` → Account.
- Stats: Pieces / Categories (group count) / New this week (`addedThisWeek`), 26/600 tabular, hairline separators, `CountUp`.
- DigitizeCard: `grouped` card radius 26, "Take Photo" (primary medium) → `/capture/camera`, "From Library" (white) → library pick then `/capture/preview`; secondary link "Wearing it? Add from an outfit photo" only when `outfit`.
- RecentlyAdded: 150×188 cards, `garmentName`, "Added Oct 18", "See All" → Closet. CategoryPills: outlined pills with counts → `/(tabs)/closet?group=`.
- Empty: three dashed 78×98 frames (middle tint "+"), "Your closet starts here", two buttons, "TIPS FOR GREAT RESULTS" 1–3 (copy from prototype).
- In-flight row (from M5's `useCaptureJobs`): placeholder slot rendered only when the hook exists; wired in Task 5.1.
- [ ] **Step 1: Failing tests**: `shows greeting and stats with group count`; `credit pill hidden when billing off`; `category pill opens Closet with group`; `empty closet shows tips`; `marquee does not animate under Reduce Motion`; `outfit link hidden when outfit is off`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(home): handoff Home`.

### Task 3.2: Closet

**Files:**
- Modify: `mobile/app/(tabs)/closet.tsx`
- Create: `mobile/src/closetFilter.ts`, `mobile/src/components/closet/{SearchField,GroupChips,ColorSwatches,ClosetTile}.tsx`
- Test: `mobile/__tests__/closetFilter.test.ts`, `mobile/__tests__/ClosetScreen.test.tsx`

**Interfaces:**
- Produces: `filterCloset(items, { group: string | "All"; color: string | "All"; query: string }): ClosetItem[]` — query matches (case-insensitive, trimmed) `garmentName`, category, group, colors, pattern, trims, visible_text; `colorsPresent(items): string[]`.
- Large title "Closet" + "N pieces"; search 40pt radius 12 `fill`; group chips (All + present groups, selected = `label` bg / inverted text); 28pt swatches (selected double ring; tapping selected clears); 2-col grid gap 18/12, tile 4:5 radius 22 `tile` bg, "360°" badge when `turn.state === "done"`, name 15/600, "Group · Color" 13; PressScale .97; empty → "Add Clothes", no-match → "Clear Filters"; pull to refresh kept; accepts `group` param (and legacy `category` param mapped via `groupOf`).
- [ ] **Step 1: Failing tests**: `query "cream" matches by color`; `query matches visible text`; `group + color combine`; `tapping the selected swatch clears it`; `no match shows Clear Filters and it resets`; `opens pre-filtered from the group param`; `200 items render without error`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(closet): search, groups, color swatches, handoff grid`. Update SCREENS §1–2, PR M3.

---

## M4 — Garment Details sheet (`feat/redesign-m4`)

### Task 4.1: Sheet layout, info and views

**Files:**
- Modify: `mobile/src/components/ItemSheet.tsx` (split), `mobile/src/components/TurnView.tsx` (‹ › buttons, angle pill "Front/Left/Back/Right", "Drag to rotate" hint, keep swing animation and "AI view" label)
- Create: `mobile/src/components/item/{ItemHeader,ImageStage,ViewTabs,BackEmpty,TurnEmpty,Generating,ItemInfo,ItemActions}.tsx`
- Test: `mobile/__tests__/ItemSheet.test.tsx`, `mobile/__tests__/TurnView.test.tsx`

- Keep native `pageSheet` + horizontal paging between items. Header: × (32pt `fill` circle) and "Edit" (tint text). Image stage 372pt radius 28 `tile`. `Segmented` Front / Back / 360° always shown.
- Back none: dashed inset frame, "No back image yet", "Take a photo of the back and we'll create a matching catalog image.", button "Add Back Image" + (billing on) " · {prices.back} credit(s)".
- 360 none: 4 fading angle thumbs (front image at decreasing opacity), "See it from every angle", "Generate 360°" + price.
- Generating: `Shimmer` + spinner + "Creating back image…" / "Creating four angles…" (from `useAddBack` busy / `useTurn` running).
- Title `garmentName` 28/700, "{Group} · Added {date}"; info `GroupedList`: Color (swatch + name), Pattern, Details (trims), Printed text (if any) — no Material (D5).
- Actions list: Add Back Image (price), Generate 360° View (price), Remove from Closet (destructive).
- [ ] **Step 1: Failing tests**: `Back tab without a back shows "No back image yet"`; `price suffix hidden when billing off`; `360 running shows "Creating four angles…"`; `TurnView › button advances Front → Right` (and pill text); `no Material row`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(item): handoff details sheet with Front/Back/360 tabs`.

### Task 4.2: Paid actions with confirmation and toasts

**Files:**
- Modify: `mobile/src/useAddBack.ts`, `mobile/src/useTurn.ts` (expose `costCredits` from the finished job when present)
- Test: `mobile/__tests__/ItemBack.test.tsx`, `mobile/__tests__/ItemTurn.test.tsx`

- Billing on: Add Back → `CostSheet` ("Add a back image", line "Back image × 1", confirm "Continue · N credit(s)") → photo source → job → toast "✓ Back image ready" + (billing on) " · {cost} credit used". 360 → `CostSheet` ("Generate 360° view", note "Four AI views, about a minute. Labelled as AI.") → job → toast "✓ 360° view ready". Not affordable → `InsufficientCreditsSheet` (no `onAdjust`). Billing off: no CostSheet for back (as today); 360 keeps its ask-first confirm without numbers.
- [ ] **Step 1: Failing tests**: `billing on: back asks with the server price before picking a photo`; `insufficient credits opens the sheet and starts nothing`; `server 402 opens the insufficient sheet`; `toast shows credits used from the job, not the price list`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(item): cost sheets and ready toasts for back and 360`.

### Task 4.3: Edit and Remove sheets

**Files:**
- Modify: `mobile/src/components/ItemEditForm.tsx` → render inside `Sheet`
- Test: `mobile/__tests__/ItemEditing.test.tsx`

- Fields in order: Name (input, placeholder = derived `garmentName`), Category (free text + group chips as shortcuts that fill the text with the group's singular), Pattern chips (`PATTERNS`), then existing Colors, Details, Printed text. Save → `updateItem(item, patch incl. name)` → toast "Changes saved". Unsaved-changes guard kept.
- Remove → `Sheet` "Remove from closet?", body "You can't undo this in the app." + (billing on) "Credits used for its images are not returned.", destructive "Remove", "Cancel" → soft delete + success haptic.
- [ ] **Step 1: Failing tests**: `saving a name sends {name}`; `"Changes saved" toast`; `remove sheet hides the credits sentence when billing off`; `discard guard still asks`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(item): edit and remove sheets`. Update SCREENS §5, PR M4.

---

## M5 — Add tab and garment-photo flow (`feat/redesign-m5`)

### Task 5.1: Capture job store

**Files:**
- Create: `mobile/src/store/captureJobs.tsx`
- Modify: `mobile/src/RootNavigator.tsx` (provider inside `AppShell`, keyed by user), `mobile/src/useCapture.ts` (start via store), Home in-flight row (Task 3.1 slot)
- Test: `mobile/__tests__/captureJobs.test.tsx`

**Interfaces:**
- Produces: `useCaptureJobs(): { current: CaptureJob | null; start(photoUri: string, maxFronts?: number): void; retry(): void; clear(): void }` with `CaptureJob = { id: string; photoUri: string; maxFronts?: number; status: "running" | "done" | "failed"; startedAt: number; result?: RunResponse; error?: string; insufficient?: boolean }`. Wraps existing `postRun` (it already polls); leaving the screen doesn't cancel it. `insufficient` true when the error is `NO_CREDITS`.
- [ ] **Step 1: Failing tests**: `start → running → done with result`; `NO_CREDITS sets insufficient`; `retry re-posts the same photo with a new attempt`; `a different user gets an empty store`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(capture): job store that survives leaving the screen`.

### Task 5.2: Add chooser, camera and preview (D6, D9)

**Files:**
- Modify: `mobile/app/(tabs)/add.tsx` (chooser)
- Create: `mobile/app/capture/_layout.tsx` (Stack, no tabs), `mobile/app/capture/camera.tsx`, `mobile/app/capture/preview.tsx`
- Modify: `mobile/src/RootNavigator.tsx` (register `capture`)
- Test: `mobile/__tests__/AddScreen.test.tsx`, `mobile/__tests__/CaptureFlow.test.tsx`

- `npx expo install expo-camera`.
- Add chooser: "Add Clothes", "Choose how to start. Finding garments is always free."; card "Photograph Garments" (sub "1 credit per garment" from `prices.garment`, hidden when billing off) → `/capture/camera?mode=garments`; card "Import from Outfit Photo" (only if `outfit`, sub "Free detection · N credit(s) per piece") → `/capture/camera?mode=outfit`; footer "Balance: N credits · Price list" (billing on) → Account; `firstPiece` param shows numbered hint card.
- Camera: `CameraView` full-screen dark, corner brackets, hint pill ("Lay pieces flat · daylight works best" / outfit: "Full body, good light"), mode switch GARMENTS (#ffd60a label) / OUTFIT (only if `outfit`), 76pt shutter, library thumbnail (`pickPhoto(false)`), ×. Permission denied → explanation + "Choose from Library". Garments → `/capture/preview?uri=`; outfit → `/outfit/detect?uri=` (M6).
- Preview (D6 = keep rule): square photo, "Pieces in this photo" stepper (existing `useFrontsChoice` logic, 1…affordable, max 20), cost card "Front catalog image × N — N credits" + "Balance after" (billing on), note "You pay only for the pieces made; extra pieces aren't made.", sticky CTA "Generate up to N Items · N credits" (billing off: "Create Catalog Images") → `start(uri, maxFronts)` → `/capture/processing`. Not affordable at N=1 → `InsufficientCreditsSheet`.
- [ ] **Step 1: Failing tests**: `outfit card hidden when outfit is off`; `chooser hides prices when billing off`; `preview CTA shows the server price × N`; `cannot pick more fronts than affordable`; `0 affordable opens the insufficient sheet`; `camera permission denied offers the library`.
- [ ] **Step 2–4:** FAIL → implement (mock `expo-camera` in `jest.setup.js`) → PASS.
- [ ] **Step 5: Commit** `feat(capture): add chooser, camera and preview with fronts quote`.

### Task 5.3: Processing, error, results, saved (D10, D12)

**Files:**
- Create: `mobile/app/capture/processing.tsx`, `mobile/app/capture/results.tsx`, `mobile/app/capture/saved.tsx`, `mobile/src/components/ProcessingCard.tsx`
- Modify: delete `mobile/src/components/JustAdded.tsx` and its test once Results covers tier/tips/failed/over-limit/no-garment/worn-rejection
- Test: `mobile/__tests__/CaptureResults.test.tsx`, `mobile/__tests__/ProcessingCard.test.tsx`

- ProcessingCard: 230×288 card blurred→sharp (`Image blurRadius` animated down), `Shimmer` sweep, stage title + 260×6 `ProgressBar` easing to 90% (existing `ProcessingStatus` timing), 4-step checklist "Finding each garment → Separating the pieces → Laying them flat → Adding final details" (done = success check, current = spinner), footer "You can leave this screen — your pieces will appear in your closet." (D10). No "n of N" until Task 8.1.
- Processing route reads `useCaptureJobs().current`; `done` → `/capture/results`; `failed` → error state: greyed photo + red "!" badge, "Generation paused", job error text, + (billing on) "Credits for unfinished items were returned to your balance.", "Try Again" (`retry`) / "Back to Preview"; `insufficient` → `InsufficientCreditsSheet`.
- Results: "✓ READY" eyebrow (success), "N pieces created", grid with check toggles (deselected 40%), each with tier badge and retake/edge tip; failed count; over-limit note; quality-reject and "no garment" messages and "Try it as an outfit photo" (existing `isWornRejection`); CTA "Add N to Closet" (disabled at 0) → `deleteItem` for deselected (note "Credits for removed pieces are not returned." when billing on) → `/capture/saved`.
- Saved: fan of up to 3 tiles (−9/0/+9) + success badge, "Added to your closet" (`type.display(40)`), "N new pieces" + (billing on) " · N credits used" (from `cost_credits` of the job when available, else omitted), "View Closet" / "Add More Clothes".
- [ ] **Step 1: Failing tests**: `processing moves to results when the job is done`; `failed job shows Try Again and retry re-posts`; `results: deselecting one deletes it on Add`; `Add is disabled when none selected`; `worn rejection offers outfit mode`; `saved hides credits used when billing off`; `leaving processing keeps the job (Home shows "Creating pieces…")`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(capture): processing, error, results and saved screens`. Update SCREENS §1 and §3, PRD req 6 & 10, PR M5.

---

## M6 — Outfit-photo flow (`feat/redesign-m6`)

### Task 6.1: Types and routes

**Files:**
- Modify: `mobile/src/api/types.ts` (`OutfitCandidate.box: {x:number;y:number;w:number;h:number}` — match server keys exactly; read `api/schemas.py` `OutfitCandidateOut.box` and the producing code in `pipeline/outfit.py`), `mobile/src/RootNavigator.tsx` (`outfit/detect`, `outfit/pick`, `outfit/review`)
- Test: `mobile/__tests__/v1client.test.ts`

- [ ] Steps: failing test `scan candidates keep their box` → implement → PASS → commit `feat(outfit): candidate boxes in the app`.

### Task 6.2: Detecting screen

**Files:**
- Create: `mobile/app/outfit/detect.tsx`, `mobile/src/components/outfit/{PhotoWithBoxes,ScanBand}.tsx`
- Test: `mobile/__tests__/OutfitScreens.test.tsx`

- Photo with `ScanBand` (tint 22% gradient via `expo-linear-gradient`, 2.4s loop, static under Reduce Motion), "Finding garments…", "N found" (after the scan returns), "Detection is free" pill. Boxes pop in staggered (scale 1.15→1) once candidates arrive — not faked mid-scan. Errors/expired → existing messages + "Try another photo". Success → `/outfit/pick?scan=`.
- [ ] **Step 1: Failing tests**: `shows "Detection is free"`; `boxes render after the scan`; `scan band static under Reduce Motion`; `no-garment scene shows the existing note`.
- [ ] **Step 2–4:** FAIL → `npx expo install expo-linear-gradient`, implement → PASS.
- [ ] **Step 5: Commit** `feat(outfit): detecting screen`.

### Task 6.3: Select pieces + confirm cost (D13)

**Files:**
- Modify: `mobile/app/outfit/pick.tsx`
- Test: `mobile/__tests__/OutfitScreens.test.tsx`

- `PhotoWithBoxes` tappable (selected = solid tint border + 8% tint; unselected = dashed white) with number badges; rows: 62pt crop (`preview_url`), `candidateTitle`, "{Group} · Clear match" or amber "Not sure — please check" (`visibility !== "full"` or non-empty `uncertainty`), check circle; mostly-hidden start unselected and shoes not offered (existing `pickable`/`defaultPicks`). Row "Not a garment" action (swipe or "…" menu) removes it from the list (client only). No Edit-before-generate, no "Mark a missed garment" (D13). Sticky footer "N selected" + "N credits · X available" (billing on) + "Generate" → `CostSheet` ("Generate N garments", "Front image × N", Total, "Balance X → Y", note "Detection was free", confirm "Generate · N credits") → `generateOutfit(scan, ids, unitPrice)` → processing (reuse `ProcessingCard`, outfit stage labels) → `/outfit/review`. Not affordable → `InsufficientCreditsSheet` with `onAdjust` and body "Deselect K garments to continue with what you have."; server 409 → refresh prices and reopen `CostSheet`; 402 → insufficient sheet.
- [ ] **Step 1: Failing tests**: `tapping a box toggles its row`; `low-visibility candidate starts unselected with "Not sure — please check"`; `cost sheet shows Balance X → Y and "Detection was free"`; `too few credits: "Deselect 2 garments"`; `409 re-quotes`; `billing off: no numbers, "Generate"`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(outfit): select pieces with boxes and confirm cost`.

### Task 6.4: Review and saved (D14)

**Files:**
- Modify: `mobile/app/outfit/review.tsx`
- Test: `mobile/__tests__/OutfitScreens.test.tsx`

- "Review i of N" + "N kept"; side-by-side "YOUR PHOTO" crop (3:4, item `crop_url`) | "GENERATED" (4:5, `GarmentImage`); name, "AI image made from your photo. Parts hidden in the photo were completed."; Keep `Switch` (default on); thumbnail strip; ‹ / Next; last item "Save N to Closet" → `keepItem` for kept, `deleteItem` for not kept → `/capture/saved`. No Regenerate (D14). "Later" kept; pending resume from Add/Home kept; failed picks listed as not charged.
- [ ] **Step 1: Failing tests**: `Save keeps kept and discards the rest`; `"N kept" updates on toggle`; `no Regenerate button`; `pending results reopen after restart`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(outfit): side-by-side review and saved`. Update SCREENS Outfit section, PR M6.

---

## M7 — Account (`feat/redesign-m7`)

### Task 7.1: Account screen

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx`, `mobile/src/components/CreditsCard.tsx`, `mobile/src/components/CreditsSheet.tsx` (→ "How it works" `Sheet`)
- Create: `mobile/src/appearance.ts`
- Test: `mobile/__tests__/AccountScreen.test.tsx`, `mobile/__tests__/appearance.test.ts`

**Interfaces:**
- Produces: `useAppearance(): { mode: "system"|"light"|"dark"; setMode(m): Promise<void> }` — AsyncStorage `appearance.mode`, applies `Appearance.setColorScheme(mode === "system" ? null : mode)` at startup and on change (D16).
- Grouped list on `grouped`: profile card (initials from the email's first letters in a `tintSoft` circle, email; no name per D8); AI CREDITS card: `available` 54/700, "of {granted} granted" (never a fixed number), 8pt `ProgressBar` (`available/granted`, warning at ≤ 3), "{used} used so far · enough for about {floor(available / prices.garment)} more garments" or low warning; "How it works" sheet (1 Detection is free · 2 You pay per image created · 3 You always see the cost first); billing off → existing `BILLING_OFF` note, no numbers. PRICE LIST: "Garment detection — Free" (only if `outfit`), Front / Back / 360° from `prices`. RECENT ACTIVITY: existing `visibleEntries`/`entryLabel`/`entrySign`, + in `success`, − in `label`, "Show more". SETTINGS: Appearance `Segmented` System/Light/Dark; no Notify switch (D10); no Help/Privacy rows (D17). "Sign Out" (tint, confirm), "Delete Account" only after M8 (D15). Version footer from `expo-constants`. Local mode: local-mode row + Appearance only.
- [ ] **Step 1: Failing tests**: `denominator is granted from the server`; `bar turns warning at 3 available`; `"enough for about" uses the front price`; `billing off shows the note and no numbers`; `appearance persists and calls Appearance.setColorScheme`; `local mode shows no credits`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(account): handoff account with credits, price list, activity, appearance`. Update SCREENS §4, PR M7.

---

## M8 — Backend extras (`feat/redesign-m8`; each task only if its decision says yes)

### Task 8.1: Job progress (D11)

**Files:**
- Create: `supabase/migrations/<ts>_job_progress.sql` (`generation_jobs.progress jsonb`, not client-writable), `supabase/tests/database/job_progress.test.sql`
- Modify: `api/worker.py`, `pipeline/orchestrator.py` (optional `on_item_done(done:int, total:int)` callback), `api/schemas.py` (`JobOut.progress: {done:int,total:int} | None`), `api/store.py`; `mobile/src/api/v1.ts` (expose progress via a polling callback), `mobile/src/store/captureJobs.tsx`, `ProcessingCard` ("n of N" badge)
- Test: `tests/api/test_worker.py::test_progress_written_per_item`, `tests/api/test_v1_jobs.py::test_progress_other_user_404`, pgTAP `client cannot update progress`, jest `ProcessingCard shows "2 of 3"`.
- [ ] Steps: failing tests → implement (no new model calls) → `pytest -q`, `npx supabase test db`, `npx jest` PASS → commit `feat(jobs): per-item progress`.

### Task 8.2: Delete account (D15)

**Files:**
- Modify: `api/routes/v1.py` (`DELETE /v1/account`, requires body `{"confirm": "DELETE"}`), `api/store.py` (soft-mark profile `status='disabled'`, delete Storage `<user>/…`, then Supabase admin `auth.admin.delete_user` — cascades rows), `mobile/app/(tabs)/account.tsx` (Delete Account row + danger `Sheet`: "Delete your account?", "Your closet, photos and credits are removed for good.", type-to-confirm not required, destructive "Delete Account") → sign out.
- Test: `tests/api/test_v1_account.py::test_delete_account_removes_only_own_data` (two users), `::test_requires_confirm`, `tests/integration` two-user check; jest `delete asks first and signs out`.
- [ ] Steps: failing tests → implement → PASS → commit `feat(account): delete account`. Update PRD (Accounts), ARCHITECTURE (API table), ROADMAP (TestFlight item), PR M8.

---

## Order and parallelism

M0 → M1 … in order; M2 can run in parallel with M1 (no shared files). M3 needs M0 + M2; M4 needs M0 + M2; M5 needs M0 (+ Task 3.1 slot); M6 needs M5's `ProcessingCard` and `capture/saved`; M7 needs M0; M8 is independent of UI milestones except its small app parts.
