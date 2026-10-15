# Product Requirements — Digital Wardrobe
Status: **Draft / for product review** · Updated: 2026-10-15

## Product vision
Give each registered user a reliable, beautiful, private visual inventory of clothing they already own, accessible on iPhone. Begin with inventory, not styling or commerce.

## Target user and outcome
Initial target: the product owner plus a small group of other testers, each with their own account and private wardrobe. Success is being able to photograph existing clothing and later find it quickly without opening the physical wardrobe.

## MVP scope
1. Authentication is required from V1 using passwordless email sign-in (email OTP and/or magic link). The user signs into a personal account before accessing their private cloud wardrobe.
2. Add an item with exactly one primary photo from the camera or photo library; preview and save.
3. Browse a photo-led, scrollable wardrobe grid.
4. Filter by category; optionally search by brand/color if easy.
5. Item details: photo and category (required), plus item name, color, brand and notes (optional); show the automatically recorded creation date.
6. Edit metadata and delete item with confirmation.
7. Persist metadata and image in the cloud and reload after app restart.

## Clothing item fields (confirmed for MVP)
**Required:** Photo (exactly one per item), Category (exactly one of the nine predefined categories).

**Optional:** Item Name (free text), Color, Brand, Notes (free text).

Item creation must not require the user to fill any optional field. A missing name must not block listing or viewing an item; the UI may fall back to the category as a label. Size, Season, custom tags and other clothing attributes are outside MVP. Item ID, owner ID and timestamps are system-managed rather than user-entered fields.

## Item photography
**Decision: One photo per clothing item in MVP.** The user can take or select one image per item, see a preview, and replace it when editing the item. A multi-image gallery, back/detail shots and additional photo slots are out of scope for V1. The data architecture should allow a later expansion to multiple images without disrupting the item catalog.

## Primary journey
Open app → sign in → empty state → add item → choose/take photo → choose category (required) → optionally enter item name/color/brand/notes → save → item appears in grid → tap to view/edit/delete.

## Authentication and account model
**Decision: Authentication and multiple independent user accounts are required in V1.** Each registered user gets a distinct private, cloud-backed wardrobe. A returning user must be able to sign in and recover their wardrobe on a compatible iPhone. Users can only view, create, edit, and delete their own items and photos. No wardrobe sharing or social features in MVP.

**Sign-in decision:** passwordless email authentication using **email OTP and/or magic link** (implemented with Supabase Auth). Users enter an email address and verify ownership with a time-limited code or email link. Sign in with Apple and password-based sign-in are not part of the MVP. The exact choice of code, link, or both in the UI will be finalized during implementation. Support session persistence and sign-out.

## Language and localization
The MVP interface is **English-only**. Use English for screen titles, navigation labels, category names, forms, and user-facing messages. Additional languages are out of scope for V1.

## Clothing categories (confirmed for MVP)
The MVP has exactly these **nine predefined categories**, shown in English in the category picker and wardrobe filters:

1. T-Shirts
2. Shirts
3. Sweaters & Hoodies
4. Pants
5. Shorts
6. Jackets & Coats
7. Shoes
8. Accessories
9. Dresses & Skirts

Each clothing item belongs to one of these categories. Categories are fixed in MVP; user-created categories and subcategories may be explored after V1.

## Non-goals for MVP
AI clothing identification, automatic cutouts/background removal, look/outfit generation, weather suggestions, sharing, purchasing, calendar, complex tagging, and multi-image items.

## Acceptance criteria
- Add via both supported image sources on a real iPhone; enforce one photo and one category per item, support replacing the photo, and allow all optional metadata fields to be left empty.
- Clear permission/error states, including cancelled picker, upload failure and offline state.
- Saved entries appear after force quitting and reopening the app, and after signing back into the same account.
- Test with at least two separate accounts: neither can read, change, delete, or retrieve the other's wardrobe records or private photos.
- Sign-in and sign-out work with email verification; sessions remain signed in across app restarts unless signed out or expired.
- Basic loading, empty, retry and delete-confirmation states work.
- No secrets or customer images are stored in Git.

## Open decisions
- Visual direction (layout, typography, colors, navigation).
- Whether the login UX should prioritize email code, magic link, or both.

## Product metrics (small beta cohort initially)
First item saved, number of saved items, successful save rate, time to find a garment. Do not add third-party analytics until needed and disclosed.
