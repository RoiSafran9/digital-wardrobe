# Product Requirements — Digital Wardrobe
Status: **Draft / for product review** · Updated: 2026-10-15

## Product vision
Give one person a reliable, beautiful visual inventory of clothing they already own, accessible on iPhone. Begin with inventory, not styling or commerce.

## Target user and outcome
Initial target: the product owner, using their own iPhone. Success is being able to photograph existing clothing and later find it quickly without opening the physical wardrobe.

## MVP scope
1. Authentication is required from V1: the user signs into a personal account before accessing their private cloud wardrobe (exact sign-in method TBD).
2. Add an item with exactly one primary photo from the camera or photo library; preview and save.
3. Browse a photo-led, scrollable wardrobe grid.
4. Filter by category; optionally search by brand/color if easy.
5. Item details: photo, category, color, brand, notes and created date.
6. Edit metadata and delete item with confirmation.
7. Persist metadata and image in the cloud and reload after app restart.

## Item photography
**Decision: One photo per clothing item in MVP.** The user can take or select one image per item, see a preview, and replace it when editing the item. A multi-image gallery, back/detail shots and additional photo slots are out of scope for V1. The data architecture should allow a later expansion to multiple images without disrupting the item catalog.

## Primary journey
Open app → sign in → empty state → add item → choose/take photo → choose category (required) → optional color/brand/notes → save → item appears in grid → tap to view/edit/delete.

## Authentication and account model
**Decision: Authentication is required in V1**, with a personal account and a private, cloud-backed wardrobe. A returning user must be able to sign in and recover their wardrobe on a compatible iPhone. All wardrobe records and photos are scoped to the authenticated owner. Authentication provider and sign-in UX are still to be decided.

## Language and localization
The MVP interface is **English-only**. Use English for screen titles, navigation labels, category names, forms, and user-facing messages. Additional languages are out of scope for V1.

## Proposed categories (editable later)
Tops, bottoms, dresses/one-pieces, outerwear, shoes, accessories, other. Category labels may be localized.

## Non-goals for MVP
AI clothing identification, automatic cutouts/background removal, look/outfit generation, weather suggestions, sharing, purchasing, calendar, complex tagging, and multi-image items.

## Acceptance criteria
- Add via both supported image sources on a real iPhone; enforce one photo per item and support replacing that photo.
- Clear permission/error states, including cancelled picker, upload failure and offline state.
- Saved entries appear after force quitting and reopening the app, and after signing back into the same account.
- Items are never visible to another authenticated user.
- Basic loading, empty, retry and delete-confirmation states work.
- No secrets or customer images are stored in Git.

## Open decisions
- Which sign-in experience for V1: email magic link/OTP, Sign in with Apple, or both?
- Is the initial catalog strictly personal, or should multiple accounts be supported soon?
- Visual direction and prioritization of optional brand/color fields.

## Product metrics (local/personal at first)
First item saved, number of saved items, successful save rate, time to find a garment. Do not add third-party analytics until needed and disclosed.
