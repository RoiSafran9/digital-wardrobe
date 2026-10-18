# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Today: the owner, using it on their own iPhone on home Wi-Fi, photographing their real clothes to build a digital copy of their closet.

Intended: a product for other people with the same job. Accounts and per-user private wardrobes exist (email-code sign-in); the backend still runs on the owner's Mac, so other people can't use it yet (see Capabilities and Constraints).

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
- Backend runs on the owner's Mac (FastAPI); the phone reaches it over the LAN. Signed in, items, photos and AI jobs are stored per account in Supabase and follow the account across devices; work keeps running on the server if the phone disconnects. Without Supabase settings the app runs in local mode over `runs/`. No cloud host yet.
- Removed items are soft-deleted and recoverable.
- Optional 360 "on body" view per item: four AI ghost-mannequin angles (~16¢, ~1 min), made on request in the background and labelled as AI.
- AI Credits are a confirmed direction (one balance per account). Jobs record their cost and the backend has the hooks to hold, charge and refund credits, but billing is off: no prices, balances or purchases yet.
- **Planned (not implemented):** a second capture path for photos of a person wearing multiple garments: detect candidates first, let the user choose, then generate high-quality catalog fronts only for chosen candidates. Detection is free to the user; paid AI-generation actions use the same account wallet. Preserve the existing laid-flat capture route. See `docs/superpowers/specs/2026-10-19-outfit-photo-two-step-design.md`.
- Undecided: outfit recommendations/styling, the cloud host, and opening the product to other users.

## Confirmed direction: AI Credits

- Each signed-in user has **one unified AI Credits balance**, not separate quotas for front images, back images and 360. **Credits are consumed by explicitly requested AI generation actions, never by the number of garment records a user owns.** Creating a front image, adding a back image and creating a bundled four-view 360 are distinct billable action types. Enhancements can be created later for an existing item.
- The **Account** screen shows current credits, a usage/progress meter and an in-app **AI Price List**. Each action shows its price before proceeding.
- Numerical action costs, launch packs, promotional grants and the precise charging moment still need approval; examples are not launch prices.
- **Current status:** accounts exist; credits are hooks only (job cost recording, a server price list that is off, a credit gate). No wallet, balance, meter, price-list screen or purchases yet.
- See `docs/CREDITS.md` for the decision record and safety/implementation proposal.

## Brand Commitments

Standing preference: the category standard, native iOS (system font, grouped backgrounds, one blue tint),
executed at full craft; immersion comes from motion of the garments, not decoration. Chosen in an impeccable
direction round on 2026-10-16. Dark mode follows the system.

## Evidence on Hand

Real items photographed by the owner (in `runs/`, not committed). No users, testimonials, press or metrics exist; future work must not invent them.

## Product Principles

1. The garment is the hero: faithful to the real piece over polished-looking.
2. Never make the owner wait or pay for nothing: no extra model calls, and say what is happening during long work.
3. Try first, ask for a retake only when the result would be wrong.
4. The owner stays in control: anything the model decides can be corrected or removed, and removal is recoverable.
5. Every wardrobe is private to its account: nobody else can see it, and nothing about another account is ever guessable from the app.
