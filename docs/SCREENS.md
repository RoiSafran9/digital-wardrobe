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
- Signed in: email and Sign Out (confirmed).
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

## Credits experience (confirmed direction; not built)
- **Account → AI Credits:** remaining balance and a readable usage bar with an honest baseline (e.g. a specific granted pack); for combined balances or top-ups, no misleading percentage.
- **Account → AI Price List:** read-only list of **AI generation actions, not per-garment ownership fees** — **Create Front Image**, **Create Back Image**, **Create 360**, and **Regenerate** if it becomes separately chargeable. A 360 is one user-facing action despite generating four views internally. Provisional F&F rates for design: **1 front / 1 back / 3 for one 360** (not live billing, not yet the public prices); the displayed rates must come from the server's `GET /v1/prices` response (backend keys remain `garment`/`back`/`turn` today).
- Every billable entry point (capture, + Back, View in 360) shows its price and the balance, with explicit confirmation where the charge or the number of generated items might surprise the user.
- Insufficient credits: a useful explanation and a way to get more (admin-issued F&F grants first; paid packs only after payment integration). Viewing saved items keeps working.
- Credit History / Activity may list grants, charges and refunds; presentation pending screen design.

## Not built (see ROADMAP "Later")
A pre-save Review screen with an Original/Generated toggle and Save button, saved-item Regenerate, in-app restore of removed items, a credits balance on Account.
