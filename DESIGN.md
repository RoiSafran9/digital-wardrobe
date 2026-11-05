---
name: KIPS Glass
description: A native iOS closet where your own garments sit on frosted glass over soft color.
colors:
  background: "#F2F2F6"
  background-dark: "#000000"
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
  tab-inactive: "#3A3A3F"
  tab-inactive-dark: "#C7C7CC"
  separator: "rgba(20,20,25,0.08)"
  separator-dark: "rgba(255,255,255,0.10)"
  separator-strong: "#C7C7CC"
  separator-strong-dark: "#48484A"
  fill: "rgba(120,120,128,0.12)"
  fill-dark: "rgba(120,120,128,0.26)"
  glass: "rgba(255,255,255,0.58)"
  glass-card: "rgba(255,255,255,0.68)"
  glass-sheet: "rgba(255,255,255,0.90)"
  glass-border: "rgba(255,255,255,0.80)"
  glass-tint: "rgba(11,94,255,0.90)"
  glass-dark: "rgba(44,44,46,0.55)"
  tint: "#0B5EFF"
  tint-dark: "#3D86FF"
  tint-soft: "rgba(31,107,255,0.10)"
  tint-soft-dark: "rgba(61,134,255,0.18)"
  on-tint: "#FFFFFF"
  on-tint-dark: "#000000"
  success: "#23A55A"
  success-text: "#1B7F45"
  destructive: "#D61E24"
  destructive-dark: "#FF5A5F"
  warning: "#E8A33D"
  warning-text: "#98610E"
typography:
  family: "Bricolage Grotesque (400, 500, 600, 700, 800)"
  hero:
    fontSize: "64px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  display:
    fontSize: "36–42px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  large-title:
    fontSize: "34px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  screen-title:
    fontSize: "32px"
    fontWeight: 800
  page-title:
    fontSize: "28px"
    fontWeight: 800
  title2:
    fontSize: "24px"
    fontWeight: 800
  title3:
    fontSize: "21px"
    fontWeight: 800
  section:
    fontSize: "22px"
    fontWeight: 700
  headline:
    fontSize: "17px"
    fontWeight: 600
  body:
    fontSize: "17px"
    fontWeight: 400
  subhead:
    fontSize: "15px"
    fontWeight: 400
  footnote:
    fontSize: "13px"
    fontWeight: 400
  eyebrow:
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.6px"
  tab-label:
    fontSize: "10.5px"
    fontWeight: 600
rounded:
  button: "14px"
  primary: "16px"
  image: "14px"
  garment: "20px"
  list: "22px"
  tile: "24px"
  hero: "28px"
  sheet: "34px"
  pill: "999px"
spacing:
  card-gap: "10px"
  card-inner: "14px"
  home-screen: "16px"
  flow-screen: "20px"
  section: "24px"
---

# Design System: KIPS Glass

Source: the owner's KIPS Glass handoff, `docs/design/design_handoff_glass_redesign/` (README, the static board `explorations/screens/All Screens.html` with every screen numbered 0.1–8.5, and the clickable `explorations/glass/KIPS Glass.html`). Adopted 2026-11-06; it replaces the first handoff (`docs/design/design_handoff_digital_wardrobe/`, 2026-10-19). Tokens live in `mobile/src/theme.ts`; shared components in `mobile/src/ui/`.

## Overview

**Creative North Star: "Your own clothes, beautifully catalogued."**

Still a well-made iOS app — native sheets, SF Symbols, one blue accent — but with its own voice: one typeface (Bricolage Grotesque, heavy and tightly tracked for titles), frosted-glass cards floating over a cool grey screen with two soft color blobs, and a floating capsule tab bar with a raised camera. What makes it feel alive is still the user's own garments: fans of pieces on Home's cards, tiles that pop in, the 360 turntable.

Light and dark are one system: every color is a `DynamicColorIOS` pair, and every text pair holds 4.5:1 in both appearances (`mobile/__tests__/theme.test.ts`). The Glass handoff designed light mode only; dark mode keeps the earlier dark tokens with a dark glass fill and no blobs, until the owner designs it.

**Built against the handoff:** colors that failed 4.5:1 as text keep the shipped darker values (accent `#0B5EFF`, danger `#D61E24`, success text `#1B7F45`, warning text `#98610E`). `#A1A1A6` (`tertiaryLabel`) fails as text, so it is for glyphs, placeholders and disabled states only (a test fails if it colors text). The "AI stylist" tag on Home's Build My Look card waits for the owner's approval of the copy; the card shows "Outfit ideas" instead.

## Colors

### Accent
- **Accent Blue** (`tint`): primary buttons, links, the active tab, the camera button, selected states, the credits dot. **Tint Soft** (`tintSoft`) is its 10% wash: numbered badges, the Build My Look tag, selected outfit boxes. **On-Tint** is text on a blue fill. **Glass Tint** (`glassTint`, 90%) is the blue glass of the Add clothes card.

### Neutral
- **Background** (`background`): the cool grey screen (`#F2F2F6`) behind the glass; black in dark mode.
- **Glass** (`glass` 58%, `glassCard` 68%, `glassSheet` 90%): the white fills over the blur; `glassBorder` its 0.5pt edge, `glassHighlight` the 1pt top highlight.
- **Card** (`card`): white controls (the selected segment, chips over glass). **Tile** (`tile`): the stone stage behind every garment image.
- **Label / Secondary / Tertiary** (`label`, `secondaryLabel`, `tertiaryLabel`); **Tab Inactive** (`tabInactive`, `#3A3A3F`): inactive tabs and long copy.
- **Separator** (`separator`): hairlines. **Fill** (`fill`): soft buttons, segmented tracks, unselected chips, progress tracks.

### Status (one meaning each)
- **Success** (`success` fill, `successText` text): ready, check marks, credits added.
- **Warning** (`warning` fill, `warningText` text): low credits (≤ 3), "Not sure — please check".
- **Destructive** (`destructive`): removal, deletion, errors. Tier colors stay inside the tier badge.

### Garment swatches (data, not UI)
The 15 colors in `SWATCHES` (`theme.ts`) describe garments and don't change with appearance.

### Named Rules
**One Accent.** Blue means you can act or it is selected. Green, amber and red each carry one status meaning.

**Dynamic Pairs.** A new color is added to both palettes and, if it colors text, to the contrast test.

**Honest Credits.** No credit number is ever hardcoded. Balances and prices come from the server; with billing off, no amount is shown ("Finding pieces is free").

## Typography

**One family: Bricolage Grotesque** (`@expo-google-fonts/bricolage-grotesque`, 400–800, loaded in `app/_layout.tsx`). React Native chooses a custom face by family name, not by weight, so every weight is its own family: `type.*` already carries it, and a weight change is `...weight(600)` — never a bare `fontWeight` (a test fails on one outside `theme.ts`).

- **Titles** are 800, tracked −0.03em, leading ~1.1: `type.hero` 64 (Home's piece count, tabular), `type.display(36–42)` (Welcome, celebrations, empty Home), `type.largeTitle` 34 (Closet, Me), `type.screenTitle` 32 (flow titles), `type.pageTitle` 28 (item name), `type.title2` 24 (hero cards), `type.title3` 21 (category tiles), `type.balance` 54.
- **UI text:** `section` 22/700 (sheet titles), `cardTitle` 19/700, `headline` 17/600 (buttons, row titles), `body` 17, `callout` 16, `subhead` 15, `footnote` 13, `caption` 12, `toast` 14/600, `tabLabel` 10.5/600.
- **Eyebrow** 13/600 uppercase +0.6: the Home greeting, list headers.
- `type.tag` (Menlo) is the one exception, for small photo-type tags.

**The Text Style Rule.** Size and family come from `type.*`; never a raw `fontSize` or `fontFamily`. **Tabular counts:** counts and credits use tabular figures.

## Layout

Home and Closet: 16pt side padding; flow screens 20pt. Content starts ~56pt below the top. Card gap 10, section gap 24, card padding 14–16. Tab screens end their scroll `TAB_BAR_HEIGHT + 28` above the bottom so the last row clears the capsule. Flow screens (camera, preview, processing, results, outfit steps, Build My Look) are stack routes without the tab bar. Reference frame: iPhone 16/17, 402×874pt — Home's header, Add card, Build My Look card and four category tiles fit above the tab bar.

## Elevation & Depth

**Glass** (`Glass` in `mobile/src/ui/Glass.tsx`): a system blur (`BlurView`, intensity 40, `systemChromeMaterial`) under a white fill at 58/68/90%, a 0.5pt `rgba(255,255,255,0.8)` border, a 1pt inner highlight at the top, and `shadow.glass` (0, 10, radius 15, 10%). The shadow sits on the outer view and the blur is clipped inside, so a card never clips its own shadow; `decor` draws art inside the clip (the Add card's circle, garments bleeding off a tile). Blue glass (`blue`) has no blur.

**Backdrop:** two blurred blobs (`#8FB0D6` 320pt at 30%, top left; `#E8C9A8` 260pt at 24%, right) pre-rendered into `mobile/assets/backdrop.png`, behind Home, Closet, Me and onboarding. Never on the camera or the item screen; hidden in dark mode.

Garment fans carry `shadow.lift` on their stone tile with a 2pt white border — a shadow under the piece's tile, never a tint, filter or glow on its pixels. Sheets: `shadow.sheet`.

## Shapes

Tab capsule and chips 999 · hero cards 28 · cards and tiles 24 · list groups 22 · garment images 14–20 · buttons 16 (≥ 50pt) or 14 · fields 14 · sheets 34.

## Icons

SF Symbols through `Icon` (`mobile/src/components/Icon.tsx`), Ionicons only as fallback; the handoff's Ionicons names map to their SF twins. Rules, reserved symbols and the preview script: [docs/design/ICONS.md](docs/design/ICONS.md). The selected tab uses the filled twin (`homeFill`, `closetFill`, `accountFill`).

## Components (`mobile/src/ui/`)

- **Glass / Backdrop / GlassScreen:** the surface and the blobs (above).
- **Tab bar** (`mobile/src/components/TabBar.tsx`): Home · Closet · [camera] · Looks · Me. A 62pt glass capsule 16pt from the sides and 26pt above the bottom; 23pt icons over 10.5/600 labels, active = tint with the filled icon, inactive = `tabInactive`. The camera is a 72pt tint circle raised 26pt with a 5pt white ring and a blue shadow; it breathes and opens the camera in garment mode. Looks (only when the server offers Build My Look) opens Build My Look. Me is the old Account tab; Add is no longer a tab (its route stays for flows that link to it).
- **Button:** `primary` (54pt, accent), `glass`, `soft` (fill), `ink`, `secondary` (white), `text`, `destructive`; `medium` is 44pt. Disabled = 40% opacity; press scales to 0.98.
- **IconButton:** a 40pt round glass button for close / back; `dark` over the camera and photos.
- **Sheet:** glass (90% fill) over `rgba(0,0,0,.32)`, radius 34, grabber, tap outside to dismiss; `floating` sits 10pt from the edges. Slides up 380ms; fades under Reduce Motion.
- **CostSheet** and **InsufficientCreditsSheet:** every paid action is confirmed with server prices, Total and "Balance X → Y"; running out shows "available / N credits needed" with an amber bar. No purchase UI.
- **Segmented:** a capsule track (fill, or `glass` over an image) with a white segment that springs to the choice (damping 14, stiffness 180; a 200ms slide under Reduce Motion).
- **Chip:** 34pt capsule; selected = ink fill with inverted text; `glass` variant over the blobs.
- **GroupedList / Row:** eyebrow header over a glass list (radius 22), hairline-divided rows.
- **CreditPill:** glass capsule with an accent dot and the balance; only while billing is on.
- **Toast:** top-center ink pill, 14/600.
- **Home cards** (`mobile/src/components/home/HomeCards.tsx`): the blue Add clothes card (Laid flat / Worn), the Build My Look card with three floating pieces, category tiles with a fan of up to three pieces, New this week (only when something was added in the last 7 days).

Existing pieces keep their roles: `PressScale` (cards scale to 0.97), `Rise`, `PopIn`, `Breathe` / `Float` (`mobile/src/motion/Breathe.tsx`), `GarmentImage` (cutout → white generated → crop), `TierBadge`, `TurnView` (360 turntable, labelled AI).

## Motion

- Springs for the segmented and tab indicators (damping 14, stiffness 180). Rise in: opacity and 14pt up, ~400ms. Sheets 380ms on `cubic-bezier(.2,.8,.2,1)`.
- Breathe (camera buttons): scale 1 → 1.04 → 1 over 3s. Float (Build My Look card garments): 0 → −8pt over 2.6s, staggered 300ms. Shimmer while generating: 1.6s sweep.
- Haptics: selection on tabs, toggles, chips and segments; success on confirms and saves.
- **Reduce Motion:** no breathe, float, shimmer, turn or drift; springs become short slides or fades.

## Do's and Don'ts

### Do
- Label every photo entry point with the kind of photo it wants: garment photo (laid flat or on a hanger) or outfit photo (someone wearing it).
- Take every color from `colors.*` and every text style from `type.*` (+ `weight()`).
- Put cards on glass over the backdrop; keep garment images on the stone `tile`.
- Show a price only from the server, and confirm every paid action with a CostSheet.
- Make every tappable reach 44pt (`hitSlopFor`) and give state controls `accessibilityRole` and `accessibilityState`.

### Don't
- Hardcode credit amounts or prices, or show any purchase UI.
- Use a raw `fontWeight`, `fontSize` or `fontFamily`, or `tertiaryLabel` as a text color.
- Tint, filter or glow garment images, or put the blobs behind the camera or the item screen.
- Keep anything moving under Reduce Motion.
