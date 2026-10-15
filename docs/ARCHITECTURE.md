# Technical Architecture — Digital Wardrobe
Status: **Proposed**, not yet implemented · Updated: 2026-10-15

## Guiding principles
iPhone-first, easy iteration, minimal operational overhead, private by default, **multiple isolated user accounts from V1**, and GitHub as the code/documentation source of truth.

## Proposed components
- Client: Expo / React Native with TypeScript and Expo Router.
- Image capture/selection: Expo ImagePicker (camera permissions as needed).
- Data/auth/storage: Supabase Auth, PostgreSQL and a **private** Supabase Storage bucket.
- AI image creation **and** metadata enrichment: authenticated server-side orchestration (e.g. Supabase Edge Function) invoking an **image editing/generation model** that accepts a source photograph, plus a vision-capable model or equivalent structured metadata step. Model/provider(s) TBD. No provider secrets in the mobile app.
- Release: EAS Build for iOS → App Store Connect → TestFlight.
- No custom application server in MVP unless needed for security-sensitive operations.

## UI implementation guidance
The confirmed visual direction is **Modern & Playful**, with a confirmed **Wardrobe | Add | Account** bottom tab navigator; specific colors remain open. Build a small central theme/tokens layer for palette, typography, radius and spacing so that styling can evolve consistently. Aim for friendly rounded components, a restrained playful accent palette, accessible contrast and touch sizes, and a **confirmed two-column, photo-first item grid**. Use a **horizontal, single-select chip row** for All (default) and the nine categories, filtering the existing grid in place rather than routing to category screens. Keep filter state distinct from remote data access and always scope queries to the signed-in user. Avoid prematurely choosing a UI framework solely for its visual style.

The screen inventory and confirmed tab labels live in [docs/SCREENS.md](SCREENS.md). Use Expo Router's tab navigation for **Wardrobe | Add | Account** (or an equivalent accessible bottom-tab implementation); keep unauthenticated routes outside the tab group and Item Details/Edit as secondary routes. **Photo First → AI-generated representative image + AI metadata → Single Review Form is confirmed:** entering Add presents Take Photo / Choose from Library; after selection, retain the source photo temporarily, generate a new fully laid-out garment image with isolated background and infer metadata, and show the **generated image** plus editable suggested metadata on one scrollable screen. Request camera/photo permissions only when needed. Preserve drafts during retries. The model analysis may require sending image bytes or a short-lived private reference to the backend before the user confirms Save; **do not create a permanent wardrobe item before the explicit Save Item action**. Clear temporary uploads according to a bounded retention policy. Respect iPhone safe areas.

## AI-generated catalog image (confirmed MVP requirement)
- The wardrobe representation is **not the original camera/photo-library image**. AI must produce a distinct, full-garment, neatly spread / flat-lay style image isolated against a **uniform solid white (#FFFFFF) background, without transparency**.
- Input may be folded, partly hidden or photographed at an angle. The model may **estimate** occluded shapes while aiming to keep actual garment characteristics faithful; completion is not an exact reconstruction. Avoid invented patterns/logos, color shifts and hallucinated embellishments.
- Preview the **generated** image before saving and offer **Regenerate** and **Retake / Choose Different Photo**. If generation fails, block Save until a generated image is available; do not silently use the input photo as the wardrobe display.
- The **one image per item** requirement refers to one final generated/catalog image in the grid/details, not to the existence of a transient private source/reference photo during processing.
- Private source-photo retention (temporary-only vs optionally retaining for future regeneration) is **not yet decided**. Default implementation should minimize retention; do not make source photo public. Use separate private object keys and lifecycle/cleanup policies if temporary storage is required.
- Image output must have a **solid white (#FFFFFF) background** and no alpha channel. Validate on generated samples; if the provider produces off-white/transparent pixels, normalize or composite to white (without damaging light garment edges), then verify the result. Output encoding (JPEG/PNG/WebP), size and quality targets remain to be selected.

## Image generation + vision metadata processing pipeline (MVP requirement)
1. Authenticated client captures/selects one **source/reference photo**.
2. Validate and securely send source bytes or a short-lived private object reference to a server-side handler (e.g. Supabase Edge Function). Do not expose public image URLs.
3. Authenticate/authorize caller, validate image type/size, apply abuse/rate/cost controls; call a **source-image-conditioned image editing/generation model** to produce a separate garment display image with the whole item flat/fully visible against **solid white (#FFFFFF), with no transparency**, and consistent padding. It may estimate unseen parts but must not intentionally invent distinguishable branding/details.
4. In parallel or sequentially, call a vision-capable metadata model or a supported structured extraction step; validate `{ category, color, item_name, brand }` against the nine approved categories. Brand null unless supported by evidence; Notes not generated.
5. Return references for the **generated** preview and metadata suggestions (plus generation status/errors). Review screen shows the generated photo first, editable fields and Regenerate/Retake; original is not the default display.
6. Metadata-only failure → manual Category selection; **image generation failure → Retry/Retake and no Save**. Explicit Save Item commits exactly one generated image plus validated item metadata. No auto-save.
7. The preview/generated output must remain private (temporary object with TTL or secured transmission); clean up unsaved, superseded and abandoned generations according to retention policy.

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
- `display_image_path` text not null (**AI-generated** full-garment representative image shown in Wardrobe/Details; private storage object key, never public URL)
- `created_at` and `updated_at` timestamptz

**Confirmed item fields:** the user supplies one source photo for creation. Every saved item has exactly **one AI-generated display image** and one category. Item Name, Color, Brand and Notes are optional/nullable. IDs and timestamps are system-managed. Do not add Size or Season in MVP. Validate categories consistently client- and server-side.

The user's source photo **must not be the catalog image**. If original photos are ever stored, they require separate private storage keys/fields, an explicit retention policy, and must not render in Wardrobe. Whether to retain them is an open decision. Keep the generated image at `display_image_path`; a future multi-image gallery can introduce `item_images` without changing the primary display contract.

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
1. Request permission when needed, then capture/select one **source** image.
2. Validate/compress source, keep an ephemeral draft and send to authorized server-side AI processing.
3. Generate a **new** full-garment, nicely laid-out representative image with a **solid white (#FFFFFF) background**, and infer metadata; keep output preview private.
4. Show **generated output** and editable suggested fields on one review screen; support Regenerate or Retake. If metadata fails, allow manual Category. If the display image cannot be generated, **block Save** and show Retry/Retake.
5. Upon explicit **Save Item**, use stable item ID and persist **generated** image under `<user-id>/<item-id>/display.<ext>` in the user's private storage. Write `display_image_path`, category and optional fields; handle partial failure and idempotent retries.
6. After both generated image and metadata persist, refresh Wardrobe list, navigate to Wardrobe, reveal new item (select All if needed), and show brief success indication.
7. Reset Add draft only on confirmed success. On failure preserve reference, generated preview and edits for retry; prevent double-submit.
8. Clean temporary input/output assets from AI processing according to data retention choices and garbage collection. Display only `display_image_path` through authenticated download/signed URLs.

## Save-success UI/data consistency
- Success means the committed database item and its required private **AI-generated** display image can be fetched by the authenticated owner; only then report success.
- The tab navigation must support returning from Add to Wardrobe. Keep any active filter from hiding the newly added item (switch to All when needed).
- Refresh the wardrobe query/cache, show the new item prominently and use a short, non-blocking success indicator.
- Restore the Add screen to its clean Photo First state after successful save, but preserve the unsaved photo and suggested/edited metadata during failed submissions and retries.
- Confirm no duplicate item is created by rapid taps or a retry after an ambiguous network response.

## Quality gates
- TypeScript checking, linting, minimal unit tests for data helpers.
- Manual iOS device tests for camera, gallery, permissions, auth, offline/error states, image refresh, and item deletion.
- Test AI outputs for valid category mapping, missing/uncertain fields, unsupported brands, corrupt responses, timeouts, server errors, abuse limits and manual category fallback.
- Test **image generation** on folded, hung, cropped and partly obscured clothes; ensure full garment framing, faithful colors/visible patterns, **consistent solid-white background without alpha**, no fabricated logos, generated-image-only Wardrobe rendering, user regeneration, and save prevention when generation fails. Evaluate white/light garments for lost outlines, harsh masking or altered fabric detail.
- Ensure Supabase RLS is tested using two distinct accounts before external testers.

## iOS delivery
Use EAS development builds for testing, and a production/distribution profile for TestFlight submission. Requires Apple Developer Program membership and App Store Connect setup; review signing, bundle identifier and EAS credentials when implementation begins.

## Deferred architectural decisions
Exact OTP-versus-magic-link UX, Expo SDK version, styling library, **image generation/editing model and metadata vision provider(s)**, output encoding/resolution and white-background normalization approach, image processing fidelity criteria, source-photo retention, inference-time private transfer and temporary retention, request cost limits, cache/offline behavior and localization strategy. Choose these before implementation and update this document.
