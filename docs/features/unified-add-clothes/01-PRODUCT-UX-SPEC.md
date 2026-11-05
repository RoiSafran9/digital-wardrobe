# Product & UX Specification — One Add Clothes Journey

**Status:** Design direction ready for implementation  
**Objective:** A first-time KIPS user should understand **where to add**, **what kind of photo they have**, and **how to take or choose it**, without repeatedly choosing the same thing.

## 1. Current-state problems (verified in `main`)

- Home has two tiles (`FLAT LAY` / `WORN`); Flat Lay offers `Camera` / `Library`, Worn only `Choose Photo` (`mobile/src/components/home/AddToCloset.tsx`). Home empty state has a different presentation (`AddRows`).
- Camera also offers `GARMENTS` / `OUTFIT` mode tabs (`mobile/app/capture/camera.tsx`), duplicating or contradicting the prior choice.
- Add tab again has two large method cards; tapping them opens a camera, even when the user wanted the library (`mobile/app/(tabs)/add.tsx`).
- First 3 Pieces uses the question `Are you near your wardrobe?` and a third vocabulary (`mobile/app/first-pieces/index.tsx`).
- Wrong-type recovery is partial: garment preview offers an outfit retry only for some worn rejection strings; worn scan gives a scene note but lacks a consistent same-photo way back.
- Copy already mentions hanging clothes, while `pipeline/prompts/stage1_detect_facts_v5.txt` requires the subject to be laid on a capture surface.

## 2. Core design rule

**Only ONE choice about photo type; only ONE choice about photo source.**

The user should not need to understand terms like Flat Lay, Garment Scan, Worn, AI Pipeline, or the internal difference between `garment` and `outfit`.

### Canonical steps (existing wardrobe)

`Home → Add Clothes → Add tab / add hub → [What does your photo show?] → [Take Photo | Choose from Library] → photo → correct scan/preview → select items → confirm price if enabled → generate → review/save → Closet`

Photo type options (exact proposed English UI copy):

| Type | Title | Description |
|---|---|---|
| Laid out | **Clothes by themselves** | **Laid out, hanging, or shoes together.** |
| Worn | **Someone wearing them** | **A person wearing the clothes or shoes.** |

These should be selectable full-width or clear illustrated cards. The entire card is tappable, accessible, and indicates selection. Avoid two competing side-by-side cards with small, asymmetric source buttons.

Upon tapping type, present the **same** source selector for both:
- **Take Photo** (camera icon)
- **Choose from Library** (photos icon)

Can be a standard accessible action sheet, or a small inline area; use existing design system. Once selected, photo type must persist through the next screen and recovery controls.

### Why keep the type choice?

Two backend pipelines exist and have different semantics. Flat/garment scan intentionally excludes items worn on a person; worn/outfit scan isolates the main person's clothes and has distinct pick/review rules. Auto-routing would require reliable scene classification, mixed-scene behavior and unneeded model/error complexity. For first-five beta, a single explicit **photo evidence** choice is safer.

**Do not ask garment vs outfit again inside the camera.**

## 3. Surface requirements

### 3.1 Home with items

Replace the `FLAT LAY` / `WORN` dual tile content with **one clear Add Clothes CTA**. The action navigates to the existing Add tab/hub rather than opening a specific flow directly. Keep search, category rows, Build My Look and existing in-progress job banners intact.

There should be **no separate Camera/Library or photo type choice** on Home itself.

### 3.2 Home empty

Preserve the **First 3 Pieces** guided call to action as the primary empty-closet CTA, but remove redundant `AddRows` with garment/outfit Camera/Library options from Home empty content. Adjust explanatory copy to describe the same photo types.

The bottom **Add tab** is still available; it should use the same common type/source chooser. Do not show two competing ways to enter fundamentally different add experiences on the Home screen.

If there is a local-mode distinction, keep it functional: a signed-out/local user gets a working Add Clothes CTA even if the guided First 3 Pieces is account-only.

### 3.3 Add tab

Title **Add Clothes** (not only Add Clothes for garments), small subtitle `Choose what your photo shows.`. Present two **type cards**, each with a short description and simple representative illustration. When one is selected show a unified source selector below or as an action sheet, identical for both types. Preserve any `pending outfit pieces to review` banner, server paused state, credit price/balance, and first-piece educational hints.

Don't show identical camera selection repeatedly on this screen and in the camera. Selecting library should open the native picker **directly**, without taking the user to a camera UI first.

If worn import is disabled by the live server, show the only available type and do not leave a disabled/unreachable worn button.

### 3.4 Camera

Accept `mode=garments|outfit` from the type selection for routing. Retain permissions, capture, flash/media behavior, camera overlay, accessibility, and library fallback if camera permission is refused.

**Remove the visible GARMENTS / OUTFIT mode switch.** Show a stable short heading/hint tied to the selected type:
- Garments: `Clothes by themselves`; `Lay clothes out or hang them. Shoes: low side angle.`
- Outfit: `Someone wearing them`; `Keep the clothing visible; full outfit in frame.`

A photo from either type, whether taken now or chosen from library, follows the **same** resulting route for that type. If camera permission is denied, the alternative **Choose from Library** retains the selected type. Do not prompt for camera access to use the library-only path.

### 3.5 Free scan, preview, recovery

At all points **before paid generation**, a wrong photo-type choice should be recoverable without requiring the user to take/select the source photo again:

- Garment preview (`/capture/preview`): action **Change Photo Type** with existing local URI, leading to worn/outfit detection. The existing targeted `Try it as an outfit photo` rejection can become the prominent contextual shortcut. Preserve free-scan behavior, selection, pricing, and fallback.
- Worn scan (`/outfit/detect`) and/or pick (`/outfit/pick`): action **Try as clothes by themselves**, when the photo looks laid out, with the **same URI** routed to garment preview. Also support a small **Change Photo Type** option for manual correction if the scene model is uncertain.
- Source URI must not be logged, persisted in analytics or put in a long-lived remote link. Use the existing in-session file URI routing, carefully handling route replacement and cleanup. When the URI is unavailable, show **Choose Another Photo**, not a broken route.
- Switching type discards that scan's **temporary client-side picks/state**, not saved wardrobe data. Explain that the *new free scan* will run; don't silently attempt paid generation, keep old quote, or charge a credit.
- Never offer a paid job based on candidates from the other type or on stale scan IDs; re-scan in the selected pipeline.
- In cases where generation has already started or credits were held, **do not add a post-submit type switch** in this MVP. Preserve existing job/recovery semantics and avoid double-billing.

### 3.6 First 3 Pieces

Keep the existing guided onboarding, `FirstPiecesProvider`, multi-photo tray (`/first-pieces/photos`), five-piece round cap, job persistence/recovery, and analytics.

Replace/align the `Are you near your wardrobe?` choice with the **same two photo-type descriptions** as the normal Add tab:
- Clothes by themselves → existing photos tray, which can receive **multiple photos via camera and library**.
- Someone wearing them (only if enabled) → choose **Take Photo** or **Choose from Library**, preserving `onboarding=1` through detect/pick/review.

**Do not** send a worn photo into the flat-lay multi-photo tray. Preserve existing internal `path=near|not_near` event values for downstream report compatibility, even if the labels change. Keep entry and abandon events/celebration/credits intact.

An empty closet user entering from either Home guided CTA or the Add tab should see the **same vocabulary**, even if the guided tray has a richer multi-photo UI.

### 3.7 What about hanging garments?

Hanging clothing belongs to **Clothes by themselves** (not `Someone wearing them`). It must be hanging on a hanger/hook without a person wearing it.

Current scanner prompt expects laid-on-surface garments, despite some copy promising hangers. Extend in place via **new versioned prompts**, with narrow detection/generation instructions and at least several real-photo checks. If reliable hanging results cannot be verified, the user-facing copy must not imply full support; update the exact promise according to demonstrated behavior.

### 3.8 Ambiguous / mixed photos

No third choice. A person wearing some garments while another garment is laid on a chair is a mixed scene; explain that users may need two separate photos/types. Do not automatically move or generate garments between flows. If both types would be plausible, preserve a one-tap manual change before spending credits.

## 4. Microcopy / accessibility

| Location | Proposed copy |
|---|---|
| Home CTA | **Add Clothes** |
| Add heading | **Add Clothes** |
| Add subtitle | **Choose what your photo shows.** |
| Type A | **Clothes by themselves** |
| Type A description | **Laid out, hanging, or shoes together.** |
| Type B | **Someone wearing them** |
| Type B description | **A person wearing the clothes or shoes.** |
| Source 1 | **Take Photo** |
| Source 2 | **Choose from Library** |
| Review switch | **Change Photo Type** |
| Flat→worn mismatch | **This looks like someone wearing the clothes. Try as a worn photo.** |
| Worn→flat mismatch | **These clothes look laid out. Try as clothes by themselves.** |
| Changing type | **We'll scan this photo again for free.** |
| Unavailable type | **This photo option is unavailable right now.** |

Expose descriptive accessibility labels, roles, adequate touch targets, VoiceOver reading order and disabled state. Show error and cancel feedback without trapping user. Use the existing KIPS typography, colors, spacing and iconography; avoid adding another style system.

## 5. Non-goals

- Automatic AI routing / new classification call.
- Retrofitting all existing wardrobe images.
- Auto merging across multiple photos or automatic items from mixed-scene photos.
- New server endpoints or new app tab.
- New credit prices, model vendor, app-permission changes, analytics SDK, or cloud migration.
- UI redesign outside Add, Home, First 3 Pieces and photo/preview entry paths.

## 6. How we will know it works for the launch

Measure the fraction of signed-in users reaching first saved item, time to first item, source-selection/permission failures, explicit type corrections before generation, and first-three completion. Type corrections signal misclassification/UX friction, **not** an AI quality failure by themselves. With five testers, watch observed behavior and interviews, not statistical percentages. Do not mark manual/device tests PASS until someone actually runs them.
