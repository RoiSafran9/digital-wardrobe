# Screen Map — Digital Wardrobe
Status: **As built** · Updated: 2026-10-19 (redesign M9, Home update)

Visual system, tokens and motion rules: [DESIGN.md](../DESIGN.md) (native iOS: system font, grouped backgrounds, one blue tint, light/dark, Reduce Motion). Feature specs: `docs/superpowers/specs/`.

## Navigation
- Signed out (account mode): **Welcome** (first launch) → **Intro** → **Sign in** → **Code**. Local mode skips them. A release build without Supabase settings shows a blocking "not configured" screen.
- Signed in: bottom tabs **Home** (default) · **Closet** · **Add** · **Account** (`mobile/app/(tabs)/`). The item sheet opens over Home or Closet; it is not a tab.

## 0. Onboarding and sign-in (account mode only; local mode skips all of it)
- **Welcome** (`app/welcome.tsx`, first launch on this device): collage of garment tiles popping in, "Your closet, beautifully digital." (Instrument Serif), **Get Started** → Intro, **I already have an account** → Sign in. After onboarding is seen it forwards straight to Sign in.
- **Intro** (`app/intro.tsx`): three paged cards — "Snap any garment", "Or import an outfit", "Browse what you own" — with dots, Next/Continue and Skip. Leaving it remembers onboarding (`onboarding.seen`).
- **Sign in with email** (`app/sign-in.tsx`): "We'll send you a six-digit code. No password needed."; Continue disabled until the address is valid; terms note; clear messages for rate limits and connection errors.
- **Check your inbox** (`app/sign-in-code.tsx`): six boxes over one one-time-code field (Mail autofill, paste); verifies 600 ms after the sixth digit; a wrong or expired code shows the message and clears the boxes; "Resend code in Ns" (60 s); "Use a different email".
- **What should we call you?** (`app/your-name.tsx`): part of signing up. Shown once after the code when the account has no name yet (also for existing accounts, once); 1–40 characters; saved to the profile. The greeting and Account use it.
- **A welcome gift** (`app/welcome-credits.tsx`): once per account, right after a sign-in, only when billing is on and the server has granted credits. Shows the server's available balance ("about N garments" at the front price) and server price chips; **Digitize Your First Piece** → Add, **Explore first** → Home. Never a fixed amount.

## 1. Home (`mobile/app/(tabs)/index.tsx`)
Rule (handoff [CHANGE_home_photo_type.md](design/design_handoff_digital_wardrobe/CHANGE_home_photo_type.md)): every photo entry point says which photo it wants — garment photo (laid flat or on a hanger → garment flow) or outfit photo (someone wearing it → outfit flow).
- Date eyebrow, "Good morning,\n{Name}" (afternoon / evening) in Instrument Serif with the name chosen at sign-up, balance pill (billing on) → Account; a banner while a garment photo is being processed.
- Search field "Search N pieces" → Closet with the search field focused.
- **ADD TO CLOSET:** two tiles. **Garments** (`FLAT LAY`, "Each piece becomes an item"): Camera → camera in garment mode; Library → photo picker → Preview. **Outfit photo** (`WORN`, "We find each piece you wear"; only when the server offers outfits): Choose Photo → photo picker → Detecting. The flow travels in the route params (`flow: garment | outfit`).
- **YOUR CLOSET:** one row per category group with pieces (thumbnail of its first piece, name, count, chevron) → Closet filtered to the group.
- Empty closet: dashed frames, "Your closet starts here", two labelled rows — **Garment photo** "Laid flat or on a hanger" [Camera] [Library], **Outfit photo** "You wearing it" [Choose Photo] — then three numbered tips.

## 2. Closet (`mobile/app/(tabs)/closet.tsx`)
- Large title "Closet" + "N pieces"; search field (name, category, group, colors, pattern, details, printed text — `src/closetFilter.ts`).
- Group chips (All + groups present: Tops, Outerwear, Bottoms, Dresses, Shoes, Bags, Accessories, Other — `src/categoryGroups.ts`); selected = ink fill. Accepts `group` (and an older `category`) from Home.
- Color swatches for colors present; selected = double ring; tapping it again clears it.
- Two-column grid of 4:5 stone tiles with a soft shadow, "360°" badge when done, the garment's name (user's name or "Cream sweater") and "Group · Color".
- Empty closet → "Add Clothes"; no matches → "Clear Filters". Pull to refresh; tapping a tile opens the item sheet, which swipes through the filtered grid.

## 3. Add Clothes (`mobile/app/(tabs)/add.tsx`) and the garment-photo flow (`mobile/app/capture/`)
- **Add Clothes:** "Choose how to start. Finding garments is always free." Two cards: **Photograph Garments** ("N credit per garment" while billing is on) and **Import from Outfit Photo** (only when the server offers outfits; "Free detection · N credit per piece"). "Balance: N credits · Price list" → Account (billing on). A numbered "Your first piece" hint when opened from the starter screen; "N pieces waiting for review" for outfit results.
- **Camera** (`capture/camera.tsx`, `expo-camera`): dark full screen, corner brackets, hint pill, GARMENTS / OUTFIT switch (outfit only when offered), 76pt shutter, library button. Camera refused → explanation + Choose from Library. Garments → Preview; outfit → the free scan.
- **Preview** (`capture/preview.tsx`): the photo, then — billing on — "Pieces in this photo" (1 up to what you can afford, max 20) with "Front catalog image × N — N credits" and "Balance after"; CTA "Generate up to N Items · N credits" (billing off: "Create Catalog Images"). Can't afford one → Not enough credits sheet. The user approves a maximum and pays only for pieces made (CREDITS §6); no pre-detection.
- **Processing** (`capture/processing.tsx`): photo card coming into focus with a shimmer and, in account mode, the server's "2 of 3" piece count, stage title, progress bar easing to 90%, checklist (Finding each garment → Separating the pieces → Laying them flat → Adding final details), "You can leave this screen — your pieces will appear in your closet." Leaving keeps the job; Home shows "Creating your pieces…" until it's done.
- **Error:** greyed photo with a red "!", "Generation paused", the reason (+ "Credits for unfinished items were returned to your balance." while billing is on), Try Again / Back to Preview; a worn-photo rejection offers "Try it as an outfit photo" with the same photo.
- **Results** (`capture/results.tsx`): "✓ READY", "N pieces created", tiles with check toggles (deselected 40%), tier badge and retake/edge tips, pieces over the limit and pieces that failed; "No pieces found" / unusable-photo messages with Take Another Photo. **Add N to Closet** removes deselected pieces (soft delete; "Credits for removed pieces are not returned." while billing is on).
- **Saved** (`capture/saved.tsx`, shared with outfits): fan of up to three tiles with a green check, "Added to your closet" (Instrument Serif), "N new pieces · N credits used" (credits only while billing is on), View Closet / Add More Clothes.

## 4. Account (`mobile/app/(tabs)/account.tsx`)
- Grouped list on the warm-grey background.
- Profile card: initials (from the name, else the email) in an accent-wash circle, the name and email, and **Edit** to change the name.
- **AI Credits** card (account mode): the available balance (54pt), "of N granted" from the server, an 8pt bar of available/granted that turns amber at ≤ 3 credits, "N used so far · enough for about N more garments" (or "Running low. Ask the app owner for more credits."), "N held for work in progress". Billing off: "Billing is off — AI actions don't use credits yet." **How it works** opens a sheet with three points (detection free · pay per image created · cost always shown first).
- **Price list** (billing on): Garment detection Free (when outfits are offered), Front image, Back image, 360° view — all from the server.
- **Recent activity:** grants (+N, green) and charges (−N) with dates, newest first, "Show more".
- **Settings:** Appearance System / Light / Dark (remembered on the device; default System); **Notify when ready** (account mode, off by default: asks iOS permission, registers this phone's Expo push token with the server, which pushes "Your pieces are ready", "Back image ready", "360° view ready", "Your outfit pieces are ready" or "Generation paused"; the processing screen then says "We'll notify you…"); **Help & Support** (`app/help.tsx`: how garment photos, outfits, back/360, credits and editing work; a Contact Support button only when `EXPO_PUBLIC_SUPPORT_EMAIL` is set) and **Privacy** (`app/privacy.tsx`: what is stored, who can see it, AI processing, where it lives, removing and deleting — a plain-language summary, not a legal policy).
- **Sign Out** (confirmed in a sheet) and **Delete Account** (danger; sheet: "Your closet, photos and AI credits are removed for good. This can't be undone."; deletes on the server, then signs out). Version footer.
- Local mode: a "Local mode" card ("Not signed in. Your items live on your computer's wardrobe server.") and Appearance.

## 5. Garment Details (`mobile/src/components/ItemSheet.tsx`)
- Native page sheet that pages between items; × (round fill button), "N / M" counter, **Edit** (accent text).
- 372pt image stage on the stone tile; segmented **Front / Back / 360°** (Back and 360° shown for closet items, or when they exist).
  - **Back, none yet:** dashed frame, "No back image yet", "Add Back Image" (+ "· N credit" while billing is on). While it runs: shimmer + "Creating back image…".
  - **360°, none yet:** four fading thumbnails, "See it from every angle", "Generate 360°" (+ price); running: "Creating four angles…"; failed: the reason and "Try Again".
  - **360° ready:** the turntable (drag, ‹ › buttons, angle pill, "Drag to rotate · AI view").
- Title = the garment's name, then "Group · Type · Added Oct 18", tier badge; grouped facts: Color, Pattern, Details, Text, Back text (no Material — never guessed).
- Actions list: Add Back Image (price), Generate 360° View (price), Remove from closet.
- Paid actions (billing on) confirm with the cost sheet first (line, total, "Balance X → Y"); short of credits, or a server "not enough credits", opens the Not enough credits sheet. Finished work shows a toast ("✓ Back image ready · 1 credit used", "✓ 360° view ready").
- **Edit:** Name (placeholder = the derived name), Type with group shortcuts, Colors, Pattern chips, Details, Text; Save → "Changes saved" toast; unsaved-changes guard kept.
- **Remove:** confirmation sheet ("You can't undo this in the app." + "Credits used for its images are not returned." while billing is on); soft delete on the server.

## Screen-level acceptance
- Signed out you see Welcome on first launch, then Sign In; after the code you land on Home (or once, A welcome gift); restart keeps you signed in; Sign Out returns to Sign In.
- Every tab reachable from the bar; capture from Home and Add both land new pieces in Just added and the closet.
- Category chips on Home open Closet pre-filtered.
- Item sheet states (no back / back, 360 none / running / done / failed, edit, remove) all reachable on the phone.
- Light and dark mode readable; Reduce Motion removes drift, count-up and scrub crossfades.

## Credits (account mode; [spec](superpowers/specs/2026-10-18-ai-credits-app-design.md))
All figures come from the server (`GET /v1/credits`, `GET /v1/prices`); nothing is shown in local mode, and no amount is shown while billing is off.
- **Account:** balance of what was granted, meter, price list and activity (§4). Home shows the balance as a pill.
- **Every paid action** (front images, back image, 360, outfit pieces) confirms its cost first: a sheet with the line items, Total and "Balance X → Y" (garment photos: the preview's "Pieces in this photo" quote, CREDITS §6).
- **Not enough credits** (before starting, or when the server answers 402): a sheet with "available / needed credits needed", an amber bar, the reason and "Ask the app owner for more credits."; Adjust Selection where the user can lower the cost, View Price List otherwise. No purchase UI.
- **Starter credits:** a one-time "A welcome gift" screen after sign-in when the server has granted credits (§0).

## Outfit Photo import (built behind `WARDROBE_OUTFIT=on`, off by default; account mode only)

Shown only when `GET /v1/prices` says `outfit: true`. Design and measurements: [spec](superpowers/specs/2026-10-19-outfit-photo-two-step-design.md), [evaluation](superpowers/specs/outfit-import-evaluation.md).
- **Entry:** Add → Import from Outfit Photo, the camera's OUTFIT mode, Home's "Wearing it?" link, or "Try it as an outfit photo" after a garment photo was refused as worn (same photo, no auto-routing).
- **Detecting** (`app/outfit/detect.tsx`): the photo with a scanning band, "Finding garments…" and a "Detection is free" pill; when the free scan returns, the boxes pop in one by one ("N garments found"), then the pick screen opens. A failed scan explains and offers another photo.
- **Select Garments** (`app/outfit/pick.tsx`): the photo with tappable numbered boxes (selected = solid accent, unselected = dashed white); rows with a 62pt crop of the real photo, the category, "Group · Clear match" or amber "Not sure — please check", plain-language visibility notes, a check circle and **Edit** ("Correct this garment": type with shortcuts → sent with Generate and used for the image and the saved piece; "Not a garment" removes it). **+ Mark a missed garment**: drag across it on the photo and name its type; it joins the list selected (free, no model call). Shoes are not offered (D2); mostly hidden pieces start unselected (D3). Sticky footer: "N selected", "N credits · X available" (billing on), Generate.
- **Confirm cost** (billing on): sheet with "Front image × N", Total, "Balance X → Y", "Detection was free", "Generate · N credits". Short of credits → Not enough credits with "Deselect K garments to continue with what you have." and Adjust Selection. A changed price (server 409) refreshes prices and re-opens the sheet; nothing is charged.
- **Creating:** the processing card ("Taking them off the photo" → "Laying them flat" → "Adding final details").
- **Review** (`app/outfit/review.tsx`): "Review i of N", "N kept", Later; the crop of your photo next to the generated image, name, tier, AI note, **↻ Regenerate** (a new image from the same photo at the front price, confirmed with the cost sheet; replaces the image, stays in review), a **Keep** switch, a thumbnail strip, Back / Next, and on the last piece **Save N to Closet** (kept → closet, others discarded) → Saved. Failed picks are listed as not charged. Results stay out of the closet until saved; pending results reopen from Add (also after a restart).
- **Not in v1:** auto-routing, shoes, multi-person choice.

## Not built (see ROADMAP "Later")
A pre-save Review screen with an Original/Generated toggle and Save button, saved-item Regenerate, in-app restore of removed items, buying credits.
