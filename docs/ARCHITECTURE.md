# Technical Architecture — Digital Wardrobe
Status: **Proposed**, not yet implemented · Updated: 2026-10-15

## Guiding principles
iPhone-first, easy iteration, minimal operational overhead, private by default, **multiple isolated user accounts from V1**, and GitHub as the code/documentation source of truth.

## Proposed components
- Client: Expo / React Native with TypeScript and Expo Router.
- Image capture/selection: Expo ImagePicker (camera permissions as needed).
- Data/auth/storage: Supabase Auth, PostgreSQL and a **private** Supabase Storage bucket.
- Release: EAS Build for iOS → App Store Connect → TestFlight.
- No custom application server in MVP unless needed for security-sensitive operations.

## UI implementation guidance
The confirmed visual direction is **Modern & Playful**, while specific colors and navigation remain open. Build a small central theme/tokens layer for palette, typography, radius and spacing so that styling can evolve consistently. Aim for friendly rounded components, a restrained playful accent palette, accessible contrast and touch sizes, and a photo-first item grid. Avoid prematurely choosing a UI framework solely for its visual style.

The proposed screen inventory and navigation decisions live in [docs/SCREENS.md](SCREENS.md). Treat its unapproved proposals as planning notes, not implementation requirements.

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

## Upload flow (proposal)
1. Request permission only when needed; select/take image.
2. Preview and validate image; compress/resize client-side to cap transfer size.
3. Create item UUID and upload to `<user-id>/<item-id>/primary.jpg` within private storage.
4. Write metadata with matching image path. Handle partial failure by cleanup/retry.
5. Display the saved item with signed/authenticated image access.

## Quality gates
- TypeScript checking, linting, minimal unit tests for data helpers.
- Manual iOS device tests for camera, gallery, permissions, auth, offline/error states, image refresh, and item deletion.
- Ensure Supabase RLS is tested using two distinct accounts before external testers.

## iOS delivery
Use EAS development builds for testing, and a production/distribution profile for TestFlight submission. Requires Apple Developer Program membership and App Store Connect setup; review signing, bundle identifier and EAS credentials when implementation begins.

## Deferred architectural decisions
Authentication method, exact Expo SDK version, styling library, image processing configuration, cache/offline behavior, localization strategy, and whether to maintain a backend for later AI processing. Choose these during implementation and update this document.
