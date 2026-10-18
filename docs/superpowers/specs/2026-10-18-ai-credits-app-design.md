# AI Credits in the App (Milestone 3)

Status: **approved by the owner 2026-10-18 ("as proposed")** · Builds on the [wallet design](2026-10-18-ai-credits-wallet-design.md) and [CREDITS.md](../../CREDITS.md). Visual rules: [DESIGN.md](../../../DESIGN.md).

Account mode only; local mode shows none of this. Everything comes from the server (`GET /v1/credits`, `GET /v1/prices`); the app never hardcodes a price. App copy is English.

## Data
- A `CreditsProvider` (inside the signed-in app) loads credits and prices, exposes `refresh()`, and is cleared when the account changes or signs out.
- Refreshed: on sign-in, when Account gains focus, and after every capture, back photo and 360 (success or failure).
- `GET /v1/credits` gains `granted` (sum of grants) and `used` (sum of charges) so the app can show an honest baseline without paging the whole history.

## Account
- **AI Credits** card: available credits large (Title 2, tabular); "N held for work in progress" when held > 0; a 2pt tint bar + footnote "Used X of Y credits granted" when anything was granted (never a bare percentage).
- Billing off: footnote "Billing is off — AI actions don't use credits yet."
- Rows: **AI Price List** (only while billing is on) → sheet listing Front image / Back image / 360 view with their credits and a note that one 360 is one action and that a photo with several pieces costs one front per piece made. **Credit activity** → sheet listing grants (+N, the grant's reason) and charges (−N, the action); releases are internal and not listed; paged with "Show more".
- Out of credits help text: "Ask the app owner for more credits." (F&F grants are admin-issued; no purchases.)

## Capture (Add tab and Home quick add), billing on only
- A **Pieces in this photo** stepper (1–20, default 1, limited by what the user can afford) above the buttons, with "Up to N front images · N credits · M available" and "You pay only for the pieces made. Extra pieces aren't made." The stepper value is sent as `max_fronts`.
- Not enough for one front: buttons disabled and the out-of-credits note.
- Just added: when `over_limit > 0`, "N more piece(s) in the photo weren't made (over your limit). Take another photo to add them."

## Back and 360, billing on only
- "+ Back" action sheet message adds "Uses N credit(s) · M available."; not enough → the sheet doesn't open and the error says so.
- "View in 360" note adds "· N credits"; pressing it asks for confirmation (Alert: "Make a 360 view?" / "Uses N credits. You have M." / Cancel / Make 360).
- HTTP 402 anywhere becomes "Not enough AI credits. Ask the app owner for more." and refreshes credits.

## Not in M3
Purchases, regeneration pricing, unsaved previews, a usage percentage.
