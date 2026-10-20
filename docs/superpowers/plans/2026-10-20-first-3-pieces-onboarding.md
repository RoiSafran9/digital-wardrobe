# First 3 Pieces Onboarding — Implementation Plan

Status: **Approved 2026-10-20 (F1–F9 as recommended).** Done: M1, M2, M3, M11 server part. Next: M4.

> **Source note.** The brief points to `docs/features/first-3-pieces-onboarding/` (`01-product-prd.md`, `02-ux-flows-and-copy.md`, `03-technical-design-brief.md`, `04-claude-code-handoff.md`, `README.md`). **None of these files exist** — not on `main` (115a9b7), not on any remote branch, not anywhere on this Mac. This plan is built from the owner's confirmed decisions as relayed in the task brief (quoted in §0) and from the code as built. Where the missing docs would normally decide copy or detail, this plan says so and gives a recommendation. Milestone M0 reconciles the plan once the docs land.

**Goal:** a new user adds their first 3 pieces fast, through one guided flow, reusing the existing scans, generation jobs, credits and outfit flow.

**Approach in one line:** client-side *batch orchestration* ("a round") over the existing single-photo endpoints (`/v1/garment-scans`, `/v1/garment-scans/{id}/generate`, `/v1/jobs/{id}`, the outfit flow), plus three small server additions: optional worker concurrency, a tiny events endpoint for activation analytics, and nothing else. No new models, no pipeline or prompt changes, no billing or price changes.

---

## 0. Confirmed decisions (from the brief — not reopened here)

1. Flow: **Welcome ("Let's add your first 3 pieces") → "Are you near your wardrobe?"**
2. **Path A (near wardrobe):** collect any number of photos (camera and/or library; several garments per photo or one each); review/add/remove photos; start AI only after the user confirms. **No limit on photos collected; each generation round makes at most 5 garments in total across all photos.** If more than 5 are found the user picks up to 5 and may run more, explicitly confirmed, rounds later.
3. **Path B (not near wardrobe):** photograph the outfit they're wearing or pick an outfit photo, reusing the outfit flow; same 5-per-round cap.
4. Generation: clear, friendly processing; reuse existing pipelines/jobs/progress/credits.
5. **First success:** once ≥ 1 real garment is saved, a polished popup over the real closet — "Your first pieces are in!" / "Your digital closet has officially started." / **Explore My Closet** (primary), **Add More**, close — showing the user's own items. 1–2 saved still counts.
6. **No onboarding draft persistence** — but never cancel, double-charge or lose server jobs already submitted.
7. Out: payments, new models, outfit recommendations, gamification, push campaigns, new backend architecture unless justified.
8. Owner's initial preference: batch orchestration reusing existing single-photo scans and generation jobs (evaluated in §B.1 — **recommended**, with the caveats listed there).

---

## A. Existing system audit

### A.1 Sign-in, first-time handling, welcome credits
| Piece | Where | What it does today | Reuse |
|---|---|---|---|
| Routing guard | `mobile/src/RootNavigator.tsx` `RootNavigator` | `Stack.Protected` by `status` (`signedIn`/`local` → app; else Welcome/Intro/Sign-in). Registers every route; new routes must be added here. | Add the onboarding routes inside the `inApp` group. |
| Device onboarding | `mobile/src/onboarding.tsx` `OnboardingProvider` | `onboarding.seen` (AsyncStorage, per device) for Welcome/Intro; `justSignedIn` flag set by the code screen. | Keep. Add nothing to this file except the shared gate hook (or a sibling module). |
| Pre-sign-in Welcome / Intro | `app/welcome.tsx`, `app/intro.tsx` | Marketing collage + 3 intro pages, then Sign in. | Unchanged (copy tweak optional, §D). |
| Name step | `app/your-name.tsx`, `useNameStep` (`onboarding.tsx`), triggered in `app/(tabs)/_layout.tsx` | Once, when the account has no `display_name`. | The onboarding gate runs **after** this (`named === true`). |
| Starter credits | `app/welcome-credits.tsx`, `useStarterCredits`, `starterEligible`, `priceChips` | Once per account per device (`onboarding.starter.{userId}`), only when billing is on and `credits.granted > 0`. CTA **Digitize Your First Piece** → `/add?firstPiece=1`; **Explore first** → `/`. | Re-point the CTA to the new flow (§D, F4). |
| Welcome grant | `POST /v1/bootstrap` (`api/routes/v1.py` `bootstrap`), called by `CreditsProvider` on every sign-in | Grants `WARDROBE_WELCOME_CREDITS` once per invited account (fixed key `welcome:beta-v1`), idempotent across devices. | Unchanged. The flow reads the result through `useCredits().credits`. |
| Profile | `src/profile.tsx`, `GET/PATCH /v1/profile` | Name + email; `profiles.created_at` = sign-up time on the server. | `profiles.created_at` is the anchor for Time to First Item (§Analytics). |

### A.2 Home, Add, empty states
- `app/(tabs)/index.tsx` `HomeScreen`: loads `getItems()` on focus; `empty = loaded && items.length === 0` → `HomeEmpty` (three dashed frames, "Your closet starts here", `AddRows`, tips). `CaptureBanner` shows the single in-memory garment job. → The natural place for the "Add your first 3 pieces" re-entry card and for the in-flight-round banner.
- `app/(tabs)/add.tsx` `AddScreen`: two `MethodCard`s, `firstPiece` hint, paused banner (`generation === false`), "N pieces waiting for review" (from `getPendingItems()`, survives restarts). Unchanged by this feature except where a link is added.
- `app/(tabs)/closet.tsx`: the real closet grid. → Host of the first-success popup.

### A.3 Capture: camera, library, garment pre-scan, generation
- `src/photoPicker.ts` `pickPhoto(fromCamera)`: **single** photo, `UIImagePickerPreferredAssetRepresentationMode.Compatible` (HEIC → JPEG). `expo-image-picker ~57` supports `allowsMultipleSelection` + `selectionLimit` in Expo Go → a `pickPhotos()` sibling is a no-new-dependency change.
- `app/capture/camera.tsx` `CameraScreen`: `expo-camera`; one shot → `router.replace(nextRoute(mode, uri))`. Handles permission denied (explanation + Allow + "Choose … Photo"). GARMENTS/OUTFIT switch only when `outfit` is on. → Needs a **collect mode** that stays open and adds each shot to a tray.
- `app/capture/preview.tsx` `PreviewScreen`: runs **one** free pre-scan via `scanGarments(uri)` (`POST /v1/garment-scans`, polled), shows boxes + chips, quote at `prices.garment`, `InsufficientCreditsSheet` with "Leave out K pieces"; worn-photo rejection → outfit flow; local mode / scan failure → `MaxFrontsPreview` (max-fronts quote). Then `startFromScan(uri, scan.id, indexes, price)`.
- `src/store/captureJobs.tsx` `CaptureJobsProvider`: holds **one** `current` job in memory (`run` → `generateFromGarmentScan` or `postRun`, with `onProgress`), `retry`, `clear`, and `saved` for the Saved screen. Keyed by `userId` in `AppShell`. **Not persisted** — an app restart forgets the job (the server job continues and its items land in the closet anyway).
- `app/capture/processing.tsx` / `results.tsx` / `saved.tsx`: single-job processing (`ProcessingCard`, `GARMENT_STAGES`, server `progress` "2 of 3"), failure state with refund note, Results (items **already saved**; deselect = soft delete), Saved (fan of ≤ 3 `GarmentTile`s, "Added to your closet").
- `src/api/v1.ts`:
  - `startJob(account, path, photoUri?, fields)` — generates a **random** `Idempotency-Key` per call and retries once on `UNREACHABLE` with the same key. The key is not exposed or persisted.
  - `waitFor(...)` polls `GET /v1/jobs/{id}` every `POLL_MS = 2000` up to `POLL_LIMIT_MS = 5 min` (then `STILL_WORKING`); aborts on account change.
  - `scanGarments`, `generateFromGarmentScan(scanId, indexes, unitPrice, onProgress)` (start + wait in one call), `runFromJob` (re-lists **all** items to map `item_ids`).
- Server `api/routes/v1.py`:
  - `POST /v1/garment-scans` (free; `_limit_free_scans`: `WARDROBE_FREE_SCANS_PER_HOUR`, default 30, shared with outfit scans → 429), `GET /v1/garment-scans/{id}` (410 after 24 h, `GARMENT_SCAN_TTL`).
  - `POST /v1/garment-scans/{id}/generate` `{piece_indexes, expected_unit_price}` → one `garment` job, `max_items = len(picks)` (≤ `MAX_FRONTS` = 20), 409 on price change, idempotent by key (returns the existing job), reuses the stored detection (no second detection call), reuses the scan's uploaded photo (no re-upload).
  - `queue_job`: daily paid-job cap (`WARDROBE_DAILY_AI_JOBS` → 503), disabled account → 403, `gate.reserve` → 402, unique `(user_id, idempotency_key)` race-safe.
- Worker `api/worker.py`: `_garment_scan`, `_garment` (inserts items **directly into the closet**, `review_state` null; item ids are `uuid5(job_id, piece)` so a retried job never duplicates items), `run_once` (settle per delivered front; refund on failure; retry once, `max_attempts = 2`), `run_forever` — **a single serial loop: one job at a time, globally, oldest first** (`claim_generation_job` uses `for update skip locked`, so concurrent claimers are already safe). Pieces **inside** one job run in parallel (`asyncio.gather` in `pipeline/orchestrator.py`).
- Push: `api/push.py` `notify_job` sends one push per finished job when the user enabled "Notify when ready".

### A.4 Outfit flow (behind `WARDROBE_OUTFIT=on`)
- `app/outfit/detect.tsx` (free scan via `scanOutfit`, shows boxes, auto-forwards after `SHOW_BOXES_MS`) → `app/outfit/pick.tsx` (`pickable` drops shoes, `defaultPicks` drops low-visibility, corrections, mark-missed region, `CostSheet` confirm, `generateOutfit` **awaited inside the screen** with "Keep the app open") → `app/outfit/review.tsx` (pending items from the server, keep/discard per piece, regenerate, **Save** → `keepItem`/`deleteItem` → `/capture/saved`; "Later" → closet).
- Server: `MAX_PICKS = 8`, `MAX_SCAN_CANDIDATES = 8`, results are `review_state = 'pending'` (not in the closet) until kept; `GET /v1/items?review=pending` survives restarts.
- `src/outfit/outfit.ts` holds the pure picking rules — the right place for a cap helper.

### A.5 Credits and prices
- `src/credits/CreditsProvider.tsx`: `billing`, `prices` (server), `credits`, `outfit`, `generation` (pause flag) from `GET /v1/prices` + `GET /v1/credits`; `refresh()`.
- `api/credits.py`: `WalletGate` holds `price × max_items` per job at queue time, settles `price × min(delivered, max_items)`, refunds on failure, `reconcile` every 60 s. Nothing here changes.
- UI: `CostSheet`, `InsufficientCreditsSheet` (`onAdjust`), `creditsLabel`. All amounts from the server.

### A.6 What can be reused as-is vs. what is missing
| Need | Reuse | Missing |
|---|---|---|
| Multi-photo collection | `CameraView`, permission UI, `pickPhoto` HEIC handling | Collect mode; multi-select picker; tray screen |
| Detection across photos | `POST /v1/garment-scans` per photo (free, idempotent) | Client fan-out with bounded concurrency; cross-photo piece list |
| 5-per-round cap | `piece_indexes` per scan; `defaultPicks`, `_largest` idea | Pure `capRound` / selection rules |
| Start + track several jobs | `generate` endpoint (idempotent), `GET /v1/jobs/{id}` with `progress` | v1 split into *start(key)* and *poll(jobId)*; a round tracker for N jobs |
| Survive leaving/closing | Server jobs continue; garment items land in the closet; outfit results listed as pending | Tiny persisted record of **submitted** jobs (not a draft) so progress + popup resume |
| Credits | `prices.garment`, `expected_unit_price`, `CostSheet`, 402/409 handling | Round-level quote and partial-402 handling |
| Popup | `GarmentTile`, `PopIn`, `Sheet` | `FirstPiecesPopup` + once-per-account flag |
| Path B | Whole outfit flow | An `onboarding` param: cap 5 in pick, review → closet + popup |
| Analytics | `profiles.created_at`, `wardrobe_items.created_at`, `generation_jobs` | Client-only funnel steps (needs a minimal events table) |

---

## B. Recommended architecture

### B.1 Evaluation of batch orchestration over single-photo jobs (owner's preference)

| Concern | Finding in the code | Verdict / mitigation |
|---|---|---|
| Multi-photo client state | Today one `current` job in `CaptureJobsProvider`. | New, separate `FirstPiecesProvider` (in-memory session + a tiny persisted list of submitted jobs). Don't overload `captureJobs`. |
| Detection across photos | One free scan per photo, already idempotent and rate-limited. | Fan out scans after the user confirms photos, **max 2 uploads in flight**. Each photo gets its own state (`scanning / found / none / unusable / failed / rate-limited`). |
| Presenting garments across photos | Scan returns `pieces[{index, category, colors, box}]` + `image` size per photo. | One list grouped by photo (photo thumbnail + `PhotoWithBoxes` + chips), global counter "4 of 5 selected". |
| Enforcing 5 per round | No cross-job concept on the server. | Enforced **in the client** (pure `capRound`). Server bounds stay as they are (≤ 20 per garment job, ≤ 8 per outfit job, credits, daily cap, free-scan limit). A server "round" object for a UX rule is not justified (§F has it as a non-recommended option). |
| Starting several jobs reliably | `generate` is idempotent by key, but `v1.ts` generates the key internally and forgets it. | Add an explicit `key` parameter; derive keys as `fp:{roundId}:{scanId}` and **persist them before POSTing**. Submit jobs **sequentially** (deterministic holds, clean partial-402 handling). |
| Tracking several jobs | `GET /v1/jobs/{id}` with `progress {done,total}`. | Round tracker polls each job (reuse `waitFor` cadence 2 s). Map items from `item_ids` once per job; avoid `runFromJob` re-listing the whole closet N times — list once at round end. |
| Partial failure | Per-job settle/refund already correct; per-piece failures are in `failed`/`retakes`. | Round result = sum of jobs; show "N made · M couldn't be made (credits returned)". Retry only failed jobs, with **new** keys (old ones are terminal). |
| No duplicate jobs/charges | Server: unique `(user_id, idempotency_key)`; item ids `uuid5(job, piece)`. | Persisted keys make a relaunch re-POST return the **same** job. Never auto-retry a job that reached `failed`. |
| Leaving / closing the app | Server jobs continue; garment items appear in the closet; outfit results are pending. | Persist `{roundId, key, scanId, indexes, unitPrice, jobId?}` per job in AsyncStorage (`firstPieces.inflight.{userId}`), cleared when the round settles. On launch: resume polling, Home banner, popup when done. This is *submitted work*, not a draft — the photo tray and picks are still not persisted (decision 6). |
| Credit quoting | `prices.garment` from the server; `expected_unit_price` → 409 on change. | Quote = picks × `prices.garment`; one `CostSheet` for the round; every job sends the same `expected_unit_price`. 409 → refresh, re-confirm only the not-yet-submitted jobs. |
| Bounding API cost | Free scans: 30/h/account; paid: credits + daily cap. | Photos unlimited (decision), but scans only start on confirm; a 429 marks remaining photos "not checked yet — try again in a few minutes" (kept in the tray). Paid ≤ 5 fronts per round by construction. |
| Concurrency / speed | **Worker runs one job at a time, globally.** A round of 5 single-garment photos = 5 serial jobs (~10 s per generate call + verify/cutout; pieces inside one job are parallel). Scans also queue behind any running generation. | This is the main speed risk of per-photo jobs. Smallest fix: **`WARDROBE_WORKER_CONCURRENCY`** (default **1** = today's behaviour; recommend **2** for the F&F beta) running N `run_once` loops — `claim_generation_job` is already `skip locked`. See F1. A single multi-photo job would be faster still but needs pipeline-adjacent worker changes; not recommended now. |
| Push spam | `notify_job` pushes once per job → a 5-photo round could send 5 pushes. | Accept for the beta (notifications are off by default). Follow-up option: the app suppresses / server coalesces. Listed in §E. |

**Conclusion:** batch orchestration on the client is the right call. It needs **no new paid endpoint, no schema change for jobs, no change to billing**. The only server work is optional worker concurrency (F1) and the analytics events table (M11).

### B.2 API changes
| Change | Kind | Notes |
|---|---|---|
| None to `/v1/garment-scans*`, `/v1/outfit-scans*`, `/v1/jobs/{id}`, `/v1/prices`, `/v1/credits`, `/v1/bootstrap` | — | Reused unchanged. |
| `WARDROBE_WORKER_CONCURRENCY` (env, default 1) in `api/worker.py` `run_forever` / `api/main.py` | Server, small | N claim/run loops; reconcile and sweep stay in one loop. Documented in `docs/DEPLOY.md` and `api/controls.py` docstring. |
| `POST /v1/events` `{event, props}` → 204 | Server, new, tiny | Allow-listed event names and prop keys; server timestamp; per-user rate limit; no-op 204 in local mode (client doesn't call). Table `activation_events` (migration + RLS + pgTAP). See §Analytics. |

### B.3 Client modules
| Module | Purpose |
|---|---|
| `mobile/src/api/v1.ts` | Split: `startGarmentGenerate(account, scanId, indexes, unitPrice, key)` → `Job`; `pollJob(account, current, jobId, onProgress)`; `scanGarments(..., key?)`. Keep `generateFromGarmentScan` as a wrapper so existing callers/tests are untouched. Export `Job`. |
| `mobile/src/api/client.ts` | Thin wrappers + `postEvent(event, props)` (fire-and-forget, account mode only). |
| `mobile/src/photoPicker.ts` | `pickPhotos()` → `string[]` (`allowsMultipleSelection: true`, `selectionLimit: 0`, same HEIC mode, same permission error). |
| `mobile/src/firstPieces/round.ts` (pure) | `ROUND_CAP = 5` (UX constant, not a price); `allPieces(photos)`, `defaultSelection(pieces, cap)` (largest boxes first, like `_largest`), `toggle(selection, piece, cap)` → `{selection, blocked}`, `jobsFor(selection)` (group picks by scan), `roundQuote(n, prices.garment, available)`, `summarize(jobs)` (made / failed / refunded / running), `shouldOffer({...})`. |
| `mobile/src/firstPieces/FirstPiecesProvider.tsx` | Session (photos, per-photo scan state, selection, current round, leftovers for "Add More"); `inflight` persistence + resume on mount; keyed by `userId` in `AppShell` like `CaptureJobsProvider`. |
| `mobile/src/firstPieces/analytics.ts` | `track(event, props)` with the allow-list mirrored from the server; never throws. |
| `mobile/src/components/firstPieces/FirstPiecesPopup.tsx` | The success popup (fan of the user's own `GarmentTile`s, copy from decision 5). |

### B.4 Data model
- **No change** to `generation_jobs`, `wardrobe_items`, wallet or ledger.
- **New** `public.activation_events (id bigserial, user_id uuid references auth.users on delete cascade, event text check (event in (...)), props jsonb check (pg_column_size(props) < 1024), created_at timestamptz default now())`; RLS: no select/insert for `authenticated` (the API writes with the service role, like jobs); index `(user_id, created_at)`; unique partial index on `(user_id, event)` for once-only events (`popup_shown`, `first_garment_saved`, `first_3_saved`).
- **Device-local (AsyncStorage)**, per user: `firstPieces.offered.{userId}` (auto-offer happened), `firstPieces.celebrated.{userId}` (popup shown), `firstPieces.inflight.{userId}` (submitted jobs of the open round). All cleared on account delete/sign-out by key scope (userId).

### B.5 Navigation
New routes in `mobile/app/first-pieces/`, registered in `RootNavigator` inside the `inApp` group:
| Route | Screen |
|---|---|
| `first-pieces/index` | **Start** — "Let's add your first 3 pieces" + the question "Are you near your wardrobe?" (two choices). One screen, two beats (see F3). Close (×) → Home. |
| `first-pieces/photos` | **Path A tray** — grid of collected photos (remove ×), **Take Photos** (camera, collect mode), **Choose from Library** (multi), CTA **Find My Pieces** (disabled with 0 photos). |
| `capture/camera?collect=1` | Existing camera, collect mode: shutter adds to the tray and stays; thumbnail stack + count + **Done** returns to the tray; library button adds many. Mode switch hidden. |
| `first-pieces/pick` | **Detection + pick** — per-photo status rows while scanning, then pieces grouped by photo, "N of 5 selected", quote, CTA **Create N Pieces · N credits** → `CostSheet`. |
| `first-pieces/processing` | **Round progress** — one card per job (photo, "2 of 3"), overall "Creating your first pieces…", leave allowed. End: success → `/closet?celebrate=1`; partial → summary then closet; zero → failure state. |
| Path B | `capture/camera?mode=outfit&onboarding=1` or library → `outfit/detect?onboarding=1` → `outfit/pick?onboarding=1` (cap 5) → `outfit/review?onboarding=1` → Save → `/closet?celebrate=1`. |
| `(tabs)/closet?celebrate=1` | Shows `FirstPiecesPopup` once. |

Entry points: auto-offer after name/starter (gate, §D.1), the starter screen's CTA, a card in `HomeEmpty`, and the Home banner for a resumed round.

---

## C. Milestones (small, dependency-aware)

Each milestone: own commit(s), checks green (`pytest -q`, `npx jest`, `npx tsc --noEmit`, `npx supabase test db` where the DB changes). Flags: everything ships dark until M5 wires the entry points.

### M0 — Reconcile with the feature docs (when they exist)
- **Goal:** align copy/flows with `docs/features/first-3-pieces-onboarding/*` once committed; record deltas in this plan.
- **Depends on:** the owner committing the docs. **Blocks:** nothing technical; copy in M5–M10 may change.
- **Acceptance:** a short "Reconciliation" section appended here; any change to §0 approved by the owner.

### M1 — Worker concurrency (server, optional by env)
- **Files:** `api/worker.py` (`run_forever` spawns N claim loops; reconcile/sweep stay single), `api/main.py`, `api/controls.py` (`worker_concurrency()` 1–4, default 1), `docs/DEPLOY.md`, `tests/api/test_worker*.py`.
- **Tests:** two jobs overlap when N=2 (fake providers with an awaitable gate); N=1 keeps strict order; a crash in one loop doesn't stop the other; settle/refund still once per job; health beat still updates. Verify sync store calls don't block overlap (run blocking store calls via `asyncio.to_thread` only if the test shows serialization).
- **Depends on:** —. **Acceptance:** default behaviour unchanged; with `WARDROBE_WORKER_CONCURRENCY=2` two jobs run at once locally.

### M2 — Client API + picker groundwork
- **Files:** `mobile/src/api/v1.ts`, `mobile/src/api/client.ts`, `mobile/src/photoPicker.ts`, `__tests__/v1client.test.ts`, `__tests__/client.test.ts`, new `__tests__/photoPicker.test.ts`.
- **Changes:** explicit-key `startGarmentGenerate`, `pollJob`, optional key on `scanGarments`; `pickPhotos()`; existing exports keep signatures.
- **Tests:** same key on retry after `UNREACHABLE`; caller-provided key is sent; `pollJob` progress/fail/timeout/sign-out; `pickPhotos` returns all uris, `[]` on cancel, throws on denied.
- **Depends on:** —. **Acceptance:** all existing capture/outfit tests unchanged and green.

### M3 — Round rules (pure)
- **Files:** `mobile/src/firstPieces/round.ts`, `__tests__/firstPieces.round.test.ts`.
- **Tests:** ≤ 5 → all selected; > 5 → 5 largest; toggle blocks the 6th; `jobsFor` groups by scan in photo order and keeps piece order; quote uses the server unit price, `null` when billing is off; `summarize` across mixed outcomes (succeeded with retakes, failed, 402); `shouldOffer` truth table (local mode, unnamed, items > 0, pending > 0, inflight, already offered, outfit on/off).
- **Depends on:** —.

### M4 — FirstPiecesProvider + resumable submitted jobs
- **Files:** `mobile/src/firstPieces/FirstPiecesProvider.tsx`, `mobile/src/RootNavigator.tsx` (`AppShell`: provider keyed by `userId`), `__tests__/firstPieces.provider.test.tsx`.
- **Behaviour:** `addPhotos`, `removePhoto`, `scanAll()` (≤ 2 concurrent; per-photo state; 429 → `limited`), `select/toggle`, `submitRound()` (persist record → POST sequentially → store `jobId` → poll), `resume()` on mount (poll stored `jobId`s; re-POST same key for entries without `jobId`), `retryFailed()`, `reset()`, `leftovers` (unpicked pieces whose scans are < 24 h old) for Add More.
- **Tests (fake timers, mocked client):** relaunch with `jobId` resumes polling; relaunch without `jobId` re-POSTs **the same key** (one server job); 402 on job 2 of 3 → jobs 1 kept, 2–3 not submitted, state "needs credits"; 409 → stop, ask to re-confirm remaining; sign-out mid-round stops polling and drops nothing on the server; record cleared once all jobs are terminal.
- **Depends on:** M2, M3.

### M5 — Entry, gate and the Start screen
- **Files:** `mobile/app/first-pieces/index.tsx`, `mobile/app/(tabs)/_layout.tsx` (gate after name/starter), `mobile/app/welcome-credits.tsx` (CTA), `mobile/src/components/home/HomeEmpty.tsx` + `app/(tabs)/index.tsx` (re-entry card, resumed-round banner), `mobile/src/RootNavigator.tsx`, `mobile/src/onboarding.tsx` (gate hook `useFirstPiecesOffer`), tests (`Onboarding.test.tsx`, `WelcomeCredits.test.tsx`, `HomeScreen.test.tsx`, new `FirstPiecesStart.test.tsx`).
- **Gate (auto-offer once per account per device):** account mode, signed in, named, starter decision done, `generation !== false`, closet empty **and** no pending outfit results **and** no in-flight round, not yet offered. Existing users with items never see it (server truth, works on a second device).
- **Tests:** truth table above; starter CTA routes to Start; Explore first → Home (no auto-offer afterwards that session); Home empty shows the re-entry card; outfit off → Start skips the question and goes to Path A.
- **Depends on:** M4.

### M6 — Path A: collect photos
- **Files:** `mobile/app/first-pieces/photos.tsx`, `mobile/app/capture/camera.tsx` (collect mode; no behaviour change without `collect`), tests (`CaptureFlow.test.tsx` collect cases, new `FirstPiecesPhotos.test.tsx`).
- **Tests:** shutter in collect mode adds and stays; Done returns; library adds many; remove works; 0 photos disables CTA; camera denied → library path still collects; existing single-shot camera tests unchanged.
- **Depends on:** M5 (route + provider), M2 (`pickPhotos`).

### M7 — Path A: detection, cross-photo pick, confirm
- **Files:** `mobile/app/first-pieces/pick.tsx`, reuse `PhotoWithBoxes`, `ScanBand`, `CostSheet`, `InsufficientCreditsSheet`; tests `FirstPiecesPick.test.tsx`.
- **States:** scanning per photo; unusable photo (quality `retake` → reason, Remove); worn photo (offer Path B after this round); nothing found anywhere; < 3 found (allowed; hint to add another photo); > 5 found (cap); rate-limited photos; scan expired (410 → rescan once, free).
- **Tests:** cap and counter; quote = picks × server price; short of credits → "Leave out K pieces"; billing off → no amounts; paused generation → CTA disabled with the paused note; Add Photo from here goes back to the tray keeping scans.
- **Depends on:** M6.

### M8 — Path A: round processing, partial success, finish
- **Files:** `mobile/app/first-pieces/processing.tsx` (reuse `ProcessingCard`, `GARMENT_STAGES`, `LEAVE_NOTE*`), `src/components/home/CaptureBanner.tsx` (also show the round), tests `FirstPiecesProcessing.test.tsx`, `HomeScreen.test.tsx`.
- **End states:** all OK → closet + popup; partial → summary ("3 pieces created · 1 couldn't be made — credits returned", per-piece retake tips) → Continue → closet + popup; zero made → failure (reasons, "Try Again" for failed jobs with new keys, "Choose Other Photos"); 402 mid-round → `InsufficientCreditsSheet` for the remainder; still running after 5 min → "Still working — your pieces will appear in your closet" (leave).
- **Depends on:** M7, M9 (popup) — M9 can be built in parallel and stubbed.

### M9 — First-success popup
- **Files:** `mobile/src/components/firstPieces/FirstPiecesPopup.tsx`, `mobile/app/(tabs)/closet.tsx` (`celebrate` param + resumed-round completion), tests `FirstPiecesPopup.test.tsx`, `ClosetScreen.test.tsx`.
- **Behaviour:** shows once per account per device (`firstPieces.celebrated.{userId}`), only after an onboarding round (Path A or B, including one finished while the app was closed) with ≥ 1 saved item; fan of up to 3 of **the round's** items (closet tile rules: cutout → generated → crop, no tints); Explore My Closet (dismiss), Add More (→ tray with leftovers, or Start), × (dismiss). Reduce Motion: fade only. VoiceOver: modal, focus on title.
- **Depends on:** M3 (summary type). Parallel with M6–M8.

### M10 — Path B: outfit flow in onboarding mode
- **Files:** `mobile/app/outfit/detect.tsx`, `pick.tsx`, `review.tsx` (carry `onboarding=1`; pick caps at 5 via a helper in `src/outfit/outfit.ts`; review Save → `/closet?celebrate=1` instead of `/capture/saved`), `mobile/app/first-pieces/index.tsx` (Path B buttons: Take Outfit Photo / Choose Outfit Photo), tests `OutfitScreens.test.tsx` (+ cap, + routing), `outfit.test.ts`.
- **Notes:** no change outside onboarding mode; outfit flow's review stays (fidelity: generated pieces are reviewed before they join the closet). Outfit off or local mode → Path B not offered (Start goes to Path A).
- **Depends on:** M5, M9.

### M11 — Activation analytics (minimal)
- **Server files:** `supabase/migrations/2026102012xxxx_activation_events.sql`, `supabase/tests/database/activation_events.test.sql`, `api/routes/v1.py` (`POST /v1/events`), `api/schemas.py`, `api/store.py` (`insert_event` in both stores), `tests/api/test_v1_events.py`, `scripts/activation_report.py` + test.
- **Client files:** `mobile/src/firstPieces/analytics.ts`, calls at the steps in §Analytics; tests.
- **Tests:** unknown event/prop → 400; oversized props → 400; once-only events dedupe; rate limit; RLS denies direct client access; report computes the metrics on a seeded store.
- **Depends on:** server part —; client part M5+.

### M12 — Docs and phone QA
- **Files:** `docs/SCREENS.md` (new §0b), `docs/PRD.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md` (round orchestration, worker concurrency, events), `docs/DEPLOY.md`, `README.md` if env changes; this plan's status.
- **Phone QA script** (Expo Go, account mode, billing on, outfit on and off): new account → name → starter → Start → A with 1 photo/3 pieces; A with 4 photos/7 pieces (cap); camera denied; kill app during processing → relaunch resumes → popup; B with an outfit photo; existing account on a second device sees no onboarding; light/dark; VoiceOver; Reduce Motion.
- **Depends on:** all.

---

## D. UX integration plan

### D.1 Where onboarding starts
1. Sign up → code → **name** (existing) → **starter credits** (existing, when eligible) → **Start**.
   - Starter screen CTA becomes **Add Your First 3 Pieces** → `first-pieces/index`; **Explore first** → Home (no auto-offer that session; Home's empty card stays).
   - When the starter screen isn't eligible (billing off / no grant), the gate opens Start right after the name step.
2. Home empty state: a primary card "Add your first 3 pieces" above the existing `AddRows` (which stay for power users).
3. Existing user signing in again / on a new device: gate needs an empty closet and no pending results → users with items never see it. A user with an empty closet on a new device is offered it once there (still not activated — intended).
4. Local mode: no onboarding (pre-scan needs the account API); Home unchanged.

### D.2 Screens and copy (final copy to be checked against `02-ux-flows-and-copy.md` in M0)
- **Start:** title "Let's add your first 3 pieces" (Instrument Serif is reserved for four headlines — use `type.screenTitle`, see DESIGN.md), body "It takes about a minute. Finding your clothes is free." Question "Are you near your wardrobe?" → **Yes, I'm near it** ("Photograph a few pieces — several in one photo is fine.") / **Not right now** ("Use what you're wearing, or an outfit photo you have."). × close.
- **Tray (A):** "Your photos" · "Add as many as you like. Each round makes up to 5 pieces." Tips (lay flat / hanger, daylight). CTA **Find My Pieces** · "Free".
- **Pick (A):** "We found 7 pieces" · "Pick up to 5 for this round. You can add the rest next." Counter chip "5 of 5". Blocked 6th tap → toast "Up to 5 per round — deselect one first." Quote card (server price) and CostSheet as today.
- **Processing:** "Creating your first pieces…" + per-photo cards; leave note as today.
- **Popup:** decision 5 copy verbatim.
- Every photo entry point names the photo kind (DESIGN.md rule): "Take Garment Photos", "Choose Garment Photos", "Take Outfit Photo", "Choose Outfit Photo".

### D.3 Learning by doing
No tutorial pages: tips live where the action is (tray hint, camera hint pill, pick hint, unusable-photo reasons). The Intro carousel stays as is.

### D.4 Saved screen and Add tab
- Regular Add flows keep `capture/saved` and Results — unchanged.
- Onboarding rounds skip Results and Saved (F2) and land on the closet + popup.
- Add tab: unchanged; optionally shows "Continue your first pieces" while a round is in flight.

---

## E. Edge cases and reliability

| Case | Handling |
|---|---|
| Camera denied | Existing denied UI in collect mode + **Choose Garment Photos** (multi). Tray still works with library only. |
| Library denied | `pickPhotos` error message (as `pickPhoto`), Settings hint; camera path still available. |
| No photos | CTA disabled; empty tray illustration with both add buttons. |
| No garments detected (all photos) | "We couldn't find clothes in these photos" + reasons per photo + tips; Add Photos; "Not near your wardrobe? Use an outfit photo" (if outfit on). |
| Worn photo in Path A | Scan reason matches `isWornRejection` → photo row says so; after the round (or now if nothing else) offer **Try it as an outfit photo** with that photo. |
| > 5 detected | Cap with 5 largest preselected; leftovers kept in memory for Add More (no persistence). |
| < 3 detected | Allowed; hint "Add another photo to reach 3"; popup still shows for 1–2. |
| Low-quality photo | `quality.status === "retake"` → reason + Remove/Retake per photo; others continue. |
| Same garment in two photos | Not detectable cheaply; tip "Each piece once" in the tray; user deselects duplicates in pick (grouped by photo makes it visible). |
| Free-scan limit (429) | Remaining photos marked "Not checked yet — try again in a few minutes"; user can still create from the photos that were checked. |
| Scan expired (410, > 24 h) | Free rescan of that photo (local uri still in memory); if the uri is gone, drop the photo with a note. |
| Outfit feature unavailable | Path B not offered; Start goes straight to Path A copy. |
| Generation paused (`generation === false` / 503) | Start shows the existing paused note; collection allowed, Create disabled; gate doesn't auto-offer. |
| Daily AI cap (503 `BUDGET_USED`) mid-round | Jobs already queued run; the rest aren't submitted; message from the server; retry later. |
| Insufficient credits | Before: quote vs `credits.available` → `InsufficientCreditsSheet` with "Leave out K pieces". During (402 on job k): jobs < k proceed; k… not submitted; sheet explains; no hold leaked (server releases on 402). |
| Price changed (409) | Refresh prices; re-confirm only unsubmitted jobs; submitted jobs keep the price they were held at. |
| Generation failure (job failed) | Server refunded the hold; round summary shows it; **Try Again** = new job with a new key (only for failed jobs). |
| Partial success (some pieces in a job failed / retake) | Charged only for delivered fronts (existing settle); summary lists retake tips. |
| Network drop on POST | Same key re-sent (existing `UNREACHABLE` retry) → no duplicate. |
| Leaving onboarding mid-collection | Tray/picks discarded (decision 6); confirm "Leave? Your photos won't be kept." only if ≥ 1 photo. |
| Leaving during processing | Allowed; Home banner "Creating your first pieces…"; popup on completion next time Home/Closet is focused. |
| App killed / closed during processing | `inflight` record → resume polling on launch; entries without `jobId` re-POST with the same key (server returns the job if it exists, creates it once if not — the user already confirmed that cost). |
| App killed between "confirm" and the first POST | Same as above: the record is written before POSTing. |
| Sign-out / account switch mid-round | Provider keyed by `userId`; polling stops (`SIGNED_OUT`); the other user's record is never read. Server jobs continue for the original account. |
| Account deleted | Server cascade; local keys are per user and harmless. |
| Worker restart mid-job | Existing lease + `max_attempts = 2` + `uuid5` item ids → no duplicates; reconcile settles/refunds. |
| Hung model call | Existing lease (600 s) recycles; the client shows `STILL_WORKING` after 5 min and lets the user leave. |
| Several pushes per round | Accepted for beta (opt-in feature). Follow-up: suppress per-job pushes during an onboarding round or coalesce server-side. |
| Populated closet | Gate never offers; Home shows the normal layout. |
| Outfit results pending review from an earlier session | Gate doesn't auto-offer; Add tab's "N pieces waiting for review" leads to review → keep → (if it was an onboarding Path B round, the popup). |

**Credit consistency invariant:** the client never decides a charge. Every paid start carries `expected_unit_price`; the server holds `price × picks`, charges `price × delivered`, refunds failures, and reconciles orphans. Client-side retries reuse keys; client-side "Try Again" after a terminal failure uses a new key (a new, explicitly confirmed action).

---

## Analytics (minimal, privacy-conscious, no platform)

**Principles:** account mode only; user id only (already the row owner); no photos, no free text, no garment details, no device ids, no IP stored; server timestamps; allow-listed names and props; deleted with the account (FK cascade); retention 180 days (sweep in `scripts/sweep_storage.py` or a SQL job — F6).

| Event | Props (allow-listed) | When |
|---|---|---|
| `onboarding_started` | `entry: auto \| starter \| home` | Start shown |
| `path_selected` | `path: near \| not_near` | Answer tapped |
| `photos_collected` | `count`, `camera`, `library` | Find My Pieces tapped |
| `detection_completed` | `photos`, `found`, `unusable`, `limited` | All scans settled |
| `generation_started` | `pieces`, `photos`, `round` (1, 2, …), `path` | Round confirmed |
| `first_garment_saved` (once) | `path` | First onboarding round settles with ≥ 1 saved |
| `first_3_saved` (once) | `path` | Closet reaches 3 via onboarding |
| `popup_shown` (once) | `saved` | Popup shown |
| `popup_add_more` | — | Add More tapped |
| `onboarding_abandoned` | `step` | Explicit close/leave before generation |

**Measuring (via `scripts/activation_report.py`, read-only, service role, prints a table):**
- **Time to First Item:** `min(wardrobe_items.created_at)` (closet items, i.e. `review_state` null or kept) − `profiles.created_at`; also from `onboarding_started`. Report median and p75.
- **Time to First 3 Items:** 3rd closet item's `created_at` − same anchors.
- **First-session activation rate:** users with a closet item within 60 min of `profiles.created_at` ÷ users who signed up in the window.
- **Second import rate:** activated users with a second `generation_started` (or a paid `generation_jobs` row > 30 min after their first round) ÷ activated users.
- **Drop-off by step:** distinct users per event in funnel order; `abandoned` split by `step`.
Items and jobs tables are the source of truth for times; events only cover steps the server can't see.

---

## F. Open decisions (each with a recommendation)

| # | Decision | Recommendation |
|---|---|---|
| F1 | Worker concurrency for faster multi-photo rounds | **Add `WARDROBE_WORKER_CONCURRENCY`, default 1; set 2 on the beta server.** Without it a 5-photo round runs 5 jobs back to back. Gemini cost is unchanged (same calls, run sooner). |
| F2 | Path A after generation: skip the Results (deselect) screen and go straight to closet + popup? | **Skip.** Items are already saved and charged; removing one stays possible in Garment Details. Retake tips and failures are shown on the processing summary. Path B keeps its review step (fidelity of generated-from-worn pieces). |
| F3 | Start: one screen with the headline and the question, or two screens? | **One screen, two beats** (headline, then the two answers) — one less tap; matches "Welcome → question" in order. Revisit with `02-ux-flows-and-copy.md`. |
| F4 | Starter credits screen | **Keep it, re-point its CTA** to "Add Your First 3 Pieces". Smallest change; credits stay explained before the first cost sheet. |
| F5 | Default selection when > 5 are found | **Preselect the 5 largest** (matches the server's `_largest`); user swaps freely. |
| F6 | Analytics storage | **Postgres table + `POST /v1/events` + report script**, 180-day retention. Alternative (structured server logs) is cheaper but hard to query and mixes with operational logs. |
| F7 | Popup scope | **Only for onboarding rounds** (Path A or B, incl. ones finishing while away); regular Add flows keep the Saved screen. |
| F8 | Missing feature docs | **Proceed from the confirmed brief**; reconcile in M0 when the docs are committed. |
| F9 | Server-enforced round cap (a "round" entity) | **Not now.** Client cap + existing server bounds (credits, per-job caps, daily cap) are enough for the F&F beta; revisit if the app goes public. |

---

## G. Execution order

1. **Parallel start:** M1 (server) · M2 (client API) · M3 (pure rules) · M11-server (migration, endpoint, report).
2. M4 (provider) — needs M2, M3.
3. M5 (entry + gate) — needs M4. M9 (popup) can start now in parallel.
4. M6 (collect) → M7 (pick + confirm) → M8 (processing) — sequential, same files/provider.
5. M10 (Path B) — needs M5, M9; independent of M6–M8 files except shared routing.
6. M11-client — after M5; events added as each screen lands.
7. M12 (docs + phone QA) — last. M0 whenever the feature docs are committed.

Parallel-safe groups (no shared files): {M1}, {M2}, {M3}, {M11-server}, {M9}. Everything under `mobile/app/first-pieces/` and the provider goes one writer at a time.

**Risks to watch:** worker overlap with sync store calls (M1 test decides); upload time for several full-size photos on cellular (2 in flight, quality 0.8 as today); per-job push notifications; free-scan limit on very large trays; the missing feature docs changing copy late.
