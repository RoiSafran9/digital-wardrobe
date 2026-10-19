# Change request: Home screen redesign + photo-type clarity

## Why
On the current Home screen, the "Take Photo" and "From Library" shortcuts only work for **garment photos** (clothes laid flat or on a hanger). The screen doesn't say so. Users who pick a photo of themselves **wearing an outfit** end up in the wrong flow, and generation fails.

## Rule (applies app-wide)
Every entry point that asks for a photo must say which kind of photo it expects:
- **Garment photo** (flat lay or hanger) → Flow A (garment pipeline)
- **Outfit photo** (person wearing it) → Flow B (outfit detection → select pieces)

Never show a generic "Take Photo / From Library" pair without a label for the photo type.

## Scope
1. Home screen (has items): new layout, below.
2. Home empty state: replace the two generic buttons.
3. Check every other photo entry point (Closet empty state, onboarding CTA, any FAB) against the rule above.

Follow the repo's `CLAUDE.md`, `DESIGN.md` and docs. If business rules (credit costs, routes) conflict with this doc, the repo wins.

## Home: layout (top to bottom)
Screen padding 20 (cards 16). Tab bar visible.

1. **Header** (unchanged): date eyebrow 13/600 uppercase, tracking .05em, ink2. Greeting "Good morning,\nMaya" in Instrument Serif 42/1.02. Credit pill top-right (fill bg, 8pt accent dot, balance 14/600) → Account.
2. **Search field**: 44pt tall, radius 12, `fill` bg, magnifier icon + placeholder "Search {N} pieces" (ink3, 16). Tapping it goes to Closet with search focused. Top margin 22.
3. **Eyebrow "ADD TO CLOSET"**: 13/600 uppercase, ink2. Padding 26 top, 10 bottom.
4. **Two tiles side by side** (2-column grid, gap 10). Each tile: `bg2`, radius 22, overflow hidden.
   - Image area 130pt, `tile` bg. Small tag bottom-left: mono 10/600, tracking .06em, ink2, on `card` bg, padding 4×6, radius 6.
   - Body padding 12, gap 10. Title 15/700 + caption 12.5/1.3 ink2. Buttons sit at the bottom (equal tile heights).
   - **Tile 1: Garments.** Tag `FLAT LAY`. Image: 2–3 garments laid flat. Caption "Each piece becomes an item". Buttons (2 columns, gap 6, 36pt, radius 11, 13/600):
     - **Camera** (accent bg, white) → Flow A camera
     - **Library** (`card` bg, ink) → system photo picker → Flow A preview & cost
   - **Tile 2: Outfit photo.** Tag `WORN`. Image: full-body photo with dashed accent boxes around the detected pieces. Caption "We find each piece you wear". One button **Choose Photo** (`card` bg) → Flow B photo picker.
5. **Eyebrow "YOUR CLOSET"**: padding 28 top, 6 bottom.
6. **Category list**: one row per category with items. Row: 48×58 thumbnail (radius 12, first item in that category), name 17/500, count 15 ink3, chevron ›, hairline bottom border, vertical padding 10. Tap → Closet filtered to that category.

Removed from the old Home: marquee, stats row, the "Digitize clothes" card, "Recently Added", category pills.

## Home: empty state
Keep the dashed-frame illustration, the title "Your closet starts here" and the body text. Replace the two buttons with two labelled rows (white `card` bg, radius 16, padding 12/14, gap 10):
- **Garment photo** / "Laid flat or on a hanger": [Camera] (accent pill, 34pt) [Library] (fill pill)
- **Outfit photo** / "You wearing it": [Choose Photo] (fill pill)

Keep the 3 numbered tips below.

## Behavior notes
- Garment Library and Outfit Choose Photo both open the system picker but go to **different flows**. Keep the flow type in the navigation params so you never have to guess it later.
- Optional safeguard: if detection in Flow A finds a person or a full-body outfit, show "Looks like an outfit photo. Switch to outfit import?" with a button that moves the same image into Flow B. Detection is free, so this costs nothing.
- Camera screen already has a GARMENTS / OUTFIT mode switch. Make sure OUTFIT mode really routes to Flow B.
- Dark mode: use the same tokens (`bg2`, `tile`, `card`, `fill`, `accent`, `ink2/3`, `line`) as in README.md.
- Accessibility: tiles should read as "Add garments, flat lay photo, Camera, Library" and "Add from outfit photo, Choose photo".

## Reference
- Prototype: open `Digital Wardrobe.dc.html` → sidebar "Home dashboard" (new default) and "Empty state". "Alt A" / "Alt B" are rejected alternatives. Don't build them.
- Full spec: `README.md` → Home section.

## Done when
- [ ] Home matches the layout above in light and dark mode
- [ ] Each photo button routes to the correct flow (garment vs outfit)
- [ ] Empty state uses the labelled rows
- [ ] No generic, unlabelled "Take Photo / From Library" pair left anywhere in the app
