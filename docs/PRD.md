# Product Requirements — Digital Wardrobe
Status: **Draft / for product review** · Updated: 2026-10-15

## Product vision
Give each registered user a reliable, beautiful, private visual inventory of clothing they already own, accessible on iPhone. Begin with inventory, not styling or commerce.

## Target user and outcome
Initial target: the product owner plus a small group of other testers, each with their own account and private wardrobe. Success is being able to photograph existing clothing and later find it quickly without opening the physical wardrobe.

## MVP scope
1. Authentication is required from V1 using passwordless email sign-in (email OTP and/or magic link). The user signs into a personal account before accessing their private cloud wardrobe.
2. Add an item with exactly one primary photo from the camera or photo library; preview and save.
3. Browse all clothing in My Wardrobe using a two-column, photo-led, scrollable grid.
4. Filter the same grid with a horizontally scrollable row of category chips: All (default) plus the nine predefined categories. Selecting a chip filters the grid in place, without navigating to another screen.
5. Item details: photo and category (required), plus item name, color, brand and notes (optional); show the automatically recorded creation date.
6. Edit metadata and delete item with confirmation.
7. Persist metadata and image in the cloud and reload after app restart.

## Clothing item fields (confirmed for MVP)
**Required:** Photo (exactly one per item), Category (exactly one of the nine predefined categories).

**Optional:** Item Name (free text), Color, Brand, Notes (free text).

Item creation must not require the user to fill any optional field. A missing name must not block listing or viewing an item; the UI may fall back to the category as a label. Size, Season, custom tags and other clothing attributes are outside MVP. Item ID, owner ID and timestamps are system-managed rather than user-entered fields.

## Item photography
**Decision: One photo per clothing item in MVP.** The user can take or select one image per item, see a preview, and replace it when editing the item. A multi-image gallery, back/detail shots and additional photo slots are out of scope for V1. The data architecture should allow a later expansion to multiple images without disrupting the item catalog.

## Add Item experience (confirmed: Photo First)
- Tapping the **Add** bottom tab first presents two photo-source actions: **Take Photo** and **Choose from Library**.
- After capturing or selecting one photo, show a preview, a required Category selector, and optional Item Name, Color, Brand and Notes.
- Users can retake or replace the photo before saving; the app requests camera/photo permissions only when needed.
- Save is enabled only after a photo and a category are selected. Handle cancelled selection, denied permission, upload failure and retries without silently losing entered information.
- The choice between showing all metadata on one screen versus step-by-step entry remains open, along with precise save/cancel transitions.

## Primary journey
Open app → sign in → My Wardrobe → tap Add → Take Photo / Choose from Library → see photo preview → choose category (required) → optionally enter name/color/brand/notes → save → new item appears in Wardrobe → tap to view/edit/delete.

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

## Visual design direction (confirmed)
**Modern & Playful** is the visual identity for V1. Prioritize a friendly, contemporary fashion-catalog feel rather than a strictly minimal or luxury editorial aesthetic:
- Image-led, uncluttered wardrobe browsing; garment photography stays the focus.
- Soft, light neutral surfaces with a restrained set of lively accent colors (exact palette TBD).
- Rounded cards, controls, and category chips; inviting micro-interactions with accessible motion.
- Clear English typography, readable contrast, consistent spacing, generous iPhone touch targets.
- Avoid decorative UI that slows down adding or finding a garment.

The concrete palette, type scale and component specifications remain open. **Bottom Navigation with Wardrobe, Add and Account is confirmed for V1.** See [Screen map](SCREENS.md).

## My Wardrobe home (confirmed)
- The authenticated landing screen is **My Wardrobe**.
- Show a two-column photo grid of the user's own clothing items, using Modern & Playful rounded item cards.
- Provide a horizontally scrollable category-filter chip row: **All** selected by default, then the nine predefined categories.
- Only one category chip is active at a time. Selecting another category updates the existing grid in place (no category-specific sub-screen).
- Each clothing card prioritizes the photo and may show an optional item name, falling back to its category if no name was entered.
- Provide helpful empty-wardrobe and empty-filter states, including an obvious way to add an item.
- A persistent bottom navigation provides **Wardrobe**, **Add**, and **Account** destinations. Wardrobe is the landing tab; Add opens the item creation flow; Account contains account information and sign-out.
- Exact theme colors, one-form versus step-by-step metadata layout, Add-screen behavior on cancel/save, and sorting remain UI details to finalize. See [Screen map](SCREENS.md).

## Primary navigation (confirmed)
- Use a **bottom tab bar** with three clearly labeled entries in this order: **Wardrobe | Add | Account**.
- **Wardrobe** displays the two-column catalog and horizontal category chips. It is the default authenticated destination.
- **Add** is the primary entry point for creating a clothing item, with a photo and category required.
- **Account** contains signed-in user information and sign-out, replacing the proposed header-only Settings destination.
- Item Details and Edit Item are secondary screens accessible from Wardrobe; they do not receive new bottom tabs.
- The precise navigation implementation of the Add flow (tab screen versus modal launched from the central action), cancellation and save transitions remain to be refined in screen design.

## Non-goals for MVP
AI clothing identification, automatic cutouts/background removal, look/outfit generation, weather suggestions, sharing, purchasing, calendar, complex tagging, and multi-image items.

## Acceptance criteria
- Add via both supported image sources on a real iPhone; enforce one photo and one category per item, support replacing the photo, and allow all optional metadata fields to be left empty.
- Clear permission/error states, including cancelled picker, upload failure and offline state.
- Saved entries appear after force quitting and reopening the app, and after signing back into the same account.
- Test with at least two separate accounts: neither can read, change, delete, or retrieve the other's wardrobe records or private photos.
- Sign-in and sign-out work with email verification; sessions remain signed in across app restarts unless signed out or expired.
- My Wardrobe loads as a two-column grid with All selected by default; a category chip filters in place and returns only matching items, without changing screens.
- A persistent bottom bar provides labeled Wardrobe, Add and Account destinations; users can reach item creation and account/sign-out without a floating add button or header-only settings navigation.
- On the Add tab, the first action is choosing Take Photo or Choose from Library; only after a photo is chosen is the item detail form presented with a single-photo preview.
- Basic loading, empty, retry and delete-confirmation states work.
- No secrets or customer images are stored in Git.

## Open decisions
- Exact visual palette, component specifications, one-form versus step-by-step Add Item details, and save/cancel transitions (see [Screen map](SCREENS.md)).
- Whether the login UX should prioritize email code, magic link, or both.

## Product metrics (small beta cohort initially)
First item saved, number of saved items, successful save rate, time to find a garment. Do not add third-party analytics until needed and disclosed.
