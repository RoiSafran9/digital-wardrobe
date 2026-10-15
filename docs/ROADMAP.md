# Roadmap — Digital Wardrobe

## Phase 0 — Foundation (current)
- [x] Create private repository
- [x] Define draft MVP and proposed architecture
- [x] Confirm home browsing: two-column Photo Grid + horizontal category chips
- [x] Confirm Bottom Navigation: Wardrobe | Add | Account
- [x] Confirm Photo First entry for Add Item
- [x] Confirm AI-first metadata suggestion and Single Review/Edit Form after photo selection
- [x] Confirm after-save success: return to Wardrobe, reveal new item and show success message
- [ ] Finalize cancel/discard handling, visual tokens and remaining screen map (Modern & Playful approved)
- [ ] Connect Claude Code to the same repository

## Phase 1 — App foundation
- [ ] Scaffold Expo + TypeScript + Expo Router
- [ ] Establish navigation, UI primitives and theme
- [ ] Configure Supabase project and environment example
- [ ] Choose vision model/provider, authenticated inference endpoint and cost/privacy safeguards
- [ ] Create schema, private bucket and RLS policies

## Phase 2 — Working wardrobe MVP
- [ ] Sign-in and session persistence
- [ ] Camera/photo-library picker and image upload
- [ ] Vision AI category/color/name suggestions with editable Single Review Form and safe manual fallback
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
Background removal; advanced AI wardrobe search; outfit creation; outfit recommendations; weather/context-based suggestions. Basic AI item/category/color suggestions are part of MVP.

## Workflow
One issue or scoped task per branch. Pull request → review → merge. Record material changes to the PRD and architecture in the same pull request.
