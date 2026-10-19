# Redesign Follow-ups Plan

> **For agentic workers:** executed inline (superpowers:executing-plans). Steps are TDD; each milestone is its own focused commit(s) on `main`'s line.

**Goal:** Build the items the redesign deferred, plus a name step at sign-up the owner asked for on 2026-10-19.

**Spec:** [`docs/superpowers/specs/2026-10-19-ios-redesign-design.md`](../specs/2026-10-19-ios-redesign-design.md) §6 (D6, D8, D10, D13, D14, D17). The owner said "work on all of these now" (2026-10-19), which approves building them. The calls below are mine and are listed for review.

## Global constraints
Same as the redesign plan: Expo Go only; prices only from the server; confirm every paid action with its cost; billing off shows no amounts; local mode keeps working; the user ID only from the verified token; migrations with pgTAP; prompts are versioned files, never edited in place; no extra paid model calls beyond what a feature needs.

## M10 — Name at sign-up (owner request; supersedes D8)
- `profiles.display_name text` (1–40 chars, trimmed), written only by the backend. `GET /v1/profile` → `{email, display_name}`; `PATCH /v1/profile {display_name}`.
- App: after sign-in, when the account has no name, a "What should we call you?" screen (required, before Home and before the starter-credits screen). Greeting becomes "Good morning,\n{Name}"; Account's profile card shows the name with initials from it and lets the user change it.
- Local mode: no name step; greeting without a name.

## M11 — Help and Privacy (D17)
- In-app **Help** (how capture, outfits, back, 360 and credits work — from the docs, nothing invented) and **Privacy** (what is stored, where, who can see it, how deletion works — from ARCHITECTURE/AGENTS) screens, reachable from Account. A contact row shows only when `EXPO_PUBLIC_SUPPORT_EMAIL` is set (none is committed). Both screens say they are a summary, not a legal policy.

## M12 — Notify when ready (D10)
- `expo-notifications` (in Expo Go on iOS). Account → "Notify when ready" switch (default off): asks permission, registers the Expo push token with `POST /v1/push-token` (table `push_tokens`, one row per user+token, backend-only writes). The worker, when a garment, back, 360 or outfit job finishes, sends one push through Expo's push API to the owner's tokens ("Your pieces are ready", "Back image ready", …). Turning it off deletes the token. Failures to send never fail the job.

## M13 — Outfit corrections, missed garments, regenerate (D13, D14)
- **Correct before generating:** each candidate's Edit sheet sets a name and type; corrections go with `POST …/generate` as `corrections {id: {category}}` and replace the candidate's category in the facts the generation prompt sees (no prompt change). "Not a garment" stays client-side.
- **Mark a missed garment:** the user drags a box on the photo; `POST /v1/outfit-scans/{id}/regions {box}` crops that region and runs the existing outfit detection on the crop (one cheap vision call, free to the user, rate-limited by the scan's 8-candidate cap) and appends the found candidate.
- **Regenerate (review):** `POST /v1/items/{id}/regenerate` for a pending outfit item makes a new image from its crop at the front price (charged like any front, confirmed with the cost sheet), replacing the pending image. Kept items can't be regenerated here.

## M14 — Free garment pre-scan (D6 b)
- `POST /v1/garment-scans` (free; job kind `garment_scan`): quality check + the existing detection call, stores the detection and preview boxes. `POST /v1/garment-scans/{id}/generate {piece_indexes, expected_unit_price}` makes fronts only for the chosen pieces from the stored detection (no second detection call), holding price × picks and charging per front made — the same accounting as `max_fronts`.
- App Preview: shows the photo with numbered boxes and "N garments found", toggles, and "Generate N Items · N credits". Falls back to the approved max-fronts quote if the scan fails or in local mode.
