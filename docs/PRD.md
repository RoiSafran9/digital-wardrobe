# Product Requirements — Digital Wardrobe
Status: **Describes the app as built** · Updated: 2026-10-18

`PRODUCT.md` holds users, purpose and principles; this document holds the concrete requirements. Ideas from earlier planning that are not built are listed under "Later" in [ROADMAP.md](ROADMAP.md).

## Vision
Know what you own. Turn a casual phone photo of clothes into a clean, faithful catalog image of each piece and keep them together as a closet you can scan and recognize as yours.

## Users
Today: the owner, on their own iPhone over home Wi-Fi. Intended: other people with the same job, each with a private wardrobe; accounts exist, but the backend still runs on the owner's Mac, so nobody else can use it yet.

## Requirements as built

### Accounts and privacy
1. Sign in with email and a 6-digit code (Supabase Auth); unknown emails create an account. Resend after 60 s, change email, clear errors for wrong or expired codes.
2. The session survives app restarts (encrypted on the device) until Sign Out (Account tab, confirmed).
3. Every wardrobe is private to its account: items, photos and jobs are isolated by row level security and the backend; another account's IDs answer "not found". Images are read through short-lived signed links, never public URLs.
4. Items follow the account across devices, and AI work keeps running on the server if the phone disconnects (jobs are polled; retries never create duplicates or a second paid call).
5. **Local mode:** a development build without Supabase settings runs as the original single-owner app over `runs/`; Account shows "Local mode" ("Not signed in. Your items live on your computer's wardrobe server."). A release build without settings won't start.

### Capture
6. Take a photo or choose one from the library, from the Add tab or Home's quick-add buttons. When processing ends the app shows the new pieces on Home under Just added.
7. One photo may hold one piece or several side by side; each included piece becomes its own item. Clothes being worn, accessories (sunglasses, jewelry) and non-clothing objects are skipped.
8. The user waits in the app (roughly 15–60 s) with a staged status ("Finding your pieces" → "Smoothing them out" → "Cutting them out") that never claims to be done early.
9. A photo that is blurry, too dark or too small is rejected before any model call; the app asks to try again laid flat in good light (for a back photo it names the exact problem).
10. Processed items go straight into the closet — there is no separate review/Save step. The owner corrects or removes afterwards.

### Catalog image
11. For each piece the model generates a catalog image of the **same** garment, unfolded and smoothed on a white background, then a local cutout removes the background.
12. **Fidelity first**: color, wash, fade, texture, print, printed text, trims and proportions match the photographed piece. No invented logos, details or idealized versions. A local check compares color and printed text with the photo and retries generation with the violations.
13. The closet shows the cutout on a neutral tile; if no cutout could be made it shows the white-background image. Pieces whose generation never succeeded get a retake tip and are not listed in the closet.
14. Each item gets a quality tier: **high** (passed, fully visible), **medium** (mostly hidden by another piece, or ran past the photo edge and was completed — with a non-blocking tip), **low** (generation or check failed after retries — with a retake instruction).
15. In account mode each new item keeps its original upload privately as its source; local mode keeps only the crop.

### Facts
16. Detected per piece in the same model call: category (one word, e.g. "t-shirt"), colors (closed list of 15), pattern (closed list of 6), details/trims, visible printed text, visible and hidden parts. Brand is not extracted.
17. Categories are the model's words, normalized for grouping and filtering ("T-shirt"); there is no fixed category list.

### Closet and item
18. Closet: grid of the user's items, newest first, category filter (also openable pre-filtered from Home), pull to refresh. Items with a finished 360 show a badge.
19. Item sheet: large image, Front/Back switch when a back exists, facts list, Edit, Remove.
20. Edit: category, colors, pattern, details and printed text, validated by the server against the same vocabularies; the model's original facts are kept on first edit.
21. Remove is a soft delete (recoverable by the owner on the server; there is no in-app restore yet).
22. Back photo (optional): added right after capture ("+ Back" in Just added) or later from the item. Same checks; the front is used as a reference so both sides read as one garment; replacing a back keeps the earlier one.
23. 360 "on body" view (optional, on request only): four AI ghost-mannequin angles (front, right, back, left) from the item's catalog images, ~16¢ and ~1 min, generated in the background; the sheet can close and reopen while it runs. Turn by drag, tap or VoiceOver; labelled "360 · AI view". Known accepted weakness: prints may drift between angles.

### Home and Account
24. Home: large title with piece count and pieces added this week; two rows of recent garments drifting slowly (touch pauses, tap opens); stats (pieces, categories, colors); quick add; Just added; category chips with counts. Empty closet shows a single empty state with the add buttons.
25. Account: signed-in email and Sign Out, or the local-mode note.

## Cross-cutting
- English-only UI. Light and dark mode follow the system. Reduce Motion is honored everywhere.
- Paid model calls cost money: no extra calls or waiting beyond what a feature needs.
- AI Credits are a confirmed direction; jobs already record their cost and the backend has the hooks, but billing is off (no prices, balances or purchases).
- Photos are sent to Gemini for processing; no secret key is ever in the app.

## Non-goals (current)
Outfits and recommendations, sharing/social, shopping, payments, Sign in with Apple or passwords, brand detection, size/season tags.

## Acceptance
- Automated: `pytest`, `npx jest`, `npx tsc --noEmit`, `npx supabase test db`, and the two-user suite `pytest tests/integration` on the local stack (another account can't read, change or delete your rows, files or jobs).
- Manual, on the owner's iPhone: camera and library capture; a multi-piece photo yields one item per piece; catalog images recognizably the owner's pieces; blurry/dark photos rejected; edit, remove, back photo and 360 work and survive an app and server restart; sign-in, restart still signed in, sign-out.

## Open questions
- Outfit features — undecided.
- The cloud host, and opening the product to other users.
- Credit prices and how multi-piece photos are charged (see the credits integration notes).
- Better print fidelity across 360 angles.
