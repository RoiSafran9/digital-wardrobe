# Product Requirements — Digital Wardrobe
Status: **Draft / for product review** · Updated: 2026-10-15

## Product vision
Give each registered user a reliable, beautiful, private **visual catalog of clean, AI-generated garment representations**, based on photos of their actual clothes and accessible on iPhone. Begin with inventory, not styling or commerce.

## Target user and outcome
Initial target: the product owner plus a small group of other testers, each with their own account and private wardrobe. Success is being able to photograph existing clothing and later find it quickly without opening the physical wardrobe.

## MVP scope
1. Authentication is required from V1 using passwordless email sign-in (email OTP and/or magic link). The user signs into a personal account before accessing their private cloud wardrobe.
2. Add an item by taking/selecting a source photo. AI **generates a new normalized garment image** (full item laid flat, isolated on a **solid pure-white background**) and extracts/editably suggests metadata. The generated image, **not the source camera photo**, represents the item throughout the wardrobe.
3. Browse all clothing in My Wardrobe using a two-column, photo-led, scrollable grid.
4. Filter the same grid with a horizontally scrollable row of category chips: All (default) plus the nine predefined categories. Selecting a chip filters the grid in place, without navigating to another screen.
5. Item details: **generated wardrobe image** and category (required), plus item name, color, brand and notes (optional); show the automatically recorded creation date. AI suggests category, color and descriptive name, and only a reliably visible brand; notes remain user-entered.
6. Edit metadata and delete item with confirmation.
7. Persist metadata, the **private original source photo**, and the separate **AI-generated catalog image** in the cloud, with each belonging exclusively to the signed-in user. Restore the catalog after app restart.

## Clothing item fields (confirmed for MVP)
**Required:** One user-provided **source photo** and one **AI-generated normalized display image** are stored separately for every saved item, plus one category (from the nine predefined values). The source photo is *not* the catalog/display image.

**Optional:** Item Name (free text), Color, Brand, Notes (free text).

**User input required:** one clothing source photo. **Saved data required:** one generated full-garment image plus a valid category, normally inferred by AI but manually correctable. All other fields may be blank. AI suggestions must be editable before saving and after saving. A missing name must not block listing or viewing an item; the UI may fall back to its category. Size, Season, custom tags and other clothing attributes are outside MVP. Item ID, owner ID and timestamps are system-managed rather than user-entered fields.

## Wardrobe imagery (confirmed MVP requirement)
- A user **photographs or selects the actual clothing item**. That image is the **input/reference**, not the wardrobe image.
- AI **generates a distinct, standardized image of the garment** laid out neatly and visible in its entirety, isolated against a **uniform solid white (#FFFFFF) background**, not transparent. The full garment must be in frame with breathing room around its edges; avoid hands, hangers, mannequins, props, clutter, background gradients or colored backdrops.
- The AI may **infer/complete obscured or folded parts** to produce a full garment silhouette. Preserve the observed garment's actual color, print, fabric appearance, cut and distinctive details as faithfully as possible. Do not invent logos, patterns, tags, branded details or visible embellishments.
- The generated image is the **only primary image shown in the Wardrobe grid and Item Details**. The original camera image must never be used as the default/catalog representation.
- **Confirmed background:** solid white (#FFFFFF), without alpha transparency. Center the complete garment with consistent margins and preserve its actual contours. The app may add a subtle card border or shadow **outside** the generated image so white garments remain distinguishable.
- Show the generated result for review **before Save Item**. The user may **Regenerate**, **Retake/Choose Another Photo**, or correct suggested fields. Reconstruction of unseen regions is a plausible estimate, **not guaranteed to match the real garment**; do not misrepresent it as an exact photograph.
- If image generation fails or yields an unacceptable result, keep the draft and offer Retry / source replacement. **Do not silently save the unprocessed source photo in the wardrobe**. Saving requires one generated representative image and a category.
- **Confirmed source retention:** retain the original user-uploaded photo privately in the cloud, separately from the generated image, linked to the same garment. This allows future AI regeneration without taking the photo again. Retention is tied to the item's lifetime, not limited to an AI-processing TTL; deleting an item deletes its retained original and generated image.
- **One image visible in wardrobe:** each item has only one AI-generated catalog/display image in the grid and item details; keeping an original for future processing does not turn the MVP into a multi-image gallery. The original is never visible to other users or used as the wardrobe thumbnail.
- **Regenerate before the first Save Item is in the MVP.** From the unsaved review screen, the user can generate another variant from the selected source photo; choosing to regenerate does not save or overwrite anything. **Regenerate is NOT offered for already-saved items in V1.** Their original photo stays privately stored for a future release that may add regeneration after save.

## Add Item experience (confirmed: Photo First → AI image generation + suggestions → Single Review Screen)
- Tapping the **Add** bottom tab first presents **Take Photo** and **Choose from Library**.
- After a source photo is taken or selected, show a processing state (e.g. **Preparing your wardrobe photo…**) while an image-generation/editing model produces the fully laid-out garment on a solid white background, and vision AI suggests **Category**, **Color** and an optional descriptive **Item Name**. Suggest **Brand** only when reliably identifiable from visible evidence; never invent one. **Notes** are never auto-generated in MVP.
- Use a single scrollable **review/edit screen** led by the **new AI-generated garment image**, not the original photo. Show pre-filled editable suggestions plus actions to **Regenerate (before Save only)** and **Retake/Choose Another Photo**. Regenerating the draft must never alter a previously saved garment. The user need not type when AI supplies a valid category.
- Saved items require one **successfully generated display image** and one valid category from the nine predefined options. If metadata recognition fails, offer Retry or manual Category selection; if **image generation** fails, require regeneration or replacement of source before Save.
- Saving requires an explicit **Save Item** after preview/review of the newly generated image. AI processing alone must not create a permanent item. Handle camera permissions, processing, upload and network errors without silently losing the draft.
- **After Save Item succeeds:** navigate back to the **Wardrobe** tab, show the newly saved item in the two-column grid, and display a brief non-blocking success message (e.g. "Item added to your wardrobe"). If an active category filter would hide it, select **All** (and reset any conflicting view state) so the item is visible. Put the new item at or near the top of the grid and scroll into view when needed.
- Clear the Add Item draft and reset its initial Photo First state **only after** the **original source photo, generated image and item metadata** are durably saved. During save, prevent duplicate submissions; on failure stay in the review form with the image and edits intact and offer Retry. Never show success before the backend confirms persistence.
- Upload/analysis privacy disclosures, exact loading presentation, **cancel/discard behavior**, and AI service/provider remain implementation decisions.

## Primary journey
Open app → sign in → My Wardrobe → tap Add → Take Photo / Choose from Library → AI generates a fully laid-out isolated garment image **and** infers metadata → review generated image + pre-filled editable fields → optionally regenerate/correct → Save Item → **generated image** appears in Wardrobe → tap to view/edit/delete. On metadata-only failure allow manual category; on image-generation failure retry/retake before saving.

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
- Each clothing card displays the **AI-generated wardrobe image, not the input photograph**, and may show an optional item name, falling back to its category if none was entered.
- Provide helpful empty-wardrobe and empty-filter states, including an obvious way to add an item.
- A persistent bottom navigation provides **Wardrobe**, **Add**, and **Account** destinations. Wardrobe is the landing tab; Add opens the item creation flow; Account contains account information and sign-out.
- Exact theme colors, AI loading/error UI, Add-screen cancel/discard behavior, and general sorting remain UI details to finalize. Post-save return to Wardrobe and new item visibility are confirmed. See [Screen map](SCREENS.md).

## Primary navigation (confirmed)
- Use a **bottom tab bar** with three clearly labeled entries in this order: **Wardrobe | Add | Account**.
- **Wardrobe** displays the two-column catalog and horizontal category chips. It is the default authenticated destination.
- **Add** is the primary entry point for creating a clothing item, with a photo and category required.
- **Account** contains signed-in user information and sign-out, replacing the proposed header-only Settings destination.
- Item Details and Edit Item are secondary screens accessible from Wardrobe; they do not receive new bottom tabs.
- The precise navigation implementation of the Add flow (tab screen versus modal launched from the central action) and cancellation/discard behavior remain to be refined; **successful Save Item always returns to Wardrobe**, showing the new item and a success message.

## Non-goals for MVP
Look/outfit generation, weather suggestions, sharing, purchasing, calendar, complex tagging and multi-image items. **AI image generation/garment completion, isolated backgrounds and metadata recognition ARE included in MVP.**

## Acceptance criteria
- Add via both supported image sources on a real iPhone; create one clean **AI-generated full-garment image** isolated on a **solid white background** per saved item. Require a valid category (AI-inferred or manually chosen) and allow all optional fields to be blank.
- AI analyzes an image and pre-fills category and color when identifiable, plus a descriptive name where useful; users can correct suggestions on the single review screen and are never required to type when a valid category was inferred.
- If metadata AI is unavailable, uncertain or incorrect, users can retry and/or set a category manually; invalid suggestions and unverified brand names are not silently accepted. If the image is unavailable/incorrect, users can regenerate or supply another source photo; they cannot save with only the original photo.
- Clear permission/error states, including cancelled picker, upload failure and offline state.
- Saved entries appear after force quitting and reopening the app, and after signing back into the same account.
- Test with at least two separate accounts: neither can read, change, delete, or retrieve the other's wardrobe records or private photos.
- Sign-in and sign-out work with email verification; sessions remain signed in across app restarts unless signed out or expired.
- My Wardrobe loads as a two-column grid with All selected by default; a category chip filters in place and returns only matching items, without changing screens.
- A persistent bottom bar provides labeled Wardrobe, Add and Account destinations; users can reach item creation and account/sign-out without a floating add button or header-only settings navigation.
- On the Add tab, source photo selection comes first, followed by **AI image generation and metadata analysis** and one review screen with the **generated garment image**, editable suggestions, Regenerate/Retake and Save Item; never auto-save solely because processing completed.
- After successful item persistence, navigate to Wardrobe, ensure the new item is visible despite any previously active filter, and show a brief success indication; do not discard draft or report success on failed saves.
- The grid and Item Details always use the generated representative image; test fully laid-out garment framing, **uniform white (#FFFFFF) background with no transparency**, and preservation of visible colors/patterns/details on varied folded/partially obscured source photos. Flag uncertain reconstruction as potentially inaccurate and allow **pre-save** review/regeneration; confirm no Regenerate action appears for saved items.
- Each saved garment retains its original source photo separately, private to its owner. After signing in on another device, the retained original remains associated with the garment for future regeneration. Deleting an item removes both source and generated images, and a different account cannot access either asset.
- Basic loading, empty, retry and delete-confirmation states work.
- No secrets or customer images are stored in Git.

## Open decisions
- Exact visual palette, component specifications, AI processing states and cancel/discard transitions (save-success behavior is approved; see [Screen map](SCREENS.md)).
- AI image generation/editing and vision provider choices, **clear user-facing notice that original photos are retained privately**, regeneration costs, quality acceptance checks and error behavior.
- **Post-MVP only:** on-demand regeneration of an already-saved garment from its retained original; no saved-item Regenerate action in V1.
- Output format/resolution and approach to ensuring true white edges/background are implementation details; the **solid-white background requirement is confirmed**.
- Whether the login UX should prioritize email code, magic link, or both.

## Product metrics (small beta cohort initially)
First item saved, number of saved items, successful save rate, time to find a garment. Do not add third-party analytics until needed and disclosed.
