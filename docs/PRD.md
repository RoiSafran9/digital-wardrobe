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
2. The session survives app restarts (encrypted on the device) until Sign Out (Account tab, confirmed). **Delete Account** (Account, confirmed) removes the user, every row and every file for good.
3. Every wardrobe is private to its account: items, photos and jobs are isolated by row level security and the backend; another account's IDs answer "not found". Images are read through short-lived signed links, never public URLs.
4. Items follow the account across devices, and AI work keeps running on the server if the phone disconnects (jobs are polled; retries never create duplicates or a second paid call).
5. **Local mode:** a development build without Supabase settings runs as the original single-owner app over `runs/`; Account shows "Local mode" ("Not signed in. Your items live on your computer's wardrobe server."). A release build without settings won't start.

### Capture
6. Take a photo with the in-app camera or choose one from the library (Add tab or Home). A preview confirms the photo and, with billing on, the most front images to pay for; processing runs on the server (the user can leave the screen), then a Results screen shows the pieces made.
7. One photo may hold one piece or several side by side; each included piece becomes its own item. Clothes being worn, accessories (sunglasses, jewelry) and non-clothing objects are skipped.
8. The user waits in the app (roughly 15–60 s) with a staged status ("Finding your pieces" → "Smoothing them out" → "Cutting them out") that never claims to be done early.
9. A photo that is blurry, too dark or too small is rejected before any model call; the app asks to try again laid flat in good light (for a back photo it names the exact problem).
10. Processed items are saved when made; the Results screen lets the user deselect pieces before "Add N to Closet" (deselected pieces are soft-deleted; credits for made pieces are not returned). The owner corrects or removes later too.

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
24. Home: greeting with the balance, a search field into the closet, "Add to closet" tiles that name the photo they want (garment photo: camera or library → garment flow; outfit photo: choose a photo → outfit flow), and the closet as category rows. Empty closet: labelled garment-photo and outfit-photo rows plus tips. Every photo entry point in the app names the kind of photo it expects.
25. Account: profile (initials, email), AI Credits balance of what was granted with a low-credit meter, price list and activity, Appearance (System/Light/Dark), Sign Out and Delete Account; or the local-mode note.

## AI Credits — confirmed direction (not built beyond hooks)
- **One AI Credits wallet per account**, not separate caps for garments, back images and 360, and not provider tokens or currency as the unit.
- **Billing is per requested AI generation action, not per saved garment or existing wardrobe item.** Separate actions are front-image generation, optional back-image generation and optional 360 generation (one user-facing 360 action includes its four generated views). Each billable action has a fixed, **user-visible** credit price, presented before generation and in an in-app **AI Price List**. A garment can receive a back image or 360 later without requiring a second front-image purchase.
- Account shows **credits remaining** with a clearly labeled usage meter; no invented monthly reset or ambiguous denominator when balances come from several grants or purchases.
- F&F participants may receive promotional credits; real-launch users may buy credit packs. **Amounts, prices and policies are not approved.**
- No surprise charges for hidden AI retries, timeouts or failed generations. Users without enough credits can't start a chargeable action but keep full access to their wardrobe. Wallet changes are server-controlled.
- Built today: job cost recording, the server price list (off), credit gate hooks and `GET /v1/prices`; an over-budget request would get "not enough AI credits" (HTTP 402) before anything is uploaded. No wallet, balance, meter, price-list screen or purchases. Details and open decisions: [CREDITS.md](CREDITS.md).

## Planned feature — import garments from a photo of a person wearing clothes (NOT BUILT)

**Owner-approved high-level direction (2026-10-19):** support two separate input contexts without changing the existing laid-flat capture behavior.

1. **Garment Photo:** the current single/multi-piece photo pipeline remains as built.
2. **Outfit Photo:** recognize clothing **worn by a person**, detect candidate items, show cheap original-image crop previews, let the user select/correct the desired items, display an exact AI Credits quote, and generate complete high-quality flat-lay catalog images **only for selected candidates**. Review generated results before saving in this new route.
3. The candidate-detection/review step must not debit **user** credits; successful confirmed final-image actions use the existing per-front wallet pricing. Model internal retries are not user-charged.
4. Visible garment features remain faithful; inferred unseen areas may be completed naturally but must not be presented as observed facts.
5. Routing may be automatic with manual override, or explicit mode choice at first, after accuracy/cost benchmarking.
6. Rescans, partial success, privacy/retention of photos containing people, ambiguous/multiple-person images and regeneration/refund policy need detailed design and evaluation.

**Not yet implemented:** mode classification, worn-garment detection, candidate picker, person-photo reconstruction, selection-specific charging. These require an offline feasibility gate first.

See [two-stage outfit import design](superpowers/specs/2026-10-19-outfit-photo-two-step-design.md) and [Claude Code task](tasks/outfit-photo-two-step-flow.md).

## Cross-cutting
- English-only UI. Light and dark mode follow the system. Reduce Motion is honored everywhere.
- Paid model calls cost money: no extra calls or waiting beyond what a feature needs.
- Photos are sent to Gemini for processing; no secret key is ever in the app.

## Non-goals (current)
Outfits and recommendations, sharing/social, shopping, payments, Sign in with Apple or passwords, brand detection, size/season tags.

## Acceptance
- Automated: `pytest`, `npx jest`, `npx tsc --noEmit`, `npx supabase test db`, and the two-user suite `pytest tests/integration` on the local stack (another account can't read, change or delete your rows, files or jobs).
- Manual, on the owner's iPhone: camera and library capture; a multi-piece photo yields one item per piece; catalog images recognizably the owner's pieces; blurry/dark photos rejected; edit, remove, back photo and 360 work and survive an app and server restart; sign-in, restart still signed in, sign-out.

## Open questions
- **Outfit Photo import:** high-level two-stage direction approved, implementation and quality pending evaluation (see linked planned-feature section). Outfit recommendations remain undecided.
- The cloud host, and opening the product to other users.
- Exact credit prices **per front-image, back-image and 360 generation action**; multi-piece photos need an explicit counting and up-front quote rule. The number of garments stored is not itself a billing unit (see the credits integration notes).
- Better print fidelity across 360 angles.
