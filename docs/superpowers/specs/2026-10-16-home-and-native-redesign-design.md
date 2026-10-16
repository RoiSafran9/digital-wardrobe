# Home Screen + Native iOS Redesign — Design

## Context

The app works end to end (capture → catalog image → closet, back views, edit/delete, dark mode). Its look is
"editorial light": cream paper, Fraunces serif titles. The owner asked for a design that is more innovative and
immersive, and for a home screen that opens by default.

An impeccable direction round offered a rolled world (Woven Label), a pick (Dry-Cleaner Conveyor), a challenger
(Cutting Bench Rail) and the category standard. **The owner chose the category standard**, and asked that motion
and immersion run **throughout the app**. No benchmark apps were named, so the bar is native iOS craft (Apple
Photos / Wallet level) next to the leading closet apps.

This replaces the editorial world; it does not polish it. Product truth (PRODUCT.md) stays: garment fidelity,
no paid calls or waiting for nothing, the owner stays in control.

## Decisions

- **World:** the category standard, executed at full fidelity. System font (SF Pro) for all text, iOS grouped
  backgrounds, white/elevated cards with 16pt corners, one blue tint for interactive elements. Fraunces and the
  cream paper are removed.
- **Immersion through motion, not decoration:** the garments move; chrome stays still and clean. Motion runs on
  the UI thread (react-native-reanimated, bundled in Expo Go) and always honors Reduce Motion.
- **Tabs:** Home (default) · Closet · Add. Home is new; "Just added" moves from Closet to Home.
- **Dark mode** stays first-class: every token keeps a light and dark value (DynamicColorIOS), contrast tests
  cover both.
- **Garment fidelity:** no tints, filters or glows on garment images. Cutouts sit on a neutral tile.

## Visual system

| Token | Light | Dark |
|---|---|---|
| background (grouped) | `#F2F2F7` | `#000000` |
| card / elevated | `#FFFFFF` | `#1C1C1E` |
| garment tile | `#F5F5F7` | `#2C2C2E` |
| label | `#000000` | `#FFFFFF` |
| secondary label | `#3C3C43` @ 60% → solid `#6C6C70` | `#AEAEB2` |
| separator | `#E5E5EA` | `#38383A` |
| tint (actions) | `#2563EB` | `#4C8DFF` |
| destructive | `#D70015` | `#FF6961` |

Type: SF Pro via the system font, iOS text styles (Large Title 34 bold, Title 2 22 semibold, Headline 17
semibold, Body 17, Subheadline 15, Footnote 13). Numbers in stats use tabular figures.

Shapes: cards 16pt radius, tiles 14pt, pills fully rounded; soft shadow only on floating elements
(offset 0/8, blur 24, 8% opacity light / none dark).

## Home screen (new, default tab)

Top to bottom:

1. **Large title** "Wardrobe" with a one-line context under it ("38 pieces · 4 added this week").
2. **Running garments:** two rows of recent garment cutouts on tiles, scrolling slowly in opposite directions
   (marquee). Touch pauses them; tapping a garment opens its item sheet. Reduce Motion: static rows.
3. **Stats row:** three tiles — Pieces, Categories, Colors — numbers count up on first appearance.
4. **Quick add:** two large buttons, "Take photo" (primary, tint) and "Choose from library", that start the
   capture flow directly from Home (no detour through the Add tab).
5. **Just added:** the latest capture's pieces (moved from Closet), with the "+ Back" action per piece and the
   staged processing status while a capture runs.
6. **By category:** horizontal chips with counts ("T-shirts 12"); tapping opens Closet filtered to it.

Empty closet: the running rows become a single friendly empty state with the two add buttons.

## Motion grammar (throughout)

- **Entrances:** content rises 12pt and fades in with a spring (damping high, no visible bounce); lists stagger
  30ms, capped.
- **Press:** every tappable card/tile scales to 0.97 on press-in (100ms), springs back.
- **Item sheet:** garment image does a slight scale-in (0.96 → 1) as the sheet opens; front/back swap crossfades.
- **Marquee:** constant slow linear drift, never faster than ~20pt/s.
- **Counters:** stats count up over 600ms with ease-out.
- **Haptics:** light impact on add/save/delete success (expo-haptics, bundled in Expo Go).
- **Reduce Motion:** fades only; marquee and count-up are static.

## Other screens (restyled into the world)

- **Closet:** iOS large title, segmented-style category filter (scrollable chips), 2-column grid of garment
  tiles (cutout on tile, name + colors below), pull to refresh. Opening an item and swiping between items stay.
- **Add:** the capture screen in the new world; tips become an inset grouped list; staged processing stays.
- **Item sheet:** grouped inset list for facts (Colors, Pattern, Details, Text), Front/Back as a segmented
  control, Edit in the nav bar, destructive "Remove from Closet" as the last grouped row.

## Architecture

- `src/theme.ts`: new token set (light/dark) replacing the editorial palette; type scale; contrast tests updated.
- `src/components/motion/`: `Rise` (entrance), `Pressable scale` wrapper, `Marquee`, `CountUp` — Reanimated,
  each honoring Reduce Motion.
- `app/index.tsx` becomes **Home**; capture moves to `app/add.tsx`; `_layout.tsx` tab order Home · Closet · Add.
- Capture logic (`pickAndUpload`) moves into a `useCapture` hook so Home and Add share it.
- `JustAdded` moves to Home unchanged in behavior.
- Closet filter can be preset via a route param (`/closet?category=T-shirt`) for the Home category chips.
- New dependencies (all bundled in Expo Go): `react-native-reanimated`, `react-native-worklets`, `expo-haptics`.
- Removed: `@expo-google-fonts/fraunces`, Fraunces font loading.

## Testing

- Theme: contrast ≥ 4.5:1 for label/secondary/tint/destructive on background and card, both palettes.
- Home: renders counts from the closet, recent garments, category chips with counts; empty state; quick-add
  starts capture; category chip navigates with the filter param.
- Closet: honors the category route param.
- Motion components: render children; Reduce Motion path is static (no transforms).
- Existing suites (capture flow, item sheet, edit guard, back, just added) keep passing after the moves.

## Out of scope

- New features beyond Home (outfits, 360 models, accounts).
- Shared-element transitions between grid and sheet (RN Modal can't host them without a navigation rewrite).
- Custom fonts.
