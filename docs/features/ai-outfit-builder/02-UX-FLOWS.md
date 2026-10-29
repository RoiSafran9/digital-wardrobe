# UX & UI Specification — Build My Look

**Status:** Product design draft, not high-fidelity UI. Match actual KIPS visual system. Use English UI copy.

## Design principles

- **Choice with little effort:** One primary button, optional filters with sane defaults.
- **Visual over verbal:** Clothing images and combinations dominate; AI-generated prose is brief.
- **No false promises:** Entire outfit consists of items actually saved by the current user.
- **Control without friction:** Tap to swap an item, one-tap apply, immediate return to edited look.
- **No premature complexity:** No chatbot, style quiz, weather permissions, history, diary or save-look database.

## Screen map

| Screen / state | Content | Primary action | Exit |
|---|---|---|---|
| U0. Entry | `Build My Look` prominent action on Home/Closet | Open Builder | Normal nav |
| U1. Preferences | Occasion, Style, Vibe, Weather, optionally Colors | `Generate Looks` | Back |
| U2. Generating | Skeleton cards, concise progress, optional cancel/back | Wait / return | Back |
| U3. Recommendations | 1–3 real wardrobe-based look cards; name + short rationale | Tap a look | Back / `Try Again` |
| U4. Look detail | Larger component garment images + labels | Tap garment to swap | Back to results |
| U5. Swap sheet | Alternative owned garments for the tapped slot | `Use This Piece` | Dismiss |
| E1. Closet too sparse | Missing garment slot(s) explanation | `Add Clothes` | Back |
| E2. No suitable combination | Explain constraints or missing data | `Adjust Preferences` | Back |
| E3. No swap alternatives | Friendly explanation | `Keep This Piece` | Back |
| E4. API/error | Keep current good results; error + retry | `Try Again` | Back |

## U0 — Entry point

- Action title: **`Build My Look`**.
- Supporting: `Outfit ideas made from your own closet.`
- Entry in existing Home/Closet navigation, not necessarily a new tab.
- In an empty closet, allow entry but show a meaningful empty state and direct Add Clothes action.
- Does not require completing a separate style questionnaire.

## U1 — Parameters form

Suggested hierarchy:

**Heading:** `What are you dressing for?`  
**Subheading:** `Pick what matters today. We'll use only pieces from your closet.`

1. **Occasion** (prominent, optional, default `Any`): `Everyday`, `Work`, `Date`, `Going Out`, `Formal`.
2. **Style** (optional, default `Any`): `Casual`, `Smart Casual`, `Elegant`, `Streetwear`, `Sporty`.
3. **Vibe** (optional, default `Any`): `Relaxed`, `Confident`, `Minimal`, `Bold`.
4. **Weather** (optional, manual selection; default `Any`): `Hot`, `Warm`, `Mild`, `Cold`, `Rainy`.
5. **Colors** (optional, under `More options`; default `Any`): `Neutral`, `Colorful`, `Dark`, `Light`.

Each single-select group has `Any` / `No preference` as a real option and can be cleared. Keep at most two-three groups visible initially if vertical space is tight; `Weather` still must be discoverable. Avoid an endless form; don't force all selections.

**CTA:** `Generate Looks` (enabled without any explicit selections if wardrobe supports it).  
**Helper:** `Made with clothes you already own.`

**Weather copy:** `Choose the weather yourself` or `What's the weather like?` (never `We checked the weather`). `Rainy` represents precipitation preference, not both rain and cold. No geolocation permission prompt.

**Unsupported combinations:** A user may select `Formal + Sporty`; don't prevent selection. Try to find the best valid match, and if none is suitable ask the user to adjust one parameter rather than secretly ignoring a strong constraint.

## U2 — Loading

- Text: `Putting your looks together…`
- Static/skeleton clothing-card layouts; subtle low-distraction motion.
- Don't show fabricated partially chosen garments before validated results arrive.
- Avoid made-up percentages or fixed completion-time promises.
- If model slow/fails, use server fallback where possible, otherwise show retry.

## U3 — Result list

**Heading:** `Your Looks`  
**Subheading:** `{N} ideas from your closet` where N is real successful count (1, 2 or 3).

Each vertically scrollable card:
- Look title: e.g. `Relaxed City`, `Easy Workday`.
- Actual **existing catalog photos** of component items, separated clearly in a styled flat-lay/card arrangement. Never use image-generation placeholders or external product photography.
- Garment labels/categories and optionally color.
- One-sentence rationale: e.g. `A relaxed combination for a warm workday.` only when weather `Warm` and work are really chosen.
- Tap card or `Explore Look` opens U4.
- Secondary action: `Generate Again` re-requests suggestions using current explicit inputs; not automatically learning from previously rejected looks.

If only one or two valid looks, show that number and an optional explanation: `These are the combinations that match what you picked.` No duplicated filler.

**Display design:** Use item images already in the wardrobe, not a generative composite image. A tiled layout is acceptable and easier to make accurate than simulated garments being worn on a model.

## U4 — Look detail

- Full look using catalog images arranged by body-slot layout when useful: top, optional outerwear, bottom, optional shoes; **or** one-piece, optional outerwear, shoes.
- Short `Why this works` copy if confidence sufficient.
- Label each item with real category/name as available.
- Tapping an item makes its slot active, opens U5.
- Use subtle `Tap any piece to swap it` helper.
- Retain all other components during a swap; display changed item instantly and adjust rationale only when consistent.
- No `Save Outfit` in MVP because persistent outfits/history are out of scope. The back action returns to the current results.

## U5 — Swap This Piece

**Presentation:** Bottom sheet on item tap.

- Header: `Swap This Piece`.
- Current item thumbnail with category/label.
- Title for alternatives: `Other options from your closet`.
- Ranked top compatible alternatives from current user's item set, excluding the current selected item, the other items already used in this look, wrong-category/slot, deleted or incomplete items.
- Tap an alternative → `Use This Piece` (or direct tap applies; choose one interaction consistently).
- Optional `Browse All` for valid same-slot owned alternatives, regardless of aesthetic ranking; users retain final choice.
- After selection, keep same look in U4 with just that one item changed.
- If none: `No other [category] in your closet yet.` with `Keep This Piece`; optional `Add Clothes` navigation.
- A second user-session model request is **not required** to replace an item; rank alternatives with existing metadata/rules, optionally re-evaluate short rationale asynchronously.

**Slot rules:** A `top` swaps with a `top`, `bottom` with `bottom`, `outerwear` with `outerwear`, `footwear` with `footwear`, `one_piece` with `one_piece`. Do not swap a dress for pants without rebuilding the whole structure, which is out of V1.

## Empty/edge states

| Condition | Suggested copy | UX |
|---|---|---|
| Zero wardrobe items | `Your looks start in your closet.` / `Add a few pieces to see outfits made just for you.` | `Add Clothes` |
| Only tops, no bottoms / one-pieces | `Add a bottom or a one-piece to build your first look.` | `Add Clothes` (no fake pants) |
| One valid combination | `Here's a look using what you own.` | Show exactly one |
| Constraints too restrictive | `We couldn't find a good match for all these choices.` | `Adjust Preferences`; optional clear chips |
| Missing garment image | Skip the item if photo required; never show stock photo | Explain incomplete catalog where useful |
| No swap alternative | `No alternatives for this piece yet.` | Dismiss; keep look |
| Item deleted after suggestion | `This piece is no longer in your closet.` | Regenerate/refresh, block swap |
| Network/LLM error | `We couldn't make new looks right now.` | `Try Again`; retain existing good results |
| AI returned invalid IDs | Do not render model output | Server retries/fallback; error only if no valid results |

## Mobile design & accessibility

- Follow existing project design tokens, navigation patterns and typography, not a separate visual system.
- Show primary CTA without losing it beneath the iOS safe area; support small phones and dark/light mode.
- Garment photos accessible by VoiceOver as `Swap [name or category]`, including context `currently in this look`.
- Minimum accessible touch targets, visible selected chip states beyond color alone, readable contrast.
- Dynamic Type, Reduce Motion, keyboard-free interaction, voice-friendly controls.
- Skeleton and completion states announced to assistive technology.

## Design handoff outputs

1. Wireflow and polished component states for U0–U5 and E1–E4.
2. A clickable prototype using real/synthetic **owned-item fixture data**, never implying that stock items are in an actual customer's closet.
3. Frame review at small iPhone width; ensure image tile compositions remain legible.
4. A final microcopy review, including singular/plural result counts and partial coverage language.