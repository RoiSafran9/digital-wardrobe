# Screen Map — Digital Wardrobe
Status: **As built** · Updated: 2026-10-18

Visual system, tokens and motion rules: [DESIGN.md](../DESIGN.md) (native iOS: system font, grouped backgrounds, one blue tint, light/dark, Reduce Motion). Feature specs: `docs/superpowers/specs/`.

## Navigation
- Signed out (account mode): only **Sign In**. Local mode skips it. A release build without Supabase settings shows a blocking "not configured" screen.
- Signed in: bottom tabs **Home** (default) · **Closet** · **Add** · **Account** (`mobile/app/(tabs)/`). The item sheet opens over Home or Closet; it is not a tab.

## 0. Sign In (`mobile/app/sign-in.tsx`)
- Email step: "Enter your email and we'll send you a 6-digit code." → Send code.
- Code step: 6-digit field (one-time-code autofill) → Sign in; "Resend code in Ns" (60 s); change email; clear messages for wrong/expired codes and rate limits.

## 1. Home (`mobile/app/(tabs)/index.tsx`)
- Large title "Wardrobe" with "N pieces · M added this week".
- Running garments: two rows of recent cutouts drifting in opposite directions; touch pauses, tap opens the item. Static under Reduce Motion.
- Stats tiles: Pieces, Categories, Colors (count up on first appearance).
- Quick add: "Take photo" (primary) and "Choose from library" start capture without leaving Home.
- **Just added** (`src/components/JustAdded.tsx`): the latest capture's pieces with tier, retake instruction or edge-completion tip, and "+ Back"; "N pieces couldn't be processed"; "No pieces found in that photo…" when nothing was detected or the photo failed the quality check; "Done" clears it.
- By category: chips with counts; tapping opens Closet filtered to that category.
- Empty closet: one empty state with the two add buttons.

## 2. Closet (`mobile/app/(tabs)/closet.tsx`)
- Large title, scrollable category filter chips (accepts a `category` route param from Home).
- Two-column grid of garment tiles (cutout on tile, category and colors below); "360" badge when a 360 view is done.
- Pull to refresh; tapping a tile opens the item sheet, which swipes between items. Failed loads show an error instead of crashing.

## 3. Add (`mobile/app/(tabs)/add.tsx`)
- "Add a piece" with three shooting tips (lay it flat, shoot from above, a few at once works).
- Take photo / Choose from library; staged processing status during the run; upload or camera errors shown inline.
- On success the app returns to Home, where the run appears under Just added.

## 4. Account (`mobile/app/(tabs)/account.tsx`)
- Signed in: email, the AI Credits card (see Credits below) and Sign Out (confirmed).
- Local mode: a "Local mode" row: "Not signed in. Your items live on your computer's wardrobe server."

## 5. Item sheet (`mobile/src/components/ItemSheet.tsx`)
- Large garment image (cutout → white image → crop fallback); Front/Back segmented control when a back exists, "+ Back" when not.
- 360: "View in 360" with a cost/time note → staged status while running (sheet can close and reopen) → turnable view labelled "360 · AI view" → on failure the error and "Try again".
- Facts as a grouped list: Colors, Pattern, Details, Text, Back text.
- Edit (category, colors, pattern, details, text), with an unsaved-changes guard.
- "Remove from closet" as the last row, confirmed; recoverable on the server.

## Screen-level acceptance
- Signed out you see only Sign In; after the code you land on Home; restart keeps you signed in; Sign Out returns to Sign In.
- Every tab reachable from the bar; capture from Home and Add both land new pieces in Just added and the closet.
- Category chips on Home open Closet pre-filtered.
- Item sheet states (no back / back, 360 none / running / done / failed, edit, remove) all reachable on the phone.
- Light and dark mode readable; Reduce Motion removes drift, count-up and scrub crossfades.

## Credits (account mode; [spec](superpowers/specs/2026-10-18-ai-credits-app-design.md))
All figures come from the server (`GET /v1/credits`, `GET /v1/prices`); nothing is shown in local mode.
- **Account → AI Credits card:** "N available", "N held for work in progress" while a job runs, a 2pt bar with "Used X of Y credits granted". Billing off: "Billing is off — AI actions don't use credits yet." and no price list.
- **AI Price List** (billing on): Front image / Back image / 360 view with their credits, and how multi-piece photos, 360 and failures are charged.
- **Credit activity:** grants (+N, with the grant's reason) and charges (−N, the action), newest first, "Show more".
- **Capture (Add and Home), billing on:** "Pieces in this photo" stepper (1 up to what you can afford, max 20) with "Up to N front images · N credits · M available. You pay only for the pieces made; extra pieces aren't made." Not enough credits: buttons off and an explanation. Just added notes pieces left out over the limit.
- **+ Back** (billing on): the photo-source sheet says the cost and balance; not enough credits → an explanation instead.
- **View in 360** (billing on): the note adds the cost; pressing asks "Make a 360 view?" first.
- Out of credits anywhere: "Not enough AI credits. Ask the app owner for more."

## Not built (see ROADMAP "Later")
A pre-save Review screen with an Original/Generated toggle and Save button, saved-item Regenerate, in-app restore of removed items, buying credits.
