# Handoff: KIPS Glass redesign (all screens)

## Overview
This is a full visual redesign of the KIPS iOS app (repo `RoiSafran9/digital-wardrobe`, Expo / React Native, `mobile/`). It covers every screen listed in `docs/SCREENS.md` and adds one new flow, **Build My Look**. App behavior, copy, credit rules and navigation logic stay as built unless this document says otherwise. What changes is the visual layer (type, surfaces, tab bar), the Home layout, the garment details layout, and the new Build My Look screens.

## About the design files
The files in this folder are **design references made in HTML/React (web)**. They are prototypes that show the intended look and behavior, not production code. Rebuild them in the existing Expo / React Native codebase with its own patterns: `mobile/src/theme.ts`, the `ui/` components, expo-router, Reanimated and expo-blur. Do not ship the HTML.

- `explorations/screens/All Screens.html` is the static board of all 50 screens and states, grouped by flow, each with an id (0.1–8.5). Open it in a browser; it pans and zooms. **This is the source of truth for every screen.**
- `explorations/glass/KIPS Glass.html` is the clickable prototype of the main flows: onboarding → Home → add clothes → garment details → Build My Look → Me.
- Each screen's code is in `explorations/screens/S_*.js`, which uses the primitives in `kit.js`, `explorations/redesign/shared.js` and `dir-glass.js`. Read the inline styles there for exact values.

## Fidelity
**High fidelity** for type, color, radii, spacing, glass treatment, Home and the tab bar. Garment images are the real sample PNGs. Icons are Ionicons 7, which the app already uses through `@expo/vector-icons`. Person silhouettes in the outfit flow stand in for the user's photo.

---

## Design tokens

### Type: Bricolage Grotesque, one family for everything
- Package: `@expo-google-fonts/bricolage-grotesque`. Load 400, 500, 600, 700 and 800 in the root layout with `useFonts`, and keep the splash screen up until they load.
- It replaces **both** SF Pro (UI) and Instrument Serif (display). Remove Instrument Serif.
- **Titles / display:** weight 800, letter-spacing −0.03em (on iOS, −0.03 × fontSize), line-height 1.02–1.05.
- **UI text:** 400 body, 600 for buttons and labels, 700 for row titles. Letter-spacing 0.
- **Eyebrow:** 13 / 600, uppercase, letter-spacing 0.6, color `#6E6E73`.

| Role | Size | Weight | Used on |
|---|---|---|---|
| Hero number | 64 | 800 | Home piece count ("32") |
| Display L | 42 | 800 | Welcome, celebration titles (36–42) |
| Large title | 34 | 800 | Closet, Me, flow titles (30–34) |
| Title 2 | 24–28 | 800 | Hero cards, item name, empty states |
| Title 3 | 21–22 | 800 | Category tiles, section heads |
| Headline | 17 | 600–700 | Row titles, buttons (17/600) |
| Body | 17 | 400 | Lists, field text |
| Subhead | 15 | 400–600 | Secondary lines, small buttons |
| Footnote | 13 | 400–600 | Meta, prices, hints |
| Caption | 10.5–12 | 600 | Tab labels, badges |

The numeric sizes keep the ladder already in `theme.ts`; only the family and the display weight change. Use tabular numbers (`fontVariant: ['tabular-nums']`) for counts and credits.

### Color
| Token | Value | Use |
|---|---|---|
| tint | `#0B5EFF` | Primary buttons, active tab, links, selected state, hero Add card (90% alpha) |
| ink | `#131315` | Text, ink buttons, selected chips |
| secondary text | `#6E6E73` | Meta, eyebrow |
| tertiary | `#A1A1A6` | Chevrons, placeholders |
| body 2 | `#3A3A3F` | Inactive tab icons, long copy |
| background | `#F2F2F6` | Screen background behind the glass |
| item stage | `#F3F2EF` | Behind garment images |
| separator | `rgba(20,20,25,0.08)` | Hairlines, 0.5pt |
| fill | `rgba(120,120,128,0.12)` | Soft buttons, unselected chips |
| success | `#23A55A` (text `#1B7F45`) | Ready, checkmarks |
| warning | `#E8A33D` (text `#98610E`) | Low credits, "Not sure" |
| danger | `#D61E24` | Remove, delete, errors |
| tier Great | bg `#E3EBDD`, text `#3B5530` | |
| tier OK | bg `#F3E8CF`, text `#7A5A12` | |

The current app tint in `theme.ts` may differ slightly. Use `#0B5EFF` for this redesign, or keep the existing tint if the owner prefers; it's a single token. Wardrobe swatch colors are unchanged (`tokens/colors.css` → `--swatch-*`).

### Glass surface (`GlassSurface` component)
- Fill `rgba(255,255,255,0.58)` by default. Raise it to 0.66–0.70 for cards and lists and to 0.86–0.90 for sheets and banners over content.
- Blur 22 with 180% saturation. In RN use `<BlurView intensity={40} tint="systemChromeMaterialLight">` with a white fill on top at the alpha above.
- Border 0.5pt `rgba(255,255,255,0.8)`.
- Shadow `0 10 30 rgba(0,0,0,0.10)`, plus a 1pt inner top highlight `rgba(255,255,255,0.9)`. Draw the highlight as a 1pt absolute view at the top.
- Blue glass, for the Add hero and the camera tile: fill `rgba(11,94,255,0.9)`, border `rgba(255,255,255,0.4)`.
- **Background blobs** sit behind the glass on Home, Closet, Me and onboarding. These are two soft circles: `#8FB0D6` (320pt, at −90/−80, 30% opacity) and `#E8C9A8` (260pt, at 220/~400, 22–25% opacity), each blurred about 70. In RN use one pre-rendered blurred PNG, or `expo-blur` over two circle views. Leave them out on the camera and item screens.

### Radii
Tab capsule 999 · hero cards 28 · cards and tiles 24 · list groups 22 · garment images 14–20 · buttons 16 (≥50pt tall) or 14 (smaller) · chips and pills 999 · sheets 34 · fields 14.

### Spacing
Screen side padding 16 (Home, Closet) or 20 (flows). Top content starts at 56–60 under the status bar. Card gap 10. Section gap 24. Card padding 14–16. Primary button 54 tall; small 44; pill 32–40.

### Motion
- Spring for the segmented and tab indicators: `cubic-bezier(.34,1.3,.64,1)`, 360–420ms. In Reanimated use `withSpring({ damping: 14, stiffness: 180 })`.
- Rise in: opacity 0.4→1 and translateY 14→0, 360–420ms, `cubic-bezier(.23,1,.32,1)`.
- Breathe, for the camera buttons: scale 1→1.04→1 over 3s, infinite.
- Float, for the garments on the Build My Look card: translateY 0→−8, 2.6s alternate, staggered by 300ms.
- Shimmer while generating: a white band at 50% alpha sweeping across, 1.6s.
- 360° preview turn: rotateY −14°→14°, 3.2s (placeholder for the real turntable).
- **Reduce Motion** turns off breathe, float, shimmer, turn and drift. Springs become 200ms fades.

---

## Navigation (changed)
Tab bar is **Home · Closet · [Camera] · Looks · Me**. It replaces Home · Closet · Add · Account.
- It is a floating glass capsule: 16pt from each side, 26pt above the bottom, 62pt tall, fully rounded.
- Tab items: Ionicons at 23pt with a 10.5/600 label. Active is tint with the filled icon variant (`home`, `grid`, `sparkles`, `person-circle`); inactive is `#3A3A3F` with the `-outline` variant.
- **Center camera:** a 72pt tint circle raised 26pt above the capsule, with a `camera` icon at 30pt in white. Its shadow is `0 12 26 rgba(11,94,255,0.4)` plus a 5pt white ring (`rgba(255,255,255,0.85)`). It breathes. Tapping it opens the camera in garment mode (`capture/camera`). It replaces the Add tab.
- **Looks** opens Build My Look (8.x). Saved looks are not designed yet.
- **Me** is the old Account tab, renamed.
- Screen content needs about 150pt of bottom padding so the last row clears the capsule.
- `app/(tabs)/add.tsx` is no longer a tab. Its entry points move to the Home hero card and the center camera. Keep the route if other flows link to it, for example the starter screen.

---

## Screens
The ids match the labels on `All Screens.html`. Unless noted, copy is the same as the shipped app (see `docs/SCREENS.md`).

### 0 · Onboarding and sign-in (`app/welcome`, `intro`, `sign-in`, `sign-in-code`, `your-name`, `welcome-credits`)
- **0.1 Welcome:** a loose collage of 5 glass tiles (92×112, radius 24, each rotated −8° to 10°, with a 40pt garment-type icon), shown in the top 300pt. Below it: title "Your closet, beautifully digital." (42/800); body "Photograph what you own. KIPS turns each piece into a clean catalog image." (17, secondary); **Get Started** (primary 54); "I already have an account" (text button).
- **0.2–0.4 Intro:** "Skip" top right (tint). A 380pt glass card (radius 34) holds either a 150pt tint-wash circle with a 70pt icon, or on page 3 a 2×2 garment grid. Then the title (34/800), body (17), page dots (active 22×7 tint, others 7×7) and **Next** / **Continue**.
- **0.5 Sign in:** "Back" link; title "Sign in with email" (32/800); subtitle; a glass field (54 tall, radius 14, 2pt tint border on focus); **Continue**; terms note (13, centered).
- **0.6 Code:** six glass boxes (58 tall, radius 14), with a 2pt tint border on the current box and digits at 26/700. Below: "Resend code in Ns" (secondary) on the left and "Use a different email" (tint) on the right.
- **0.7 Name:** title "What should we call you?"; a field; **Continue**.
- **0.8 Welcome gift:** a 190pt glass circle with a tint-wash fill showing the balance (64/800, tint) and "AI credits"; title "A welcome gift, {Name}"; "Enough for about N garments."; server price pills; **Add Your First 3 Pieces** and "Explore first".

### 1 · First 3 Pieces (`app/first-pieces/*`)
- **1.1 Start:** three dashed 96×120 frames numbered 1–3 with tint badges; title (34/800); body; a glass card asking "Are you near your wardrobe?" with **Yes, I'm near it** (primary, camera icon) and **Not right now** (soft).
- **1.2 Your photos:** a 3-column grid of photos (3:4, radius 16) with a glass × on each; **Take Garment Photos** and **Choose Garment Photos** (glass buttons); a tips card; **Find My Pieces** with "Finding them is free" under it.
- **1.3 Pick:** "k of 5 selected"; a 2-column grid of 4:5 tiles with a 30pt check circle (tint when selected; when not selected, glass and 45% image opacity); a quote line; **Create N Pieces · N credits**.
- **1.4 Progress:** one glass row per photo: a 56×68 thumbnail (blurred plus shimmer until done), the name, a status line (green "Ready" when done) and a 6pt progress bar.
- **1.5 First-success popup:** a floating glass sheet over Closet with a fan of 3 pieces (96×118, a 3pt white border, rotated ±9°), title "Your first pieces are in!" (30/800), subtitle, **Explore My Closet** and "Add More".

### 2 · Home (`app/(tabs)/index.tsx`) — new layout
Source: `explorations/home/home-final.js` → `HomeFinal`. From top to bottom, with 16pt side padding and content starting at 56:
1. **Header row:** on the left, the eyebrow "Good evening, Roi" (time-of-day and name as today) and under it the piece count **N** (64/800, tabular) followed by "pieces" (24/800, secondary). On the right, bottom-aligned, the glass **credit pill** (32 tall): a 7pt tint dot and the balance (15/600). It links to Me.
2. **Add clothes hero** (blue glass, radius 28, padding 14, top margin 10). A decorative circle (140pt, white at 14%) is clipped in the top-right corner. Row: a 46pt white circle with a tint `camera` icon (24, breathing), then "Add clothes" (24/800, white) over "Finding pieces is free · 1 credit per piece" (13, 88% white). Under that, 2 equal buttons, 44 tall, radius 14, white at 20%: `layers-outline` **Laid flat** → camera in garment mode; `body-outline` **Worn** → outfit flow (only when the server offers outfits; otherwise show only Laid flat at full width).
3. **Build My Look hero** (glass, radius 28, height 132, padding 14, margin 10). On the left: a pill "✦ AI stylist" (12/700, tint on 12% tint; **copy needs owner approval**), "Build My Look" (24/800), and "Outfits from your N pieces" (13). On the right, in a 150pt area: 3 garments from a sample look (68×84, radius 14, 2pt white border, rotated −6/7/−2°, floating) and a 34pt ink circle with a white arrow in the bottom-right corner. Tapping anywhere opens Build My Look.
4. **Category tiles:** a 2-column grid with gap 10, one tile per group that has pieces. Glass, radius 24, height 132, padding 14. Group name (21/800) over the count (14, secondary). In the bottom-right corner, a fan of up to 3 of the group's pieces (62×78, radius 14, 2pt white border, rotated ±9°, overlapping by −30pt, bleeding off the tile edge). Tapping opens Closet filtered to that group.
5. **New this week:** rendered **only when there are new pieces** (added in the last 7 days). Section head "New this week" (22/800) with the count on the right; a 4-column grid of 4:5 tiles (radius 14). Tapping opens the item sheet.

Header, Add hero, Build My Look and 4 tiles must fit above the tab bar on an iPhone 16/17 (402×874). **The search field and "Your closet" rows from the old Home are removed**; search lives in Closet.
- **2.2 Creating:** a glass banner (radius 20, 86% fill) pinned at the top over the content: a blurred and shimmering thumbnail, "Creating your pieces…" (15/700), "2 of 3 ready" and a chevron. It opens the processing screen.
- **2.3 Empty closet:** eyebrow; "Your closet starts here" (40/800); 3 dashed frames with icons; a blue hero "Add your first 3 pieces" with a white **Get Started** button (opens First 3 Pieces); then a glass list with **Garment photo** [Camera][Library] and **Outfit photo** [Choose Photo].

### 3 · Closet (`app/(tabs)/closet.tsx`)
- **3.1:** large title "Closet" (34/800) and "N pieces"; a glass search field (40 tall, radius 14); group chips (selected = ink fill); color swatches; a 2-column grid of 4:5 tiles on the stone stage (radius 20) with the name (15/600) and "Group · Color" (13). Same data and behavior as today. Source: `GlassCloset` in `dir-glass.js`.
- **3.2 Empty:** a 120×150 dashed frame, "Your closet is empty" (26/800), body, **Add Clothes** (primary, camera icon, 220 wide).
- **3.3 No matches:** a 40pt search icon, "No matches" (26/800), "Nothing in your closet fits these filters.", **Clear Filters** (glass, 48 tall).

### 4 · Add from a garment photo (`app/capture/*`)
- **4.1 Camera:** black background. The viewfinder is inset 12pt, radius 28, starting at y=106 and ending 206 above the bottom, with white corner brackets (26pt, 3pt stroke). Hint pill: "Lay pieces flat · shoot from above". Bottom: a Garments / Outfit switch (white segment on white-14%), a library button (44, radius 12), and the shutter (76, 4pt white ring).
- **4.2 Free scan:** the photo inside the viewfinder with a tint gradient band sweeping down; title "Finding the pieces…".
- **4.3 Pieces found:** the photo (300 tall, radius 26) with numbered tint boxes (2pt, radius 12, 22pt number badges); glass chips "1 · T-shirt ×" to leave a piece out; a list with "Front catalog image × N — N credits" and "Balance after"; **Generate N Items · N credits**.
- **4.4 Processing:** the photo blurred with a shimmer and a "2 of 3" pill; a stage title (28/800); an 8pt progress bar; a glass checklist (done = green check, current = tint spinner, pending = empty circle); the leave-screen note.
- **4.5 Paused:** the photo in grayscale at 40% with a 56pt red "!" circle; "Generation paused"; the reason plus the credits-returned line; **Try Again** and "Back to Preview".
- **4.6 Results:** "✓ READY" (13/700, green); "N pieces created"; a 2-column grid of tiles with check circles (unselected at 40%) and tier badges; **Add N to Closet** with the non-refund note.
- **4.7 Saved:** a fan of 3 tiles (112×138) with a 46pt green check; "Added to your closet" (36/800); "N new pieces · N credits used"; **View Closet** and "Add More Clothes".

### 5 · Add from an outfit photo (`app/outfit/*`)
- **5.1 Detecting:** the photo (520 tall, radius 26) with the scan band and a glass pill "Detection is free"; boxes pop in.
- **5.2 Select garments:** the photo (280) with boxes (selected = solid tint with a 18% tint fill; unselected = dashed white); a glass row per candidate with a 52×62 crop, the type, "Group · Clear match" or amber "Not sure — please check", "Edit" (tint) and a check circle; "+ Mark a missed garment". Sticky glass footer: "N selected", "N credits · X available", **Generate**.
- **5.3 Review:** "Review i of N" with "Later"; side by side, "Your photo" and "Catalog image" (250 tall); name (26/800) and tier; a list with the **Keep** switch and "↻ Regenerate · 1 credit"; a thumbnail strip; **Back** and **Next** (the last piece shows **Save N to Closet**).

### 6 · Garment details (`components/ItemSheet.tsx`)
- **Image stage:** full width, 480 tall, starting at the top of the screen with no margin, on `#F3F2EF`. Over it: a glass × (40pt, top left); a glass **Edit** pill (tint text, top right); a glass "5 / 8" counter (top center). A floating glass **Front / Back / 360°** segmented control 16pt from the bottom edge of the image (white segment, `0 2 8 rgba(0,0,0,.12)`, 15/600). Swiping horizontally on the image goes to the next or previous item.
- **Below the image** (20pt padding): name (28/800) and tier badge; "Group · Type · Added Oct 20" (15, secondary); facts as **white chips** (32 tall: color with a 12pt dot, pattern, details, "printed text"); an actions list: Add back image · 1 credit / Generate 360° view · 3 credits / Remove from closet (red).
- **6.2 Back · none yet:** a dashed frame inside the stage with "No back image yet", the helper line and **Add Back Image · 1 credit**.
- **6.3 Back · creating:** shimmer plus a spinner and "Creating back image…".
- **6.4 360° · none yet:** 4 thumbnails fading out (1, .7, .45, .25), "See it from every angle", the helper and **Generate 360° · 3 credits**.
- **6.5 360° · ready:** the turntable with a glass pill "Front · Drag to rotate · AI view"; a toast "✓ 360° view ready · 3 credits used" (an ink pill at the top).
- **6.6 Cost sheet:** a floating glass sheet (10pt from the edges, radius 34, 90% fill) with the grabber, the title (22/700), the helper, a grey quote block (lines + Total), "Balance X → Y", **Generate · N credits** and Cancel.
- **6.7 Not enough credits:** the available count (54/800) with "/ N credits needed"; an amber 8pt bar; "Not enough credits"; "You have N credits left. Ask the app owner for more credits."; **OK** and "View Price List".
- **6.8 Remove:** a sheet with the copy as built; **Remove** (red text on a 10% red fill) and Cancel.
- **6.9 Edit:** "Editing" with **Save** (tint); thumbnail and name field (placeholder = the derived name); type chips (selected = ink); 8 color swatches (28pt, 1.5pt ink ring on the selected one); pattern chips; Details and Text rows; Cancel.

### 7 · Me (`app/(tabs)/account.tsx`, `help`, `privacy`)
- **7.1:** large title "Me". Profile card, then the **AI credits** card: a 92pt ring meter (9pt stroke, tint; amber at ≤3), the balance in the center and "of N granted" with the usage line. Then the price list, recent activity, settings (Appearance, Notify when ready, Help, Privacy), Sign Out and Delete Account. Source: `glass-me.js`. Content and logic are the same as Account today.
- **7.2 How AI Credits work:** a sheet with 3 numbered points (26pt tint-wash badges) and **Got It**.
- **7.3 Running low:** the ring turns amber; "Running low. Ask the app owner for more credits." in warning text.
- **7.4 Help** and **7.5 Privacy:** a back button and title; sections with a heading (19/700) and body (15, line-height 1.5). The copy on the board is a draft; **keep the repo's existing copy** unless the owner approves the new text.
- **7.6 Sign out** and **7.7 Delete account:** confirmation sheets with the copy as built.

### 8 · Build My Look (new; `app/build-my-look.tsx` + `components/outfitBuilder/*`)
Source: `explorations/glass/glass-build.js` (interactive) and `S_More.js` 8.x (static).
- **8.1–8.3 Questions:** 3 steps (`BL_Q` in `glass-build.js`): occasion, style and weather. Each step shows progress dots, the eyebrow "Build My Look · i of 3", the question (32/800) and a 3-column grid of option tiles (glass, radius 20, 86 tall, 26pt icon and a 15pt label; selected = ink fill with white). Then **Next** or **Build Looks** and "Made only from your N pieces".
- **8.4 Looks:** a chip summarizing the answers; "N looks for you"; "Swipe right to save, left for the next one."; a **swipe deck** of white cards (radius 30, two cards stacked behind at translateY 12/24 and scale .95/.90), each holding a look collage and the look's name with its piece count. Below: "Tap a piece to swap it" and a row of the look's pieces.
- **8.5 Swap:** a sheet "Swap {group}" with "N in your closet" and a horizontal row of candidates (96×118; the current one has a 2.5pt tint outline); "Keep this one".
- **Logic (for the developer to define with the owner):** the prototype picks looks from the closet by group with no AI call. Whether looks are generated by rules or by a server/AI call, whether that costs credits, and where saved looks are stored are all still open; see Open points.

---

## Interactions and state
- **Home:** `items`, `credits` and `processingJob` come from existing stores. `fresh = items.filter(addedWithin7Days)` decides whether New this week is shown. The Add hero buttons open the camera in `flow: garment` or `flow: outfit`.
- **Tab bar:** the center camera is not a route; it pushes `capture/camera`. Looks pushes `build-my-look`.
- **Item sheet:** the active side (`front | back | 360`) is local state. A horizontal pan (>8pt sideways before it takes over, 60pt threshold to change item) moves through the filtered list. Paid actions open the cost sheet first, as built.
- **Build My Look:** `step` (0–2), `answers`, `looks[]`, `index` and `swapGroup`. The deck uses a pan gesture: right = save/wear, left = next. It needs buttons as a fallback for Reduce Motion and accessibility.
- **Sheets:** glass, floating (10pt from the edges), with a grabber; close on swipe down or on tapping the backdrop (`rgba(0,0,0,0.32)`).
- **Toasts:** an ink pill at the top center (14/600, white), shown for about 2.4s.
- **Dark mode:** **not designed for this direction yet.** Until it is, keep the existing dark theme tokens, or lock the redesign to light (owner decision).

## Assets
- `assets/garments/*.png`: sample garment images, used only in the mocks.
- `assets/logo/*`, `assets/app-icon/kips-icon-3a-rounded-1024.png`: brand mark and app icon (unchanged).
- Icons: Ionicons 7 (`@expo/vector-icons/Ionicons`). Names used: `camera`, `layers-outline`, `body-outline`, `sparkles`, `sparkles-outline`, `home`, `home-outline`, `grid`, `grid-outline`, `person-circle`, `person-circle-outline`, `arrow-forward`, `chevron-forward`, `chevron-back`, `chevron-down`, `close`, `checkmark`, `checkmark-circle`, `search`, `images-outline`, `alert`, `sync-outline`, `camera-reverse-outline`, `add`.

## Suggested implementation order
1. Add the font and update `theme.ts`: family, display weight and tracking, glass tokens and tint.
2. Build `GlassSurface`, then restyle `Button`, `Sheet`, `Segmented`, `Chip` and the list rows.
3. The new tab bar (center camera, Looks, Me rename).
4. Home (2.x).
5. Item sheet (6.x).
6. Restyle the remaining flows (0, 1, 3, 4, 5, 7): mostly glass cards plus the new type, with no logic changes.
7. Build My Look (8.x) behind a flag.

## Open points for the owner
- Copy: "AI stylist" tag; the intro, help and privacy drafts on the board.
- Build My Look: rules or AI, cost in credits, saved looks.
- Dark mode for the glass direction.
- Final tint: `#0B5EFF` or the current value in `theme.ts`.

## Files in this bundle
Script files use `.js` and kebab-case names (they are JSX, transpiled in the browser by Babel). The names in prose (`HomeFinal`, `GlassBuild`…) are the React components inside them.
- `explorations/screens/All Screens.html` with `kit.js`, `S_Onboarding.js`, `S_Main.js` and `S_More.js`: every screen.
- `explorations/glass/KIPS Glass.html` with the `glass-*.js` files: the clickable prototype.
- `explorations/home/home-final.js`: Home and the tab bar (`HomeFinal`, `TabsCenter`).
- `explorations/redesign/shared.js` and `dir-glass.js`: shared data, the glass style helper `gl()`, the swipe hook and the closet grid.
- `styles.css` and `tokens/*.css`: design-system tokens (colors, type, layout, Bricolage import).
- `ui_kits/kips-ios/ios-frame.js`: the device frame (mock only).
