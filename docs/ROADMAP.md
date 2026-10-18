# Roadmap — Digital Wardrobe

## Phase 0 — Foundation (current)
- [x] Create private repository
- [x] Define draft MVP and proposed architecture
- [x] Confirm home browsing: two-column Photo Grid + horizontal category chips
- [x] Confirm Bottom Navigation: Wardrobe | Add | Account
- [x] Confirm Photo First entry for Add Item
- [x] Confirm AI-first metadata suggestion and Single Review/Edit Form after photo selection
- [x] Confirm AI-generated full-garment representative images (not original camera photos) in Wardrobe
- [x] Confirm after-save success: return to Wardrobe, reveal new item and show success message
- [x] Confirm generated-image background: solid white (#FFFFFF), non-transparent
- [x] Decide original source-photo retention: keep privately with each item for future regeneration
- [x] Confirm Regenerate is available **before the first Save Item only**; saved-item Regenerate is post-MVP
- [x] Confirm pre-save Review comparison: **Generated default / Original toggle**, without changing saved catalog image
- [ ] Define detailed output image quality/fidelity acceptance requirements
- [ ] Finalize cancel/discard handling, visual tokens and remaining screen map (Modern & Playful approved)
- [ ] Connect Claude Code to the same repository

## Phase 1 — App foundation
- [ ] Scaffold Expo + TypeScript + Expo Router
- [ ] Establish navigation, UI primitives and theme
- [ ] Configure Supabase project and environment example
- [ ] Choose image generation/editing and metadata-vision model(s), secure inference endpoint, limits and photo privacy/retention safeguards
- [ ] Create schema with separate `source_image_path` and `display_image_path`, private Storage, user-scoped RLS/policies and paired-asset deletion

## Phase 2 — Working wardrobe MVP
- [ ] Sign-in and session persistence
- [ ] Camera/photo-library picker and **private upload of original and generated photos**
- [ ] Generate full-length garment catalog image from source photo (**solid white background, no alpha**), with **pre-save-only regeneration**, **Original / Generated comparison** and fidelity review
- [ ] Vision AI category/color/name suggestions with editable Single Review Form and safe manual-category fallback
- [ ] Clothing item creation and image grid
- [ ] Post-save Wardrobe refresh, new-item visibility and brief success feedback; preserve draft on failed save
- [ ] Category filters
- [ ] Item detail, edit and delete (including cleanup of both source and generated images)
- [ ] Error/empty/loading states and security validation

## Phase 3 — iPhone release
- [ ] Test camera/gallery and persistence on a physical iPhone
- [ ] Set up EAS and App Store Connect
- [ ] Build and submit to TestFlight
- [ ] Install and complete personal acceptance testing

## Multi-user phase ([design](superpowers/specs/2026-10-18-multiuser-architecture-design.md))
- [x] M1 — Authentication foundation: email-code sign-in, encrypted persisted session, guarded navigation, Account tab, local mode for development
- [x] M2 — Database schema, RLS, private Storage bucket and policies, two-account isolation tests
- [x] M3 — FastAPI verifies Supabase tokens, Postgres-backed generation jobs, results in private Storage, migration of local `runs/`
  - [x] M3a — backend: token verification, `/v1` jobs/items API, worker, `claim_generation_job`, `runs/` migration script
  - [x] M3b — app: send the token, use `/v1`, poll jobs, signed image URLs (server stays on the Mac for now; tunnel documented, not set up)
- [ ] M4 — End-to-end two-user verification on devices; update product docs
- [ ] M5 — Credit system readiness (integration points only, no payments)

## Post-MVP ideas (not committed)
Regeneration of **already-saved** items using retained originals (**explicitly deferred post-MVP**); advanced AI wardrobe search; outfit creation; outfit recommendations; weather/context-based suggestions. **Private retention of originals, normalized AI-generated garment images and basic metadata suggestions are part of MVP.**

## Workflow
One issue or scoped task per branch. Pull request → review → merge. Record material changes to the PRD and architecture in the same pull request.
