# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Today: the owner, photographing their real clothes to build a digital copy of their closet, and a small friends-and-family TestFlight beta being prepared (app name **KIPS**).

Intended: a product for other people with the same job. Accounts and per-user private wardrobes exist (email-code sign-in); the backend runs on the owner's Mac but is reachable from anywhere at `api.kipscloset.com` (see Capabilities and Constraints).

## Product Purpose

Know what you own. The app turns a casual phone photo of clothes lying on a bed or floor into a clean, faithful catalog image of each piece and keeps them together as a browsable closet. Success means the closet is a trustworthy mirror of the real wardrobe: you can scan it and recognize every piece as yours.

## Positioning

Fidelity to the owner's actual garment, not an idealized product shot. Each piece is reproduced as photographed — wash, fade, texture, drawstrings, prints and proportions — only unfolded, smoothed and placed on a clean background (or cut out). Several pieces can be shot at once and are separated into individual items.

## Operating Context

- Clothes are laid out at home (bed, floor), shot from above with the phone camera or picked from the photo library; one piece or a few side by side.
- Processing takes roughly 15–60 seconds per photo; the user waits in the app.
- Optional extra photo of an item's back, added right after capture or later from the closet.
- Items can be corrected by hand (type, colors, pattern, details, printed text) or removed.

## Capabilities and Constraints

- Pipeline per photo: quality check → detection with facts (Gemini vision) → crop → catalog image generation (Gemini image) with a color check and retries → local background removal (rembg, no API cost).
- Pieces touching the photo edge are completed rather than rejected, with a non-blocking tip; real failures ask for a retake with a concrete instruction.
- Paid model calls cost money; the owner prefers no extra calls or added latency beyond what a feature needs.
- Backend runs on the owner's Mac (FastAPI), reachable over HTTPS at `api.kipscloset.com` through a Cloudflare Tunnel (home Wi-Fi in development). Signed in, items, photos and AI jobs are stored per account in Supabase and follow the account across devices; work keeps running on the server if the phone disconnects. Without Supabase settings the app runs in local mode over `runs/`. A Docker image for a cloud host is prepared, not deployed; the Mac must stay on and awake.
- Removed items are soft-deleted and recoverable.
- Optional 360 "on body" view per item: four AI ghost-mannequin angles (~16¢, ~1 min), made on request in the background and labelled as AI.
- AI Credits wallet, ledger, per-action pricing hooks, automated reconciliation and in-app balance/price views are already implemented. Actual deduction remains OFF by default unless `WARDROBE_BILLING=on` is configured and verified. There is no payment integration. A one-time 40-credit welcome grant for new beta accounts is built (`WARDROBE_WELCOME_CREDITS`, `WARDROBE_BETA_INVITES`).
- **Outfit photo import (built, behind `WARDROBE_OUTFIT=on`):** a second capture path for a photo of a person wearing clothes: a free scan finds the garments, the user picks (and can correct or add missed ones), catalog fronts are generated only for the picks at the front-image price, and results wait in a review step (keep, discard, regenerate) before they enter the closet. The laid-flat garment route is unchanged. See `docs/superpowers/specs/2026-10-19-outfit-photo-two-step-design.md`.
- Garment photos get a free pre-scan too: the user sees the pieces found and picks which to create before paying.
- Undecided: outfit recommendations/styling, a cloud host, and opening the product beyond the friends-and-family beta.

## Confirmed direction: AI Credits

- Each signed-in user has **one unified AI Credits balance**, not separate quotas for front images, back images and 360. **Credits are consumed by explicitly requested AI generation actions, never by the number of garment records a user owns.** Creating a front image, adding a back image and creating a bundled four-view 360 are distinct billable action types. Enhancements can be created later for an existing item.
- The **Account** screen shows current credits, a usage/progress meter and an in-app **AI Price List**. Each action shows its price before proceeding.
- Provisional F&F action prices are **1 front / 1 back / 3 for one 360**; public-launch pricing remains unapproved. **For the Friends & Family TestFlight beta, eligible new users will receive an automatic free one-time starter grant** (40 Credits proposed; exact grant not yet selected), with no purchases, subscriptions or payments.
- **Current status:** accounts, a wallet, grant/charge ledger, server-controlled billing behind a default-OFF flag, account balance display and price-list screen exist. The exact-once automatic new-user welcome grant, hosted rollout and any real purchase are not yet implemented.
- See `docs/CREDITS.md` for the decision record; TestFlight rollout plan: `docs/tasks/testflight-beta-launch-master-plan.md`.

## Brand Commitments

Native iOS at full craft (SF Pro, SF Symbols, native sheets, one blue accent), warmed by the owner's design
handoff (2026-10-19): white screens with warm-grey grouped cards, stone garment tiles with soft shadows, and
Instrument Serif for four editorial headlines only. Immersion comes from motion of the garments, not decoration.
Dark mode follows the system unless the user picks one in Account. See `DESIGN.md`.

## Evidence on Hand

Real items photographed by the owner (in `runs/`, not committed). No users, testimonials, press or metrics exist; future work must not invent them.

## Product Principles

1. The garment is the hero: faithful to the real piece over polished-looking.
2. Never make the owner wait or pay for nothing: no extra model calls, and say what is happening during long work.
3. Try first, ask for a retake only when the result would be wrong.
4. The owner stays in control: anything the model decides can be corrected or removed, and removal is recoverable.
5. Every wardrobe is private to its account: nobody else can see it, and nothing about another account is ever guessable from the app.
