# Product Requirements — Digital Wardrobe
Status: **Draft / for product review** · Updated: 2026-10-15

## Product vision
Give one person a reliable, beautiful visual inventory of clothing they already own, accessible on iPhone. Begin with inventory, not styling or commerce.

## Target user and outcome
Initial target: the product owner, using their own iPhone. Success is being able to photograph existing clothing and later find it quickly without opening the physical wardrobe.

## MVP scope
1. Private user sign-in (minimal authentication; implementation choice to confirm).
2. Add item from camera or photo library; preview and save.
3. Browse a photo-led, scrollable wardrobe grid.
4. Filter by category; optionally search by brand/color if easy.
5. Item details: photo, category, color, brand, notes and created date.
6. Edit metadata and delete item with confirmation.
7. Persist metadata and image in the cloud and reload after app restart.

## Primary journey
Open app → sign in → empty state → add item → choose/take photo → choose category (required) → optional color/brand/notes → save → item appears in grid → tap to view/edit/delete.

## Proposed categories (editable later)
Tops, bottoms, dresses/one-pieces, outerwear, shoes, accessories, other. Category labels may be localized.

## Non-goals for MVP
AI clothing identification, automatic cutouts/background removal, look/outfit generation, weather suggestions, sharing, purchasing, calendar, complex tagging, and multi-image items.

## Acceptance criteria
- Add via both supported image sources on a real iPhone.
- Clear permission/error states, including cancelled picker, upload failure and offline state.
- Saved entries appear after force quitting and reopening the app.
- Items are never visible to another authenticated user.
- Basic loading, empty, retry and delete-confirmation states work.
- No secrets or customer images are stored in Git.

## Open decisions
- Primary interface language: Hebrew, English, or both?
- Does MVP require authentication, or should first run be single-user with simple sign-in?
- Is one photo per item enough for V1?
- Is the initial catalog strictly personal, or should multiple accounts be supported soon?
- Visual direction and prioritization of optional brand/color fields.

## Product metrics (local/personal at first)
First item saved, number of saved items, successful save rate, time to find a garment. Do not add third-party analytics until needed and disclosed.
