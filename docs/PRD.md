# Product Requirements — Digital Wardrobe
Status: **Describes the app as built** · Updated: 2026-10-20

`PRODUCT.md` holds users, purpose and principles; this document holds the concrete requirements. Ideas from earlier planning that are not built are listed under "Later" in [ROADMAP.md](ROADMAP.md).

## Vision
Know what you own. Turn a casual phone photo of clothes into a clean, faithful catalog image of each piece and keep them together as a closet you can scan and recognize as yours.

## Users
Today: the owner, and a friends-and-family TestFlight beta being prepared (app name KIPS). Each person has a private wardrobe; the backend runs on the owner's Mac and is reachable at `api.kipscloset.com`.

## Requirements as built

### Accounts and privacy
1. Sign in with email and a 6-digit code (Supabase Auth); unknown emails create an account. Signing up asks for a name (1–40 characters) that the app greets the user with; it can be changed in Account. Resend after 60 s, change email, clear errors for wrong or expired codes.
2. The session survives app restarts (encrypted on the device) until Sign Out (Account tab, confirmed). **Delete Account** (Account, confirmed) removes the user, every row and every file for good.
3. Every wardrobe is private to its account: items, photos and jobs are isolated by row level security and the backend; another account's IDs answer "not found". Images are read through short-lived signed links, never public URLs.
4. Items follow the account across devices, and AI work keeps running on the server if the phone disconnects (jobs are polled; retries never create duplicates or a second paid call).
5. **Local mode:** a development build without Supabase settings runs as the original single-owner app over `runs/`; Account shows "Local mode" ("Not signed in. Your items live on your computer's wardrobe server."). A release build without settings won't start.

### Capture
6. Take a photo with the in-app camera or choose one from the library (Add tab or Home). In account mode a **free pre-scan** shows the pieces found with numbered boxes; the user leaves out any piece and sees the cost ("Generate N Items · N credits"). Processing runs on the server (the user can leave the screen, optionally get a push when ready), then a Results screen shows the pieces made. If the pre-scan fails, the approved max-fronts quote is used.
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

## AI Credits — confirmed direction (built; billing off unless enabled on the server)
- **One AI Credits wallet per account**, not separate caps for garments, back images and 360, and not provider tokens or currency as the unit.
- **Billing is per requested AI generation action, not per saved garment or existing wardrobe item.** Separate actions are front-image generation, optional back-image generation and optional 360 generation (one user-facing 360 action includes its four generated views). Each billable action has a fixed, **user-visible** credit price, presented before generation and in an in-app **AI Price List**. A garment can receive a back image or 360 later without requiring a second front-image purchase.
- Account shows **credits remaining** with a clearly labeled usage meter; no invented monthly reset or ambiguous denominator when balances come from several grants or purchases.
- F&F participants may receive promotional credits; real-launch users may buy credit packs. **Amounts, prices and policies are not approved.**
- No surprise charges for hidden AI retries, timeouts or failed generations. Users without enough credits can't start a chargeable action but keep full access to their wardrobe. Wallet changes are server-controlled.
- Built: per-account wallet and append-only ledger, per-action billing behind `WARDROBE_BILLING=on` (hold → charge only what was made → release), reconcile of unfinished holds, in-app balance, price list, activity and a cost sheet before every paid action, a one-time welcome grant (F&F: 40), and "not enough AI credits" (HTTP 402) before anything is uploaded. No purchases. Details and open decisions: [CREDITS.md](CREDITS.md).

## Outfit photo import — garments from a photo of a person wearing clothes (BUILT, behind `WARDROBE_OUTFIT=on`)

**Owner-approved direction (2026-10-19), now built (PRs #14–#17, #24 and follow-ups):** two separate input contexts, the laid-flat capture unchanged.

1. **Garment Photo:** the current single/multi-piece photo pipeline remains as built.
2. **Outfit Photo:** recognize clothing **worn by a person**, detect candidate items, show cheap original-image crop previews, let the user select/correct the desired items, display an exact AI Credits quote, and generate complete high-quality flat-lay catalog images **only for selected candidates**. Review generated results before saving in this new route.
3. The candidate-detection/review step must not debit **user** credits; successful confirmed final-image actions use the existing per-front wallet pricing. Model internal retries are not user-charged.
4. Visible garment features remain faithful; inferred unseen areas may be completed naturally but must not be presented as observed facts.
5. Routing may be automatic with manual override, or explicit mode choice at first, after accuracy/cost benchmarking.
6. Rescans, partial success, privacy/retention of photos containing people, ambiguous/multiple-person images and regeneration/refund policy need detailed design and evaluation.

**As built:** the user chooses the mode (no automatic classification; a garment photo refused as worn offers "Try it as an outfit photo"); a free scan detects up to 8 worn garments with preview crops of the real photo; the user picks, corrects a garment's type, removes non-garments or marks a missed one; fronts are generated only for the picks at the front-image price (exact quote, `409` if the price changed); results wait in review (keep / discard / ↻ regenerate at one front's price) and are hidden from the closet until kept. Failed picks aren't charged. The person photo is never saved as an item file and is removed after 24 h. Screens: [SCREENS.md](SCREENS.md).

See [two-stage outfit import design](superpowers/specs/2026-10-19-outfit-photo-two-step-design.md) and [Claude Code task](tasks/outfit-photo-two-step-flow.md).

## Cross-cutting
- English-only UI. Light and dark mode follow the system. Reduce Motion is honored everywhere.
- Paid model calls cost money: no extra calls or waiting beyond what a feature needs.
- Photos are sent to Gemini for processing; no secret key is ever in the app.

## Non-goals (current)
Outfit recommendations/styling, sharing/social, shopping, payments, Sign in with Apple or passwords (the only password account is the App Review demo account), brand detection, size/season tags.

## Acceptance
- Automated: `pytest`, `npx jest`, `npx tsc --noEmit`, `npx supabase test db`, and the two-user suite `pytest tests/integration` on the local stack (another account can't read, change or delete your rows, files or jobs).
- Manual, on the owner's iPhone: camera and library capture; a multi-piece photo yields one item per piece; catalog images recognizably the owner's pieces; blurry/dark photos rejected; edit, remove, back photo and 360 work and survive an app and server restart; sign-in, restart still signed in, sign-out.

## Open questions
- Outfit recommendations/styling remain undecided.
- A cloud host instead of the owner's Mac, and opening the product beyond the friends-and-family beta.
- Public credit prices (F&F uses provisional 1 / 1 / 3) and purchase packs; regeneration and refund policy beyond the beta.
- Better print fidelity across 360 angles.
