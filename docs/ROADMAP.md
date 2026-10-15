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
- [ ] Decide generated-image background (white vs transparent), source-photo retention and quality/fidelity requirements
- [ ] Finalize cancel/discard handling, visual tokens and remaining screen map (Modern & Playful approved)
- [ ] Connect Claude Code to the same repository

## Phase 1 — App foundation
- [ ] Scaffold Expo + TypeScript + Expo Router
- [ ] Establish navigation, UI primitives and theme
- [ ] Configure Supabase project and environment example
- [ ] Choose image generation/editing and metadata-vision model(s), secure inference endpoint, limits and photo privacy/retention safeguards
- [ ] Create schema, private bucket and RLS policies

## Phase 2 — Working wardrobe MVP
- [ ] Sign-in and session persistence
- [ ] Camera/photo-library picker and image upload
- [ ] Generate full-length garment catalog image from source photo (white/transparent background), with regeneration and fidelity review
- [ ] Vision AI category/color/name suggestions with editable Single Review Form and safe manual-category fallback
- [ ] Clothing item creation and image grid
- [ ] Post-save Wardrobe refresh, new-item visibility and brief success feedback; preserve draft on failed save
- [ ] Category filters
- [ ] Item detail, edit and delete
- [ ] Error/empty/loading states and security validation

## Phase 3 — iPhone release
- [ ] Test camera/gallery and persistence on a physical iPhone
- [ ] Set up EAS and App Store Connect
- [ ] Build and submit to TestFlight
- [ ] Install and complete personal acceptance testing

## Post-MVP ideas (not committed)
Advanced AI wardrobe search; outfit creation; outfit recommendations; weather/context-based suggestions. **Normalized AI-generated garment images and basic item/category/color suggestions are part of MVP.**

## Workflow
One issue or scoped task per branch. Pull request → review → merge. Record material changes to the PRD and architecture in the same pull request.
