# Handoff: Digital Wardrobe — iOS app UI

## Overview
High-fidelity, fully clickable prototype of the Digital Wardrobe iOS app: onboarding/auth, Home, Closet, Garment Details (front/back/360°), both Add Clothes flows (garment photo, outfit photo), AI Credits, and Account. Target codebase: `RoiSafran9/digital-wardrobe` → the existing Expo / React Native app in `mobile/` (backend in `api/`, `pipeline/`, `supabase/`).

## About the Design Files
The files in this bundle are **design references built in HTML**, prototypes that show the intended look and behavior. They are not production code to copy. Recreate them in `mobile/` using its existing patterns (routing in `mobile/app/`, components in `mobile/src/`, existing API client, auth and credit logic). Before implementing, read `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md`, `docs/SCREENS.md` and `docs/CREDITS.md` in the repo. **Where the repo's docs or API contradict this prototype on business rules (prices, credit amounts, flow steps), the repo wins.** Visual design follows the prototype.

Open `Digital Wardrobe.dc.html` in a browser. The left sidebar jumps to every state (31 steps). `GarmentArt.dc.html` only draws placeholder garment silhouettes; in the app, these are the real AI catalog images.

## Fidelity
**High-fidelity.** Recreate colors, type, spacing, radii and interactions closely, using native iOS conventions (SF Pro, native sheets, haptics, safe areas). Frame: iPhone 393×852 pt.

## Navigation
Bottom tab bar (4 tabs): **Home · Closet · Add · Account**. Tab bar 84pt tall, translucent (`rgba(250,250,250,.94)` + blur 20), hairline top border. Active tab = accent, inactive = `#a1a1a6`, label 10.5/500.
Tabs are hidden during onboarding, camera, processing and flow screens. Garment Details is a **modal sheet** over any tab (top offset 52pt, radius 28 top corners, grabber).

## Screens

### Onboarding
1. **Welcome**: collage of 5 rotated garment tiles (radius 22, rotations −10°…+6°, staggered pop-in 0.05–0.45s). Title "Your closet,\nbeautifully digital." in Instrument Serif 46/1.0. Body 17/1.4 secondary. CTA "Get Started" (primary) + "I already have an account" (text button).
2. **Intro (3 pages)**, card 400pt tall, radius 30, bg `bg2`. Paging dots (active = 22×7 accent pill, inactive 7×7). Page titles 28/700: "Snap any garment" · "Or import an outfit" · "Browse what you own". Visuals: photo→catalog side-by-side; outfit photo with blue detection boxes; 3×3 closet grid. Skip top-right.
3. **Email sign-in**: "Sign in with email" 32/700, subtitle "We'll send you a six-digit code. No password needed." Input 56pt, radius 14, bg `bg2`, 1.5pt accent border when valid. Continue is disabled (40% opacity) until the email is valid. Terms footnote 13pt.
4. **Verification code**: 6 boxes (62pt tall, radius 14, gap 8). The current box has an accent border; all boxes turn success green when 6 digits are entered, then auto-advance after ~600ms. One hidden numeric input with `autoComplete="one-time-code"`. "Resend code" link.
5. **Starter credits**: 168pt circle `accentSoft` with "25" (64/700 accent) + "AI credits". Title "A welcome gift" (Instrument Serif 40). Price chips: Front · 1, Back · 1, 360° · 3. CTA "Digitize Your First Piece" → Add tab with first-piece hint; "Explore first" → empty Home.

### Home
- Date eyebrow (13/600 uppercase, tracking .05em) + "Good morning,\nMaya" Instrument Serif 42. Credit pill top-right (fill bg, accent dot, balance) → Account.
- Auto-scrolling horizontal marquee of garment tiles 118×148, radius 20, alternating 10pt vertical offset, linear loop (~4s per item). Tap a tile → details. Respect Reduce Motion (stop the animation).
- Stats row with 3 columns separated by hairlines: Pieces / Categories / New this week (26/600).
- "Digitize clothes" card (bg2, radius 26, padding 20) with **Take Photo** (primary) and **From Library** (white) buttons, 48pt tall, radius 14.
- "Recently Added" horizontal list of 150×188 cards, name 15/600 + "Added Oct 18" 13 secondary, "See All" → Closet.
- "Browse by category": outlined pills with counts → Closet pre-filtered.
- **Empty state**: three dashed 78×98 frames (middle one accent with "+"), "Your closet starts here", two buttons, then 3 numbered tips.

### Closet
- Large title "Closet" 34/700 + count. Search field 40pt, radius 12, fill bg. It searches name/category/color/material.
- Category chips: All + categories that are present. Selected chip = ink bg, inverted text.
- Color swatches 28pt circles. Selected = double ring (2pt bg + 1.5pt ink). Tapping the selected swatch again clears it.
- 2-column grid, gap 18 vertical / 12 horizontal, tile aspect 4:5, radius 22, tile bg `#f3f2ef`. "360°" badge when available. Name 15/600, "Category · Color" 13. Press: scale .97.
- Empty / no-match state with "Clear Filters" or "Add Clothes".

### Garment Details (sheet)
- Close (×, 32pt fill circle) and Edit (accent text).
- Image stage 372pt tall, radius 28, tile bg.
- Segmented control Front / Back / 360°.
  - **Back, none yet**: dashed inset frame, "No back image yet", button "Add Back Image · 1 credit".
  - **360, none yet**: preview of 4 fading angle thumbnails, "See it from every angle", "Generate 360° · 3 credits".
  - **360 available**: drag horizontally (step every ~50pt) or use ‹ › buttons. Angle pill shows Front/Left/Back/Right. Hint "Drag to rotate".
  - **Generating**: shimmer + spinner + "Creating back image…" / "Creating four angles…". When done, a toast reads "✓ Back image ready · 1 credit used".
- Title 28/700, "Category · Added date". Info list: Color (swatch), Pattern, Material, Details.
- Action list: Add Back Image (1 credit), Generate 360° View (3 credits), **Remove from Closet** (danger, with confirmation sheet: "Credits used for its images are not returned").
- Edit sheet: Name input, Category chips, Pattern chips, Save → toast "Changes saved".

### Add Clothes (tab)
Title "Add Clothes", subtitle "Choose how to start. Finding garments is always free." Two large cards (radius 26, image area 176pt):
- **Photograph Garments**: "Lay one or more pieces on a flat surface. Each becomes its own item." / "1 credit per garment".
- **Import from Outfit Photo**: "Use a photo of you wearing an outfit, then pick the pieces to keep." / "Free detection · 1 credit per piece".
Footer: "Balance: N credits · Price list" → Account. First-time users see a numbered hint card ("Your first piece…").

### Flow A: Garment photo
1. **Camera**: dark full-screen, corner-bracket frame, hint pill "Lay pieces flat · daylight works best", mode switch GARMENTS (yellow `#ffd60a`) / OUTFIT, shutter 76pt, library thumbnail.
2. **Preview & cost**: square photo with numbered accent badges on each detected piece. "3 garments found" + chips. Cost card: "Front catalog image × 3 — 3 credits" / "Balance after". Note "You'll review every image before it's added." Sticky CTA "Generate 3 Items · 3 credits". If the balance is too low → insufficient-credits sheet.
3. **AI processing**: 230×288 card that goes from blurred to sharp per item, with a shimmer sweep and an "n of N" badge. Stage title + progress bar (260×6) + 4-step checklist: Finding each garment → Separating the pieces → Laying them flat → Adding final details (done = green check, current = spinner). Footer: "You can leave this screen. We'll notify you when your pieces are ready."
4. **Error**: greyed garment + red "!" badge, "Generation paused", "Credits for unfinished items were returned to your balance." Buttons: Try Again / Back to Preview.
5. **Results**: "✓ Ready" eyebrow (success), "3 pieces created", grid with check toggles (deselected = 40% opacity). CTA "Add N to Closet" (disabled at 0) → Saved.

### Flow B: Outfit photo
1. **Choose photo**: 3-column photo grid with a Camera cell first. Full-body photos are highlighted ("Full body" badge).
2. **Detecting**: photo with a scanning band (accent 22% gradient, 2.4s loop). Boxes appear one by one (scale 1.15→1). "Finding garments…", "N found so far", "Detection is free" pill.
3. **Select & correct**: photo with tappable boxes (selected = solid accent border + 8% tint, unselected = dashed white) and number badges. List rows: 62pt crop thumbnail, name, "Category · Clear match" or amber "Not sure — please check" for low confidence, Edit button, check circle. Low-confidence items start **unselected**. "+ Mark a missed garment" dashed button. Sticky footer: "N selected / N credits · X available" + Generate.
   - **Edit sheet** ("Correct this garment"): name, type chips, Done, "Not a garment" (danger, removes the detection).
4. **Confirm cost sheet**: "Generate N garments", line items, Total, "Balance X → Y", "Detection was free", CTA "Generate · N credits".
5. **Processing** (same component as Flow A).
6. **Review**: "Review 1 of N" + "N kept". Side-by-side: original crop (left, 3:4) | generated image (right, 4:5). Name, Keep switch, "↻ Regenerate · 1 credit" (spinner overlay). Thumbnail strip for jumping between items. Back ‹ / Next → last item shows "Save N to Closet".
7. **Saved**: fan of up to 3 tiles (rotations −9/0/+9) + green check badge, "Added to your closet" (Instrument Serif 40), "N new pieces · N credits used". View Closet / Add More Clothes.

### Account
Grouped list on `bg2`:
- Profile card (avatar initials in an accentSoft circle, name, email).
- **AI Credits card**: balance 54/700, "of 25 left", 8pt progress bar (turns amber `#e8a33d` at ≤3), note "N used so far · enough for about N more garments" or the low warning. "How it works" opens a sheet with 3 numbered points (detection free / pay per image created / always shown first).
- **Price list**: Garment detection Free · Front image 1 · Back image 1 · 360° view 3.
- **Recent activity**: label + date, amount (+ in success green, − in ink).
- **Settings**: Appearance (Light/Dark segmented), Notify when ready (switch), Help & Support, Privacy.
- Sign Out (accent), Delete Account (danger + confirmation sheet). Version footer.

### Insufficient credits (sheet)
Big balance "2 / 4 credits needed", amber bar, "Not enough credits", contextual body (in the outfit flow: "Deselect N garments to continue with what you have."). CTA "Adjust Selection" / "OK", secondary "View Price List". **No purchase UI.**

## Interactions & Behavior
- Every AI action → cost-confirmation sheet → spend → progress → success toast. Never charge without confirmation. Detection is free.
- Toast: top-center pill (ink bg, inverted text, 14/600), 2.6s, fades in and out.
- Sheets: slide up 0.35–0.4s `cubic-bezier(.2,.8,.2,1)`, dimmed backdrop `rgba(0,0,0,.32)`, tap outside to dismiss.
- Pop-in: scale .9 + 8pt translateY → 1, 0.5–0.7s, same easing, staggered 0.12s.
- Press feedback: cards scale .97–.98. Add haptics on toggles and confirms.
- Progress in the prototype is simulated (4.5s). In the app, drive it from the real job status (`api/worker.py`, `pipeline/`) and support push notifications ("Notify when ready").

## State (app-level)
`user`, `credits` (balance + activity log), `closet[]` (id, name, category, colorName, colorHex, pattern, material, details, addedAt, frontUrl, backUrl?, angles360?[4]), `filters` {category, color, query}, outfit draft {photo, candidates[] {box, category, name, confidence, selected, keep}}, generation job {status, progress, items}, `theme` (system/light/dark).

## Design Tokens
| Token | Light | Dark |
|---|---|---|
| bg | #FFFFFF | #000000 |
| bg2 (grouped / cards) | #F4F4F2 | #1C1C1E |
| card / sheet | #FFFFFF | #1C1C1E |
| tile (garment bg) | #F3F2EF | #1B1B1D |
| ink | #131315 | #F5F5F7 |
| ink2 | #6E6E73 | #98989F |
| ink3 | #A1A1A6 | #636366 |
| line | rgba(20,20,25,.08) | rgba(255,255,255,.10) |
| fill | rgba(120,120,128,.12) | rgba(120,120,128,.26) |
| accent | #1F6BFF | #3D86FF |
| accentSoft | rgba(31,107,255,.10) | rgba(61,134,255,.18) |
| success | #23A55A | #30C26A |
| danger | #E5484D | #FF5A5F |
| warning | #E8A33D (text #C27C12) | same |

- **Type**: SF Pro (system) for the whole UI. Large title 34/700, tracking −.02em. Screen title 32/700. Section 22/700. Body 17 and 15/16. Caption 13. Eyebrow 13/600 uppercase, tracking .05em. **Instrument Serif** (Google Fonts) only for editorial headlines: welcome (46), Home greeting (42), "A welcome gift" / "Added to your closet" (40).
- **Radii**: 8 (segment), 12 (search, inputs), 14 (buttons 48pt, small cards), 16 (primary buttons 54pt), 18 (grouped lists), 20–22 (garment tiles), 26–30 (feature cards, image stages), 34 (floating sheets).
- **Spacing**: screen padding 20 (grouped lists 16). Gaps 8/10/12/14/18/22/28.
- **Shadows**: tiles `0 12px 30px rgba(0,0,0,.08)`. Sheets `0 -10px 40px rgba(0,0,0,.12)`. Garment cut-outs `drop-shadow(0 8px 10px rgba(0,0,0,.13))`.
- Primary button: 54pt, radius 16, accent bg, white 17/600.

## Assets
No real images are included. Garment silhouettes and striped boxes are placeholders. In the app, use the pipeline's generated catalog images (front/back/360) and the user's original photo crops for the outfit review.

## Files
- `Digital Wardrobe.dc.html`: the full prototype (all screens, states and logic; sample data at the top of the script).
- `GarmentArt.dc.html`: placeholder garment renderer (do not port).
- `support.js`: runtime needed to open the HTML files locally.
