---
name: Wardrobe
description: A native iOS closet where your own garments drift, rise and count themselves in.
colors:
  tint: "#2563EB"
  tint-dark: "#64A0FF"
  on-tint: "#FFFFFF"
  on-tint-dark: "#000000"
  background: "#F2F2F7"
  background-dark: "#000000"
  card: "#FFFFFF"
  card-dark: "#1C1C1E"
  tile: "#F5F5F7"
  tile-dark: "#2C2C2E"
  label: "#000000"
  label-dark: "#FFFFFF"
  secondary-label: "#6C6C70"
  secondary-label-dark: "#AEAEB2"
  separator: "#E5E5EA"
  separator-dark: "#38383A"
  separator-strong: "#C7C7CC"
  separator-strong-dark: "#48484A"
  destructive: "#D70015"
  destructive-dark: "#FF6961"
  destructive-bg: "#FFECEC"
  destructive-bg-dark: "#3A1D1F"
  tier-high-bg: "#E3EBDD"
  tier-high-fg: "#3B5530"
  tier-high-bg-dark: "#223020"
  tier-high-fg-dark: "#B9D4A8"
  tier-medium-bg: "#F3E8CF"
  tier-medium-fg: "#7A5A12"
  tier-medium-bg-dark: "#362C14"
  tier-medium-fg-dark: "#E9CD8A"
  tier-low-bg: "#F6E4DD"
  tier-low-fg: "#9A3B26"
  tier-low-bg-dark: "#3B221B"
  tier-low-fg-dark: "#F2A48F"
typography:
  large-title:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "34px"
    fontWeight: 700
    letterSpacing: "0.37px"
  title2:
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
  tab-label:
    fontFamily: "SF Pro (iOS system font)"
    fontSize: "11px"
    fontWeight: 400
rounded:
  tile: "14px"
  card: "16px"
  pill: "999px"
spacing:
  chip-gap: "8px"
  stack: "10px"
  inner: "14px"
  card-inset: "16px"
  screen: "20px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.on-tint}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    padding: "15px 20px"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.tint}"
    typography: "{typography.headline}"
    rounded: "{rounded.card}"
    padding: "15px 20px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    typography: "{typography.subhead}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  chip-selected:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.on-tint}"
    typography: "{typography.subhead}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  garment-tile:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.tile}"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    rounded: "12px"
    padding: "12px 14px"
  segmented-control:
    backgroundColor: "{colors.tile}"
    rounded: "10px"
    padding: "2px"
  segmented-control-selected:
    backgroundColor: "{colors.card}"
    textColor: "{colors.label}"
    typography: "{typography.subhead}"
    rounded: "8px"
    padding: "7px 0"
  tier-badge-high:
    backgroundColor: "{colors.tier-high-bg}"
    textColor: "{colors.tier-high-fg}"
    typography: "{typography.footnote}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  tier-badge-medium:
    backgroundColor: "{colors.tier-medium-bg}"
    textColor: "{colors.tier-medium-fg}"
    typography: "{typography.footnote}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  tier-badge-low:
    backgroundColor: "{colors.tier-low-bg}"
    textColor: "{colors.tier-low-fg}"
    typography: "{typography.footnote}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
  tab-bar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.secondary-label}"
    typography: "{typography.tab-label}"
  tab-bar-active:
    textColor: "{colors.tint}"
---

# Design System: Wardrobe

## Overview

**Creative North Star: "The Category Standard, Set in Motion"**

The app looks like a well-made first-party iOS app on purpose. It uses the system font (SF Pro) on Apple's text-style scale, grey grouped backgrounds with white cards (near-black cards in dark mode), SF Symbols, page sheets, segmented controls and a single blue tint. The chrome adds nothing of its own. What makes it feel alive is the user's own garments: two marquee rows drift slowly across Home, the closet grid rises into place, cards give slightly under a finger, and the stats count up. All of that motion belongs to the garments and the collection, never to the chrome.

Density follows iOS: 20pt screen insets, compact 10pt stacks, and content grouped into rounded cards instead of separated by rules. Light and dark are one system. Every color is a `DynamicColorIOS` pair that follows the system appearance without a re-render. Both palettes hold every text pair to 4.5:1, and `mobile/__tests__/theme.test.ts` enforces it.

Built against: the spec (`docs/superpowers/specs/2026-10-16-home-and-native-redesign-design.md`) planned a soft shadow on floating elements, a semibold Title 2 and a `#4C8DFF` dark tint. What shipped is shadowless, uses a bold (700) Title 2 and a `#64A0FF` dark tint. The tokens here record what shipped.

**Key Characteristics:**
- System font, iOS text styles, tabular figures for counts.
- Grouped background, then card, then tile: depth comes from tone, with no shadows.
- One blue tint for actions and selection; red only for errors and removal.
- Garment cutouts float unboxed; only images that still carry a background sit on a tile.
- Motion is slow, eased out and touch-responsive, and it is stripped of movement under Reduce Motion.
- Every tappable target reaches 44pt, using invisible hit slop where the visual is smaller.

## Colors

The palette is Apple's grouped neutrals plus one saturated blue, mirrored for dark mode. Every value is a light/dark pair built with `DynamicColorIOS` (`colors.*` in `mobile/src/theme.ts`). The frontmatter lists light first and dark as `-dark`.

### Primary
- **Action Blue** (`tint` / `tint-dark`): primary button fill, secondary button text, selected chip fill, active tab, the progress bar, and text links like "Done". It is deliberately darker than system blue in light mode and lighter in dark mode so it clears 4.5:1 on both the background and the card. **On-Tint** (`on-tint`) is the text on a blue fill: white in light mode, black in dark mode.

### Neutral
- **Grouped Grey** (`background`): the screen and sheet backdrop behind all cards.
- **Card White / Elevated Graphite** (`card`): cards, buttons, chips, input fields, the tab bar, the selected segment, and the tile behind garment images on Home and in Closet.
- **Garment Tile** (`tile`): the default backdrop for images that keep their own background, plus circular sheet controls, the segmented-control track, and neutral notes.
- **Label** (`label`) and **Secondary Label** (`secondary-label`): primary text and supporting text (counts, captions, field labels, placeholders, inactive tabs, the pull-to-refresh spinner). Secondary is a solid colour, not the system's 60% alpha, so its contrast can be tested.
- **Separator** (`separator`): hairline rules between rows inside a card, the tab bar top border, and the progress-bar track. **Separator Strong** (`separator-strong`): swatch outlines, the garment placeholder icon, and the fallback swatch.
- **Destructive** (`destructive`) on **Destructive Wash** (`destructive-bg`): error text, error boxes, "Remove from closet", and the retake note on low-tier items.

### Tier colors (status only)
Muted green, amber and terracotta pairs (`tier-high`, `tier-medium`, `tier-low`, labelled "Great", "OK", "Retake"). They appear only in the tier badge.

### Garment swatches (data, not UI)
There is a closed vocabulary of 15 fixed swatch colors (black `#1D1B18`, white, gray, navy, blue, red, pink, dusty pink, mint, green, yellow, orange, purple, brown, beige; see `SWATCHES` in `theme.ts`). They describe a garment's color and do not change with appearance. Unknown names fall back to `separator-strong`. Swatches always carry a 1pt `separator-strong` outline so white and beige stay visible on a white card.

### Named Rules
**The One Tint Rule.** Blue is the only accent. It marks something you can tap or something that is selected, and nothing else. Tier colors live only in the tier badge, and red only means an error or removal.

**The Dynamic Pair Rule.** Every UI color is a light/dark pair, and every text-on-surface pair passes 4.5:1 in both appearances. A new color must be added to both palettes and to the contrast test's pair list.

## Typography

**Display Font:** SF Pro (the iOS system font; no `fontFamily` is set anywhere)
**Body Font:** SF Pro
**Label/Mono Font:** none; numbers use `fontVariant: tabular-nums`

**Character:** The system's own voice. Hierarchy comes from Apple's text-style sizes and weights alone. There is no custom face, no uppercase tracking and no decorative type.

### Hierarchy
- **Large Title** (700, 34pt, +0.37 tracking): one per tab screen, with the screen name ("Wardrobe", "Closet", "Add a piece"). It is marked as `accessibilityRole="header"`.
- **Title 2** (700, 22pt): section and sheet titles ("Just added", "Start your closet"), the item category in the sheet, and stat numbers.
- **Headline** (600, 17pt): button labels, processing-stage labels, the "By category" heading, and tip and row titles.
- **Body** (400, 17pt): explanatory copy, fact rows, input text, and text actions ("Done", "Remove from closet").
- **Subhead** (400, 15pt): the screen subtitle (piece count), chip and segment labels, notes, and grid item names.
- **Footnote** (400, 13pt): stat captions, secondary metadata ("Added Oct 15"), inline errors, and the tier badge (which uses footnote at 600).
- **Tab Label** (400, 11pt): tab bar labels only.

### Named Rules
**The Text Style Rule.** Size and weight come from `type.*`. A one-off weight change on a style is fine (selected segment 600, tier badge 600). A raw `fontSize` is not.

**The Tabular Count Rule.** Any number that changes in place (CountUp stats, the "3 / 12" pager counter) uses tabular figures so its width doesn't jitter.

## Layout

Single-column scroll screens with 20pt horizontal insets (Home, Closet, sheet content). The Add tab uses 24pt. Safe area is honored on the top edge, and the tab bar owns the bottom. Vertical rhythm: 10pt between stacked buttons and rows, 8pt between chips, 14pt inside rows and chips, 20pt between blocks, and 28pt before a new section. Home's stats are a three-up row of equal cards (`flex: 1`, 10pt gap). Closet is a two-column grid (12pt column gap, 22pt row gap) with a horizontally scrolling chip filter in the list header. Marquee rows bleed edge to edge (96pt × 108pt tiles, 10pt gap). Everything else respects the insets. The item sheet is a native `pageSheet` modal that pages horizontally, one full screen width per item.

## Elevation & Depth

The system is flat and tonal. No component ships a shadow or `elevation`. Depth is three tones: the grouped `background`, `card` above it, and `tile` for recessed or neutral wells. In dark mode the steps run black, then `#1C1C1E`, then `#2C2C2E`, which is how iOS shows elevation without shadows. System surfaces (page sheets, alerts, the tab bar) supply whatever depth iOS gives them natively.

### Named Rules
**The Tonal Depth Rule.** To lift something, move it one tone step up (background to card to tile). Don't add a shadow.

**The Floating Garment Rule.** A garment cutout is never boxed. It sits transparent on whatever surface holds it, at 92% of the frame. Only an image that still has its own background (a white generation or a photo crop) gets a 14pt-radius tile, at 84%, so the background looks intentional.

## Shapes

The geometry is continuous rounded rectangles plus capsules. Cards and full-width buttons share the 16pt `card` radius. Garment frames use 14pt `tile`, and notes and error boxes use 14pt too. Chips, filter pills, tier badges and small actions are full capsules (`pill`). The inner corners of the segmented control step down (track 10pt, selected segment 8pt). Text fields use 12pt. Circular controls are 36pt circles. Rows inside a card are divided by `hairlineWidth` rules in `separator`, and no row carries its own border. The progress bar is a 2pt line with 1pt ends.

## Components

### Buttons
Full-width, quietly tactile, unmistakably iOS.
- **Shape:** gently rounded rectangle (`rounded.card`, 16pt), 15pt × 20pt padding, centered Headline label, optional 18pt SF Symbol leading the label at an 8pt gap.
- **Primary:** `tint` fill with `on-tint` label. Use one per context (Take photo, Save, Add a piece).
- **Secondary:** `card` fill with a `tint` label, stacked 10pt under the primary (Choose from library, Cancel, Try again).
- **Pressed:** scales to 0.97 over 100ms on the strong ease-out, then springs back on release (speed 30, bounciness 4).
- **Disabled:** 50% opacity. The label may change to show progress ("Saving…").
- **Destructive action:** a `card` row with a centered Body label in `destructive` ("Remove from closet"). Removal always confirms through a native destructive `Alert`.
- **Text action:** a Body label in `tint` with hit slop ("Done").

### Chips
- **Style:** a capsule with 14pt horizontal and 7–8pt vertical padding, Subhead label, on a `card` fill. On Home a chip pairs the name in `label` with its count in `secondary-label`.
- **State:** a selected filter or pattern chip turns to a `tint` fill with an `on-tint` label and sets `accessibilityState.selected`. Home category chips use PressScale and route to Closet pre-filtered.
- **Small tile actions** ("Back", "Edit"): a `tile` capsule with a 15pt symbol, a 6pt gap, Footnote text and hit slop.

### Cards / Containers
- **Corner Style:** 16pt (`rounded.card`).
- **Background:** `card` on `background`.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none. Grouped rows inside a card are divided by hairline `separator` rules, and the first row has no rule.
- **Internal Padding:** 14pt on stats; 16pt horizontal on fact cards, with 12pt-tall row padding; the processing card has 24pt vertical padding.
- **Notes:** the retake note and error box are 14pt-radius wells with 12pt padding. Low tier and errors use `destructive-bg` with `destructive` text. Tips use `tile` with `secondary-label` text.

### Inputs / Fields
- **Style:** a `card` fill with no stroke, 12pt radius, 12pt × 14pt padding, Body text in `label`, and placeholder in `secondary-label`. Each field sits under a field label and carries an `accessibilityLabel`.
- **Color picker:** 34pt swatch circles, at a 10pt gap with hit slop to 44pt. Unselected swatches have a 1pt `separator-strong` ring. Selected swatches get a 2.5pt `label` ring and a 16pt checkmark (fixed ink on light swatches, white on dark ones). Role is `checkbox`.
- **Error:** inline Subhead or Footnote in `destructive` below the field group.

### Navigation
- **Tab bar:** three tabs (Home, Closet, Add) with SF Symbol icons (`house`, `square.grid.2x2`, `camera`). It has a `card` background, a `separator` top border, a 11pt label, `tint` when active and `secondary-label` when inactive. There are no navigation headers; each screen sets its own Large Title.
- **Item sheet:** a native `pageSheet` that you swipe down to dismiss and that pages horizontally between items. Its header has a tabular `secondary-label` counter ("3 / 12") and 36pt circular `tile` controls (Edit, Close) with hit slop. While editing, swipe-dismiss and paging are disabled, and closing asks "Discard changes?".
- **Segmented control:** the Front/Back switch is a `tile` track with 2pt inset and a `card` selected segment whose label goes to 600 weight. Switching sides crossfades the image.

### Tier Badge
A capsule with footnote/600 text in its tier pair (`tier-high`, `tier-medium`, `tier-low`), using 10pt × 3pt padding. It is the only place the tier colors appear.

### Processing Status
This is the wait state for 15–60s of server work. It shows a centered Headline stage name that advances on a timed script, a 2pt `tint` bar on a `separator` track at 70% width, and a Footnote note in `secondary-label`. The bar eases toward 90% over the estimate (`Easing.out(Easing.exp)`, 45s for a capture and 30s for a back photo) and never claims to be done. It has `accessibilityRole="progressbar"` labelled with the current stage. Under Reduce Motion the bar is hidden and only the stage text remains.

### Motion (signature)
Motion lives in `mobile/src/motion/`. Everything runs on the native driver.
- **Strong ease-out** `cubic-bezier(0.23, 1, 0.32, 1)` (`EASE_OUT`): the system's easing for press-in and entrances.
- **Rise:** content rises 12pt and fades from 0.4 to 1 over 320ms, with an optional delay. It starts nearly visible and never animates in from nothing. Closet staggers grid cells by 30ms, capped at 8 cells (240ms). A `distance={0}` Rise is a pure crossfade, used for the front/back switch and for entering edit mode.
- **PressScale:** every tappable card or garment scales to 0.97 over 100ms, then springs back (speed 30, bounciness 4).
- **Marquee:** endless linear drift of garment tiles, 18pt/s on the first row and 14pt/s reversed on the second. It repeats until one copy is wider than the screen, then wraps seamlessly. Touching a row pauses it.
- **CountUp:** a stat counts from 0 to its value over 600ms with a cubic ease-out, in tabular figures.
- **Haptics:** a success notification on save and remove, and a light impact is available. Failures are swallowed silently.
- **Reduce Motion** (`useReducedMotion`): reduced means gentler, not frozen. Rise drops its translate but keeps the 320ms fade. Marquee holds still. CountUp shows the final value. The processing bar is hidden.

## Do's and Don'ts

### Do:
- **Do** take every color from `colors.*` and add any new one as a light/dark pair that passes the 4.5:1 test in both palettes.
- **Do** set type with `type.*` text styles on the system font. Use tabular figures for counts.
- **Do** make every tappable element reach 44pt. Keep small controls their visual size and add `hitSlopFor(height, width)`. By default it pads height only, so pills in a row don't overlap.
- **Do** wrap tappable cards and garments in PressScale and enter new content with Rise (12pt, 320ms, from 0.4 opacity).
- **Do** gate every movement on `useReducedMotion`: drop translate, drift and count-up, and keep short fades.
- **Do** let garment cutouts float unboxed, and tile only images that keep their own background.
- **Do** use native iOS structures (page sheet, `Alert` for destructive confirmation, segmented control, tab bar, SF Symbols with an Ionicons fallback) rather than custom equivalents.
- **Do** give state-carrying controls an `accessibilityRole` and `accessibilityState` (selected, checked), and give icon-only controls an `accessibilityLabel`.

### Don't:
- **Don't** add a second accent hue. Blue means you can act; tier colors stay in the badge, and red stays with errors and removal.
- **Don't** add drop shadows to cards or buttons. Lift with a tone step.
- **Don't** set a raw `fontSize` or a custom font family.
- **Don't** put a box, border or tile behind a transparent garment cutout.
- **Don't** animate chrome for its own sake. Motion belongs to the garments and the collection.
- **Don't** start an entrance from zero opacity, or let any loop keep moving under Reduce Motion.
