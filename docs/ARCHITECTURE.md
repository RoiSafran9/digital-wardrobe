# Technical Architecture — Digital Wardrobe
Status: **Proposed**, not yet implemented · Updated: 2026-10-15

## Guiding principles
iPhone-first, easy iteration, minimal operational overhead, private by default, **multiple isolated user accounts from V1**, and GitHub as the code/documentation source of truth.

## Proposed components
- Client: Expo / React Native with TypeScript and Expo Router.
- Image capture/selection: Expo ImagePicker (camera permissions as needed).
- Data/auth/storage: Supabase Auth, PostgreSQL and a **private** Supabase Storage bucket.
- AI enrichment: a **vision-capable model** invoked via an authenticated server-side endpoint (e.g. Supabase Edge Function). Exact provider/model is TBD; no provider secrets in the mobile app.
- Release: EAS Build for iOS → App Store Connect → TestFlight.
- No custom application server in MVP unless needed for security-sensitive operations.

## UI implementation guidance
The confirmed visual direction is **Modern & Playful**, with a confirmed **Wardrobe | Add | Account** bottom tab navigator; specific colors remain open. Build a small central theme/tokens layer for palette, typography, radius and spacing so that styling can evolve consistently. Aim for friendly rounded components, a restrained playful accent palette, accessible contrast and touch sizes, and a **confirmed two-column, photo-first item grid**. Use a **horizontal, single-select chip row** for All (default) and the nine categories, filtering the existing grid in place rather than routing to category screens. Keep filter state distinct from remote data access and always scope queries to the signed-in user. Avoid prematurely choosing a UI framework solely for its visual style.

The screen inventory and confirmed tab labels live in [docs/SCREENS.md](SCREENS.md). Use Expo Router's tab navigation for **Wardrobe | Add | Account** (or an equivalent accessible bottom-tab implementation); keep unauthenticated routes outside the tab group and Item Details/Edit as secondary routes. **Photo First → AI-first → Single Review Form is confirmed:** entering Add presents Take Photo / Choose from Library; after selection, retain the draft photo, invoke AI analysis, and show an image preview plus editable suggested metadata on **one scrollable screen**. Request camera/photo permissions only when needed. Preserve drafts during retries. The model analysis may require sending image bytes or a short-lived private reference to the backend before the user confirms Save; **do not create a permanent wardrobe item before the explicit Save Item action**. Clear temporary uploads according to a bounded retention policy. Respect iPhone safe areas.

## Vision metadata suggestion pipeline (MVP requirement)
1. The authenticated client selects/takes one photo and displays a preview.
2. The client sends the image over TLS to an authenticated server-side handler (e.g. Supabase Edge Function), using a secure upload method or short-lived private reference; avoid public image URLs.
3. The handler validates the caller, image size/type and abuse/rate limits, then invokes a **vision-capable AI model** using server-held credentials.
4. Require a strictly validated structured response such as `{ category, color, item_name, brand }`. The category must match one of the nine approved choices. Treat every returned value as an untrusted suggestion, not ground truth. Color/name may be omitted if uncertain; **brand must be null unless reliably visible**. Do not fabricate notes.
5. Populate the client's single review/edit screen with suggestions. The user can correct all fields; on failure or an unrecognized category, offer Retry and a manual Category selector.
6. Only on explicit Save Item, persist the validated category, optional metadata and the single photo in the user's private wardrobe. Do not silently save on inference success.

**Privacy/operations:** Document that images may be processed by the chosen AI service and account for consent/transparency, processing retention, per-request costs and quotas. Never expose AI provider credentials to the client. AI failures must not block manual category fallback. Provider, model, performance budgets and temporary-image cleanup implementation are deferred decisions.

## Account tenancy model
**Confirmed product requirement:** multiple independent users in MVP. Each account owns a private wardrobe. Supabase Auth identifies the active user, and both database rows and Storage objects must be user-scoped. Cross-user sharing and public clothing galleries are out of scope.

## Data model (proposal)
`wardrobe_items`
- `id` UUID primary key
- `user_id` UUID not null references `auth.users`
- `category` text not null (validated against the nine MVP categories)
- `item_name` text nullable (user-facing optional clothing name)
- `color` text nullable
- `brand` text nullable
- `notes` text nullable
- `image_path` text not null (one required photo per item; storage object key, not a public URL)
- `created_at` and `updated_at` timestamptz

**Confirmed item fields:** the user must supply exactly one photo and one category. Item Name, Color, Brand and Notes are optional and nullable in storage. IDs and timestamps are system-managed. Do not add Size or Season fields in MVP. Use an explicit shared category list (currently nine categories) so client validation and database constraints agree.

Start with a single image per item. Preserve the ability to introduce a separate `item_images` table later.

## Privacy and security boundaries
- Enable and test RLS: user can SELECT, INSERT, UPDATE and DELETE only rows with `user_id = auth.uid()`.
- Store images in a private bucket, scoped to user-specific prefixes with Storage access policies.
- Read images through authenticated downloads or short-lived signed URLs; don't persist permanent public URLs.
- Client only uses public project URL and publishable/anon key with correctly configured RLS. Never embed Supabase service-role keys or Apple credentials in the app.
- Protect against orphaned images during edits/deletions; design deletion behavior and failure recovery explicitly.
- Keep `.env*` secrets out of git; include a safe `.env.example` at implementation time.

## Suggested project layout (once scaffolded)
```text
app/                 # Expo Router screens
components/          # reusable UI
features/wardrobe/   # wardrobe components and logic
lib/                 # Supabase, image handling, helpers
assets/              # static app assets only
supabase/migrations/ # schema & RLS policies
docs/                # requirements and decisions
```

## Add and upload flow (proposal)
1. Request photo/camera permission when needed and select/take one image.
2. Preview and validate/compress the image. Keep a transient draft.
3. Obtain AI suggestions through the authenticated server-side vision handler using private image access, and let the user edit the suggestions on one review screen.
4. If AI fails, allow manual Category selection. Saving still requires a valid Category and the photo.
5. Upon **Save Item**, create an item UUID and commit the validated photo to private storage at `<user-id>/<item-id>/primary.jpg`, then write the item's category and optional fields. Handle partial write/upload failure by cleanup or retry.
6. Display the saved item with authenticated access/short-lived signed URLs; ensure any inference-only temporary image is removed.

## Quality gates
- TypeScript checking, linting, minimal unit tests for data helpers.
- Manual iOS device tests for camera, gallery, permissions, auth, offline/error states, image refresh, and item deletion.
- Test AI outputs for valid category mapping, missing/uncertain fields, unsupported brands, corrupt responses, timeouts, server errors, abuse limits and manual fallback.
- Ensure Supabase RLS is tested using two distinct accounts before external testers.

## iOS delivery
Use EAS development builds for testing, and a production/distribution profile for TestFlight submission. Requires Apple Developer Program membership and App Store Connect setup; review signing, bundle identifier and EAS credentials when implementation begins.

## Deferred architectural decisions
Exact OTP-versus-magic-link UX, Expo SDK version, styling library, vision model/provider, image processing configuration, inference-time private transfer and temporary retention, request budget, cache/offline behavior and localization strategy. Choose these during implementation and update this document.
