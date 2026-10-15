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
- [ ] Generate full-length garment catalog image from source photo (**solid white background, no alpha**), with regeneration and fidelity review
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

## Post-MVP ideas (not committed)
Regeneration of **already-saved** items using retained originals (timing TBD); advanced AI wardrobe search; outfit creation; outfit recommendations; weather/context-based suggestions. **Private retention of originals, normalized AI-generated garment images and basic metadata suggestions are part of MVP.**

## Workflow
One issue or scoped task per branch. Pull request → review → merge. Record material changes to the PRD and architecture in the same pull request.
