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
- In the unsaved Review screen, default to the **generated** preview and expose an accessible **Original / Generated** comparison toggle. Only the UI preview source changes: toggling does **not** modify either asset, associated metadata, or the final `display_image_path`. The original is accessed only through authenticated/private preview access, never a public URL. Offer **Regenerate** and **Retake / Choose Different Photo** **only in the unsaved creation flow**. Each Regenerate attempt creates a replacement preview from the same source; the user's saved wardrobe is unchanged. The app must never expose post-save regeneration actions in the MVP. If generation fails, block Save until a generated image is available; do not silently use the input photo as the wardrobe display.
- The **one visible image per item** requirement refers to one final AI-generated image in the grid/details, while an **original source photo is also persistently retained** in separate private storage for future regeneration.
- **Confirmed:** keep the original uploaded photo **persistently** with the item in private cloud storage, not only in temporary AI-processing storage. Access must be restricted to its owner. Keep original and generated images at distinct private storage paths; delete both when item is deleted. Temporary intermediate images that are not linked to a saved item must still be cleaned up.
- Image output must have a **solid white (#FFFFFF) background** and no alpha channel. Validate on generated samples; if the provider produces off-white/transparent pixels, normalize or composite to white (without damaging light garment edges), then verify the result. Output encoding (JPEG/PNG/WebP), size and quality targets remain to be selected.

## Image generation + vision metadata processing pipeline (MVP requirement)
1. Authenticated client captures/selects one **source/reference photo**.
2. Validate and securely send source bytes or a short-lived private object reference to a server-side handler (e.g. Supabase Edge Function). Do not expose public image URLs.
3. Authenticate/authorize caller, validate image type/size, apply abuse/rate/cost controls; call a **source-image-conditioned image editing/generation model** to produce a separate garment display image with the whole item flat/fully visible against **solid white (#FFFFFF), with no transparency**, and consistent padding. It may estimate unseen parts but must not intentionally invent distinguishable branding/details.
4. In parallel or sequentially, call a vision-capable metadata model or a supported structured extraction step; validate `{ category, color, item_name, brand }` against the nine approved categories. Brand null unless supported by evidence; Notes not generated.
5. Return references for the **generated** preview and metadata suggestions (plus generation status/errors). The Review screen retains private references to **both source and generated previews**, displaying **Generated by default** and permitting authenticated **Original / Generated** toggle comparison, along with editable fields and **pre-save-only Regenerate/Retake**; Original is never the Wardrobe image. Regenerate creates or refreshes a private draft variant, with cleanup of superseded previews and no write to a saved item.
6. Metadata-only failure → manual Category selection; **image generation failure → Retry/Retake and no Save**. Explicit Save Item commits the **retained original source**, exactly one **generated catalog image**, and validated item metadata, linked to the same item. No auto-save.
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
- `source_image_path` text not null (**original user-supplied photo**, stored privately for future re-generation; never used as wardrobe thumbnail)
- `display_image_path` text not null (**AI-generated** full-garment representative image shown in Wardrobe/Details; separate private storage object key, never public URL)
- `created_at` and `updated_at` timestamptz

**Confirmed item fields:** each saved item stores a retained **original source photo** and exactly **one AI-generated display image** (separate paths) plus one category. Item Name, Color, Brand and Notes are optional/nullable. IDs and timestamps are system-managed. Do not add Size or Season in MVP. Validate categories consistently client- and server-side.

The user's original source photo **is retained privately** at `source_image_path`, never rendered in Wardrobe. The generated catalog image is separately stored at `display_image_path`. Suggested object keys in private Storage: `<user-id>/<item-id>/source.<ext>` and `<user-id>/<item-id>/display.<ext>`, or equivalent separate private buckets. Keep their association with the same item. Deletion of that item must remove both objects; orphan cleanup/retry should handle partially completed deletions. A future multi-image gallery can introduce `item_images` without changing this contract.

## Privacy and security boundaries
- Enable and test RLS: user can SELECT, INSERT, UPDATE and DELETE only rows with `user_id = auth.uid()`.
- Store **both original and generated** photos in private object storage, scoped by authenticated user ID and item ID with appropriate Storage access policies. Original-photo access should be limited to the owner and authorized backend jobs; generated images are likewise private.
- Read images through authenticated downloads or short-lived signed URLs; don't persist permanent public URLs.
- Client only uses public project URL and publishable/anon key with correctly configured RLS. Never embed Supabase service-role keys or Apple credentials in the app.
- Retain original photos while the item exists so future regeneration is possible. On item deletion, delete **both source and display images** and reconcile partial failures/orphans; item replacement must never accidentally orphan old assets. Explain source retention in a user-facing privacy notice.
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
5. Upon explicit **Save Item**, use a stable item ID and persist **both** the original source photo at `<user-id>/<item-id>/source.<ext>` and generated image at `<user-id>/<item-id>/display.<ext>` in private storage. Write **both** `source_image_path` and `display_image_path` along with category and optional fields. Handle partial multi-object writes, idempotent retries and orphan cleanup.
6. After **source photo, generated image and metadata** all persist, refresh Wardrobe list, navigate to Wardrobe, reveal new item (select All if needed), and show brief success indication.
7. Reset Add draft only on confirmed success. On failure preserve reference, generated preview and edits for retry; prevent double-submit.
8. Clean up **unsaved temporary** input/output assets and superseded generated previews according to a bounded lifecycle. **Do not clean up the original linked to a successfully saved item** until item deletion or an explicit future source-deletion feature. Display only `display_image_path` in the Wardrobe UI; any original-image access must be authenticated/authorized.

## Regeneration scope
- MVP: allowed only against an **unsaved Add Item draft**, before the initial Save Item action. A new generated preview can replace a previous unsaved preview without modifying the source photograph. Preserve user-edited metadata across image-only regeneration unless an explicit action changes it.
- Post-MVP: potentially offer Regenerate on saved items using their private retained `source_image_path`, with preview/confirm and safe replacement of `display_image_path`. Do **not** implement this endpoint/UI in MVP merely because source images are retained.

## Save-success UI/data consistency
- Success means the committed database item, **private retained source photo** and private **AI-generated display image** are all saved and accessible to their authorized owner; only then report success.
- The tab navigation must support returning from Add to Wardrobe. Keep any active filter from hiding the newly added item (switch to All when needed).
- Refresh the wardrobe query/cache, show the new item prominently and use a short, non-blocking success indicator.
- Restore the Add screen to its clean Photo First state after successful save, but preserve the unsaved photo and suggested/edited metadata during failed submissions and retries.
- Confirm no duplicate item is created by rapid taps or a retry after an ambiguous network response.

## Quality gates
- TypeScript checking, linting, minimal unit tests for data helpers.
- Manual iOS device tests for camera, gallery, permissions, auth, offline/error states, image refresh, and item deletion.
- Test AI outputs for valid category mapping, missing/uncertain fields, unsupported brands, corrupt responses, timeouts, server errors, abuse limits and manual category fallback.
- Test **image generation** on folded, hung, cropped and partly obscured clothes; ensure full garment framing, faithful colors/visible patterns, **consistent solid-white background without alpha**, no fabricated logos, generated-image-only Wardrobe rendering, **pre-save regeneration**, and save prevention when generation fails.
- Verify **Original / Generated toggle** defaults to Generated, works repeatedly before save with owner-only private access, survives metadata edits, and never causes Original to be saved/rendered as `display_image_path`. Confirm no Regenerate control or regeneration endpoint is exposed through saved Item Details/Edit in MVP. Evaluate white/light garments for lost outlines, harsh masking or altered fabric detail.
- Ensure Supabase RLS and private object Storage policies are tested using two distinct accounts for **both source and display paths** before external testers.
- Confirm deletion removes both private image types (including retry/cleanup after partial failure) and does not break other users' items.

## iOS delivery
Use EAS development builds for testing, and a production/distribution profile for TestFlight submission. Requires Apple Developer Program membership and App Store Connect setup; review signing, bundle identifier and EAS credentials when implementation begins.

## Deferred architectural decisions
Exact OTP-versus-magic-link UX, Expo SDK version, styling library, **image generation/editing model and metadata vision provider(s)**, output encoding/resolution and white-background normalization approach, image processing fidelity criteria, **user-facing retention disclosure and optional future original-photo deletion controls**, inference-time private transfer and temporary intermediate retention, request cost limits, cache/offline behavior and localization strategy. Choose these before implementation and update this document.
