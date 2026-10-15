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
- **Add Item flow confirmed:** Photo First → vision AI suggestion → Single Review/Edit Form → explicit Save Item → return to Wardrobe with new item visible and brief success message. No obligatory manual entry if AI identifies a valid category.

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
- After saving a new item, display it in the grid (reset the active category chip to **All** if needed), bring it into view, and show a brief non-blocking success message.

### 4. Add Item (confirmed: Photo First + AI-first + Single Form)
- Enter via the **Add** bottom-tab action; retain the three-tab navigation model.
- First show **Take Photo** and **Choose from Library**; handle permissions and cancellation.
- After selecting exactly one image, immediately show a preview and **Analyzing your item…** while a vision model suggests metadata.
- On the **single scrollable review screen**, present an editable Category (one of the nine predefined values), Color and optional Item Name. Brand may be suggested only if clearly supported by visible evidence; otherwise leave it blank. Notes is user-entered only.
- The user may replace the photo and manually edit or clear any optional suggestion; no obligatory typing when AI suggests a valid category.
- If the analysis fails/returns invalid data, show Retry + manual Category selection (category is required for saving, even though manual selection is not normally required).
- The user explicitly presses **Save Item**. Disabled until there is one image and a valid category. Prevent double-submit and keep the draft on upload/persistence errors.
- **After successful persistence:** reset the Add draft, switch to the Wardrobe tab, reveal the new item in the grid (choose All if a category filter would hide it), and display a short success message.
- Cancel/back requires appropriate draft-discard protection; exact cancellation behavior is not yet decided.

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

## Add Item entry decision (confirmed)
**Photo First** is approved. Tapping Add shows Take Photo / Choose from Library, and the item details form follows after an image has been chosen. Form First was not selected for MVP.

## Add Item completion layout (confirmed)
**Single Review/Edit Form** is approved. After Photo First and AI analysis, show one scrollable screen with image preview, editable AI suggestions and Save Item. No multi-step metadata wizard and no compulsory manual form completion when a valid category has been suggested.

## After Save Item decision (confirmed)
**Return to Wardrobe** is approved. On backend-confirmed success, display the new item in the Wardrobe grid and show a brief success message such as **"Item added to your wardrobe"**. If the previous filter would hide the item, set category filter to **All**. Ensure the item is visible (e.g. put newest first and scroll to it). Only then discard/reset the Add draft.

On save failure remain in the Add review screen, retain the image and edits, and show an actionable error/retry. Never show success prematurely or create duplicate items from repeated Save taps.

## Next UI decision: color palette (not yet approved)
Choose an accessible **Modern & Playful** palette (background/surface, primary accent, secondary accent, text and states). Avoid excessive accents; keep garment photos visually primary.

## Screen-level acceptance
- Users can locate Add Item and Account quickly from the persistent labeled bottom bar.
- Choosing a photo triggers AI analysis before the single review/edit form, and users can replace the selected image before saving.
- An AI-inferred category/color can be edited, and an AI failure still allows manual category selection and saving.
- On successful Save Item, return to Wardrobe, show the new item and a short success notice even if a filter was active. On failure, the Add draft remains editable and no success notice appears.
- No optional field is required to save a clothing item.
- Filter by any of the nine predefined categories.
- Only the signed-in user's wardrobe is visible.
- Verification, network failure, camera/photo permissions, upload failure, empty and delete-confirmation states are accounted for.

## Open screen questions
- Palette, typography and spacing tokens.
- Cancel/draft-discard behavior and precise success-message presentation.
- OTP code versus magic link as the primary verification method.
