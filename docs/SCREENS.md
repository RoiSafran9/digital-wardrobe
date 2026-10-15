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
- Top title and entry point to Settings.
- **Confirmed:** two-column photo grid with rounded cards, showing the user's clothing across categories.
- **Confirmed:** horizontally scrollable category-filter chips: All (default) plus each of the nine categories. One chip is active at a time; selection filters the existing grid without opening another category screen.
- Primary **Add Item** action always easy to reach.
- Each card: photo plus optional name (or category fallback).
- Empty wardrobe, empty filter, loading and retry states.

### 4. Add Item
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

### 7. Account / Settings
- Show signed-in account email.
- Sign out.
- Basic app information; no social, billing or advanced settings in MVP.

## Proposed information architecture
- Sign-in flow shown only without a valid session.
- Authenticated landing screen: **My Wardrobe**.
- Add Item and Item Details/Edit reached from My Wardrobe.
- Account / Settings reachable from a header action or a dedicated navigation tab (not yet decided).
- Avoid onboarding slides, extra tabs and post-MVP AI surfaces.

## Home browsing decision (confirmed)
**Photo Grid + Filter Chips** is approved. The category-first home proposal is rejected for MVP. Users arrive at My Wardrobe with All selected, browse a two-column image grid, and filter that grid directly through the horizontally scrollable category chips.

## Next UI decision: primary navigation (not yet approved)
**Option A — Floating Add Item action + header Settings:** One main wardrobe screen with a prominent floating Add action, and Settings accessed from an unobtrusive header icon. Detail, add and edit flows are pushed/modal screens.

**Option B — Bottom navigation:** Persistent navigation bar with Wardrobe, Add, Account. Clear destinations but uses more vertical screen space.

Both preserve the approved two-column grid, category chips, all existing MVP functionality and privacy requirements.

## Screen-level acceptance
- Users can locate Add Item quickly from the wardrobe.
- No optional field is required to save a clothing item.
- Filter by any of the nine predefined categories.
- Only the signed-in user's wardrobe is visible.
- Verification, network failure, camera/photo permissions, upload failure, empty and delete-confirmation states are accounted for.

## Open screen questions
- Primary navigation: floating Add + header Settings, or bottom navigation with Wardrobe/Add/Account.
- Palette, typography and spacing tokens.
- OTP code versus magic link as the primary verification method.
