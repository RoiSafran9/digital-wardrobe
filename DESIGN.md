---
name: Wardrobe
description: A native iOS closet where your own garments drift, rise and pop into place.
colors:
  background: "#FFFFFF"
  background-dark: "#000000"
  grouped: "#F4F4F2"
  grouped-dark: "#1C1C1E"
  card: "#FFFFFF"
  card-dark: "#1C1C1E"
  tile: "#F3F2EF"
  tile-dark: "#1B1B1D"
  label: "#131315"
  label-dark: "#F5F5F7"
  secondary-label: "#6E6E73"
  secondary-label-dark: "#98989F"
  tertiary-label: "#A1A1A6"
  tertiary-label-dark: "#636366"
  separator: "rgba(20,20,25,0.08)"
  separator-dark: "rgba(255,255,255,0.10)"
  separator-strong: "#C7C7CC"
  separator-strong-dark: "#48484A"
  fill: "rgba(120,120,128,0.12)"
  fill-dark: "rgba(120,120,128,0.26)"
  tint: "#0B5EFF"
  tint-dark: "#3D86FF"
  tint-soft: "rgba(31,107,255,0.10)"
  tint-soft-dark: "rgba(61,134,255,0.18)"
  on-tint: "#FFFFFF"
  on-tint-dark: "#000000"
  success: "#23A55A"
  success-dark: "#30C26A"
  success-text: "#1B7F45"
  success-text-dark: "#30C26A"
  destructive: "#D61E24"
  destructive-dark: "#FF5A5F"
  warning: "#E8A33D"
  warning-text: "#98610E"
  warning-text-dark: "#E8A33D"
typography:
  display:
    fontFamily: "Instrument Serif"
    fontSize: "46px / 42px / 40px"
    fontWeight: 400
  large-title:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "34px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  screen-title:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "32px"
    fontWeight: 700
  section:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "22px"
    fontWeight: 700
  headline:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "17px"
    fontWeight: 400
  subhead:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "15px"
    fontWeight: 400
  footnote:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "13px"
    fontWeight: 400
  eyebrow:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.05em"
  stat:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "26px"
    fontWeight: 600
  tab-label:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "10.5px"
    fontWeight: 500
rounded:
  segment: "8px"
  input: "12px"
  button: "14px"
  primary: "16px"
  list: "18px"
  tile: "22px"
  feature: "26px"
  stage: "28px"
  sheet: "34px"
  pill: "999px"
spacing:
  chip-gap: "8px"
  stack: "10px"
  inner: "14px"
  list-inset: "16px"
  screen: "20px"
  section: "28px"
---

# Design System: Wardrobe

Source: the owner's design handoff, `docs/design/design_handoff_digital_wardrobe/` (README + clickable prototype). Adopted 2026-10-19 (redesign spec `docs/superpowers/specs/2026-10-19-ios-redesign-design.md`, decisions D1 and D2). Tokens live in `mobile/src/theme.ts`; shared components in `mobile/src/ui/`.

## Overview

**Creative North Star: "Your own clothes, beautifully catalogued."**

The app still reads as a well-made first-party iOS app — SF Pro, SF Symbols, native page sheets, segmented controls, one blue accent — but warmer and more editorial than stock Settings grey. Screens are white; grouped content sits on warm-grey cards; garments sit on a soft stone tile with a gentle shadow. Four editorial headlines use Instrument Serif. What makes it feel alive is still the user's own garments: tiles that pop into place, cards that give under a finger, the 360 turntable.

Light and dark are one system: every color is a `DynamicColorIOS` pair. Every text pair holds 4.5:1 in both appearances, and `mobile/__tests__/theme.test.ts` enforces it.

**Built against the handoff:** where a handoff color failed 4.5:1 as text on the grey cards in light mode, the shipped value is the nearest darker one that passes — accent `#1F6BFF` → `#0B5EFF`, danger `#E5484D` → `#D61E24`, success text `#23A55A` → `#1B7F45`, warning text `#C27C12` → `#98610E`. Fills (the success check, the amber low-credit bar) keep the handoff values. The handoff's `ink3` (`#A1A1A6`) fails as text, so `tertiaryLabel` is for glyphs, placeholders and disabled states only (a test fails if it is used as a text color). The tab bar's inactive labels use `secondaryLabel` for the same reason.

## Colors

### Accent
- **Accent Blue** (`tint`): primary buttons, links, the active tab, selected states, the credits bar and dot. **Tint Soft** (`tintSoft`) is its 10% wash: the starter-credits circle, avatar, selected outfit boxes. **On-Tint** is the text on a blue fill.

### Neutral
- **Background** (`background`): white screens (black in dark).
- **Grouped** (`grouped`): warm-grey cards and grouped lists on white screens (the handoff's `bg2`).
- **Card** (`card`): sheets and white controls on grouped backgrounds.
- **Tile** (`tile`): the stone well behind garment images and image stages.
- **Label / Secondary / Tertiary** (`label`, `secondaryLabel`, `tertiaryLabel`): ink, supporting text, and non-text glyphs.
- **Separator** (`separator`): hairlines. **Fill** (`fill`): search fields, segmented track, filter chips, round icon buttons, progress tracks. **Separator Strong**: swatch outlines.

### Status (one meaning each)
- **Success** (`success` fill, `successText` text): ready states, check marks, credits added (+N).
- **Warning** (`warning` fill, `warningText` text): low credits (≤ 3) and "Not sure — please check".
- **Destructive** (`destructive`): removal, deletion, errors.
- Tier colors (`tier-*`, unchanged) stay inside the tier badge.

### Garment swatches (data, not UI)
The closed vocabulary of 15 colors in `SWATCHES` (`theme.ts`) describes garments and doesn't change with appearance. Swatches carry a hairline outline so white and beige stay visible.

### Named Rules
**One Accent.** Blue means you can act or it is selected. Green, amber and red each carry one status meaning and are never decoration.

**Dynamic Pairs.** A new color is added to both palettes and to the contrast test.

**Honest Credits.** No credit number is ever hardcoded. Balances and prices come from the server; with billing off, no amount is shown.

## Typography

**Display:** Instrument Serif (`@expo-google-fonts/instrument-serif`, loaded in `app/_layout.tsx`), regular, line height 1.0. Only four places: Welcome (46), Home greeting (42), "A welcome gift" and "Added to your closet" (40). Use `type.display(size)`.
**Everything else:** SF Pro through `type.*`; no `fontFamily` anywhere else, except `type.tag` (Menlo, 10/600, +0.06em) for the small photo-type tags on Home's add tiles ("FLAT LAY", "WORN").

- **Large Title** 34/700, −0.02em: tab screen titles ("Closet", "Account").
- **Screen Title** 32/700: flow screens ("Sign in with email", "Add Clothes").
- **Section** 22/700: section and sheet titles.
- **Headline** 17/600: large button labels, row titles.
- **Body** 17 / **Callout** 16 / **Subhead** 15: copy, rows, chips and segments.
- **Footnote** 13: captions and metadata. **Eyebrow** 13/600 uppercase +0.05em: dates and list headers ("AI CREDITS").
- **Stat** 26/600 tabular, **Balance** 54/700 tabular: numbers that matter.
- **Tab Label** 10.5/500.

**The Text Style Rule.** Size and weight come from `type.*`; never a raw `fontSize`. **Tabular counts:** numbers that change in place use tabular figures.

## Layout

Screen padding 20pt (grouped lists 16pt). Gaps 8/10/12/14/18/22/28. Closet is a two-column grid (12pt columns, 18pt rows) of 4:5 tiles. Flow screens (camera, preview, processing, results, outfit steps) are full-screen stack routes without the tab bar, with a sticky bottom CTA above the home indicator. iPhone frame reference: 393×852pt.

## Elevation & Depth

Tone first, then a soft shadow where the handoff uses one:
- Garment tiles: `shadow.tile` (0, 12, 15 radius, 8%).
- Sheets: `shadow.sheet` (0, −10, 20 radius, 12%).
- Garment cutouts may carry `shadow.cutout` (0, 8, 5 radius, 13%) — a shadow under the piece, never a tint, filter or glow on its pixels.
- Buttons, chips and grouped cards have no shadow; the selected segment has a 1pt hint.

## Shapes

Segment 8 · input/search 12 · 48pt button 14 · 54pt primary 16 · grouped list 18 · garment tile 20–22 · feature card 26 · image stage 28 · floating sheet 34 · capsules for chips, pills and toasts.

## Components (`mobile/src/ui/`)

- **Button:** `primary` (54pt, accent, white 17/600), `secondary` (48pt white/card), `text` (accent), `destructive` (red text). Disabled = 40% opacity. Press scales to 0.98.
- **Sheet:** bottom sheet over `rgba(0,0,0,.32)`, slides up 380ms on `cubic-bezier(.2,.8,.2,1)`, grabber, tap outside to dismiss; `floating` for confirmations (radius 34, inset 10pt). Under Reduce Motion it fades.
- **CostSheet:** every paid AI action is confirmed here — lines at server prices, Total, "Balance X → Y", an optional note ("Detection was free").
- **InsufficientCreditsSheet:** "available / N credits needed", amber bar, "Not enough credits", contextual body + "Ask the app owner for more credits." No purchase UI.
- **Toast:** top-center ink pill, 14/600, 2.6s.
- **Segmented:** fill track, card segment, haptic selection.
- **Chip:** 34pt capsule; selected = ink fill with inverted text; `outlined` for Home's category pills.
- **Swatch:** 28pt circle; selected = double ring (background gap + 1.5pt ink).
- **GroupedList / Row:** eyebrow header, card with hairline-divided rows, chevron or value accessory.
- **ProgressBar:** rounded bar on a fill track; amber when warning.
- **CreditPill:** fill capsule with an accent dot and the balance; only while billing is on.
- **Shimmer / PopIn** (`mobile/src/motion/PopIn.tsx`): AI-work sweep; pop-in from 90% and 8pt low over 600ms, staggered 0.12s by the caller.
- **Tab bar:** Home · Closet · Add · Account, 84pt, translucent blur with a hairline top, active accent.

Existing pieces keep their roles: `PressScale` (cards and garments scale to 0.97), `Rise`, `GarmentImage` (cutout → white generated → crop), `TierBadge`, `TurnView` (360 turntable swing, labelled AI).

## Motion

- Easing: the handoff's `cubic-bezier(.2,.8,.2,1)` (`SHEET_EASE`) for sheets and pop-ins; `EASE_OUT` for presses and rises.
- Pop-in: scale .9 + 8pt → rest, 0.5–0.7s, staggered 0.12s. Sheets 0.35–0.4s. Toast fades in/out.
- Haptics: selection on toggles, chips and segments; success on confirms and saves.
- **Reduce Motion:** no translate, scale, scan band or shimmer; short fades stay.

## Do's and Don'ts

### Do
- Label every photo entry point with the kind of photo it wants: garment photo (laid flat or on a hanger) or outfit photo (someone wearing it). Never a bare "Take Photo / From Library" pair.
- Take every color from `colors.*` and every text style from `type.*`.
- Show a price only from the server, and confirm every paid action with a CostSheet.
- Make every tappable reach 44pt (`hitSlopFor`) and give state controls `accessibilityRole` and `accessibilityState`.
- Use native structures where they exist (page sheet for Garment Details, SF Symbols, system photo picker).

### Don't
- Hardcode credit amounts or prices, or show any purchase UI.
- Use `tertiaryLabel` as a text color.
- Use Instrument Serif outside the four editorial headlines.
- Tint, filter or glow garment images, or box a transparent cutout.
- Keep anything moving under Reduce Motion.
