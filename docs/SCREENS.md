# Screen Map — Digital Wardrobe MVP
Status: **Draft / screen planning** · Updated: 2026-10-15

## Confirmed context
- iPhone-first and English-only.
- Visual direction: **Modern & Playful**. Light surfaces, friendly rounded components, restrained playful accent colors, photo-first imagery and accessible text/controls. Detailed tokens are not finalized.
- Passwordless email authentication (OTP and/or magic link; exact verification UX TBD).
- Multiple accounts with isolated, private cloud wardrobes.
- One source photo required to begin. One **AI-generated full-garment catalog image** and category required to save; optional item name, color, brand and notes. The original is not shown as the wardrobe image.
- Nine predefined categories; category filtering is part of the MVP.
- **Home layout confirmed:** My Wardrobe shows a two-column photo grid plus horizontally scrollable filter chips (All + nine categories), with in-place filtering. Category-first browsing is not part of MVP.
- **Navigation confirmed:** persistent Bottom Navigation with **Wardrobe | Add | Account**. No floating add button or header-only Settings navigation.
- **Add Item flow confirmed:** Photo First → **AI generates isolated, fully laid-out garment image + suggests metadata** → Single Review/Edit Form using the generated image → explicit Save Item → Wardrobe shows generated image with success message.

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
- Each card: **generated wardrobe image** (never the original source photo) plus optional name (or category fallback).
- Empty wardrobe, empty filter, loading and retry states.
- After saving a new item, display it in the grid (reset the active category chip to **All** if needed), bring it into view, and show a brief non-blocking success message.

### 4. Add Item (confirmed: Photo First + AI-first + Single Form)
- Enter via the **Add** bottom-tab action; retain the three-tab navigation model.
- First show **Take Photo** and **Choose from Library**; handle permissions and cancellation.
- After choosing a source photo, display a clear **Generating your wardrobe image…** processing state while AI generates a new image of the garment laid out in full on a white/transparent background and suggests metadata.
- On the **single scrollable review screen**, prominently show the **generated garment image**, not the source photo. Present an editable Category (one of nine), Color and optional Item Name; Brand only if identifiable from visible evidence, Notes only if entered by user.
- The user can **Regenerate image** or **Retake/Choose Another Source Photo** and manually edit/clear any optional suggestion. Image completion of hidden regions may be approximate; display must be reviewed as a generated representation, not an exact reproduction.
- If metadata analysis fails, show Retry + manual Category selection. If **image generation fails**, show Retry/Retake and block Save until a generated representative image is available. Never silently switch to the unprocessed source as the item image.
- The user explicitly presses **Save Item** after seeing the generated result. Disabled until a **generated representative image** and a valid category are available. Prevent duplicate submits and retain the draft on failure.
- **After successful persistence:** reset the Add draft, switch to the Wardrobe tab, reveal the new item in the grid (choose All if a category filter would hide it), and display a short success message.
- Cancel/back requires appropriate draft-discard protection; exact cancellation behavior is not yet decided.

### 5. Item Details
- Large **generated representative garment image** (not source camera photo), category, optional metadata, created date.
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
**Single Review/Edit Form** is approved. After Photo First and AI-generated image/metadata processing, show one scrollable screen led by the **new generated catalog image**, editable AI suggestions, Regenerate/Retake and Save Item. No multi-step wizard or compulsory typing when a valid category is suggested.

## After Save Item decision (confirmed)
**Return to Wardrobe** is approved. On backend-confirmed success, display the new item in the Wardrobe grid and show a brief success message such as **"Item added to your wardrobe"**. If the previous filter would hide the item, set category filter to **All**. Ensure the item is visible (e.g. put newest first and scroll to it). Only then discard/reset the Add draft.

On save failure remain in the Add review screen, retain the image and edits, and show an actionable error/retry. Never show success prematurely or create duplicate items from repeated Save taps.

## Next UI decision: generated image background (not yet approved)
**Option A — White background:** Generate consistent full-length flat-lay garment images on a solid white background.
**Option B — Transparent background:** Generate isolated garment images with alpha transparency and use a consistent app card background.
Both preserve the requirement that AI creates the **full item representation** and does not show the source photo in the wardrobe.

## Other open visual decision
Choose an accessible **Modern & Playful** palette (background/surface, primary accent, secondary accent, text and states). Avoid excessive accents; keep generated garment photos visually primary.

## Screen-level acceptance
- Users can locate Add Item and Account quickly from the persistent labeled bottom bar.
- Choosing a source photo triggers AI image generation and metadata analysis before review; the user sees the generated full-garment preview and can regenerate or change the source before saving.
- An AI-inferred category/color can be edited. On metadata-only failure manual category selection allows saving **only if the generated image succeeded**; image-generation failures require Retry/Retake.
- On successful Save Item, return to Wardrobe, show the new item and a short success notice even if a filter was active. On failure, the Add draft remains editable and no success notice appears.
- No optional field is required to save a clothing item.
- Filter by any of the nine predefined categories.
- Only the signed-in user's wardrobe is visible.
- Verification, network failure, camera/photo permissions, upload failure, empty and delete-confirmation states are accounted for.

## Open screen questions
- White vs transparent generated-image background; generation output quality and user re-generation controls.
- Palette, typography and spacing tokens.
- Cancel/draft-discard behavior and precise success-message presentation.
- OTP code versus magic link as the primary verification method.
