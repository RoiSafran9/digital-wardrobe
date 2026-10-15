# Screen Map — Digital Wardrobe MVP
Status: **Draft / screen planning** · Updated: 2026-10-15

## Confirmed context
- iPhone-first and English-only.
- Visual direction: **Modern & Playful**. Light surfaces, friendly rounded components, restrained playful accent colors, photo-first imagery and accessible text/controls. Detailed tokens are not finalized.
- Passwordless email authentication (OTP and/or magic link; exact verification UX TBD).
- Multiple accounts with isolated, private cloud wardrobes.
- One required photo and one required category per item; optional item name, color, brand and notes.
- Nine predefined categories; category filtering is part of the MVP.
- **Home layout confirmed:** My Wardrobe shows a two-column photo grid plus horizontally scrollable filter chips (All + nine categories), with in-place filtering. Category-first browsing is not part of MVP.
- **Navigation confirmed:** persistent Bottom Navigation with **Wardrobe | Add | Account**. No floating add button or header-only Settings navigation.

## Proposed screens (for review, not yet approved)

### 1. Sign In
- Clear brand identity and a single email input with Continue.
- Explain that an email code or link will arrive.
- Show basic email validation and network/retry feedback.

### 2. Verify Email
- Enter email code and/or follow a magic link (decide during implementation).
- Resend, change email and recovery from invalid/expired verification.
- On success, enter private wardrobe.

### 3. My Wardrobe (home)
- Title **My Wardrobe**; Account is accessed through the bottom navigation rather than a header Settings icon.
- **Confirmed:** two-column photo grid with rounded cards, showing the user's clothing across categories.
- **Confirmed:** horizontally scrollable category-filter chips: All (default) plus each of the nine categories. One chip is active at a time; selection filters the existing grid without opening another category screen.
- **Add** is always available as the center bottom-tab action.
- Each card: photo plus optional name (or category fallback).
- Empty wardrobe, empty filter, loading and retry states.

### 4. Add Item (bottom navigation destination)
- Enter via the **Add** bottom-tab action; retain the three-tab navigation model.
- Start with photo source: Take Photo or Choose from Library.
- Preview exactly one selected image; allow retake/reselect.
- Required category selector; optional Item Name, Color, Brand, Notes.
- Save action with uploading/loading/error feedback.
- Cancel/back with unsaved-change protection when needed.

### 5. Item Details
- Large photo, category, optional metadata, created date.
- Edit and Delete actions; confirm destructive deletion.
- Graceful display when optional fields are absent.

### 6. Edit Item
- Reuse the add/edit form components.
- Change category and optional fields, or replace the single photo.
- Save, cancel, loading, error feedback.

### 7. Account (bottom navigation destination)
- Open from the **Account** bottom tab; do not rely on header Settings.
- Show signed-in account email.
- Sign out.
- Basic app information; no social, billing or advanced settings in MVP.

## Information architecture (primary navigation confirmed)
- Sign-in and email verification are shown without a valid session, outside the authenticated tab navigator.
- After successful authentication, show the **Wardrobe** tab by default.
- Authenticated bottom tabs, in order: **Wardrobe | Add | Account**.
- **Wardrobe**: photo-grid catalog and category filter chips; tapping an item opens Item Details and then Edit Item.
- **Add**: entry into Add Item photo selection and form flow.
- **Account**: account email, sign out and simple app information.
- Item Details/Edit are secondary screens, not additional bottom tabs.
- Avoid onboarding slides, extra tabs and post-MVP AI surfaces.

## Home browsing decision (confirmed)
**Photo Grid + Filter Chips** is approved. The category-first home proposal is rejected for MVP. Users arrive at My Wardrobe with All selected, browse a two-column image grid, and filter that grid directly through the horizontally scrollable category chips.

## Primary navigation decision (confirmed)
**Bottom Navigation: Wardrobe | Add | Account** is approved. The floating Add button plus header-only Settings alternative is not used in MVP.

The tab bar should use clear icons and readable English labels, accommodate iPhone safe areas and maintain appropriate touch targets.

## Next UI decision: Add Item workflow (not yet approved)
**Option A — Photo First (recommended):** Opening Add offers camera or photo library first; after selecting an image, show the category and optional metadata form with a preview.

**Option B — Form First:** Opening Add shows a form with required empty photo and category slots immediately; the user may choose when to add a photo.

Both require one photo and one category before saving, with optional Item Name, Color, Brand and Notes.

## Screen-level acceptance
- Users can locate Add Item and Account quickly from the persistent labeled bottom bar.
- No optional field is required to save a clothing item.
- Filter by any of the nine predefined categories.
- Only the signed-in user's wardrobe is visible.
- Verification, network failure, camera/photo permissions, upload failure, empty and delete-confirmation states are accounted for.

## Open screen questions
- Add Item workflow: photo-first versus form-first, and save/cancel transitions.
- Palette, typography and spacing tokens.
- OTP code versus magic link as the primary verification method.
