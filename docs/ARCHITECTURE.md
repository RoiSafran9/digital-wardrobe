# Technical Architecture — Digital Wardrobe
Status: **As built** · Updated: 2026-10-18

Decisions and the multi-user research: [multi-user architecture design](superpowers/specs/2026-10-18-multiuser-architecture-design.md). Credits hooks: [credits integration notes](superpowers/specs/2026-10-18-credits-readiness.md). Other feature designs: `docs/superpowers/specs/`. Ideas from the first planning docs that aren't built are under "Later" in [ROADMAP.md](ROADMAP.md).

## Shape
```text
iPhone (Expo Go app)
  ├─ Supabase Auth (6-digit email code) — session encrypted on the device         [account mode]
  ├─ Supabase Storage signed URLs (≤ 1 h) for the user's own images              [account mode]
  └─ FastAPI on the owner's Mac, over home Wi-Fi (port 8000)
        ├─ account mode (WARDROBE_AUTH=on): verifies the token → user_id, serves /v1 only,
        │    queues generation_jobs in Postgres; an in-process worker claims them,
        │    runs the pipeline and writes results to private Storage + rows
        └─ local mode (default): the original file API over runs/, no accounts
                    └─ pipeline/ → Gemini API (backend only)
```
- **App** (`mobile/`, Expo Go): with Supabase settings it requires sign-in and calls `/v1` with the access token, starting captures, back photos and 360s as jobs it polls, so they finish even if the phone drops the connection. Without settings, a development build runs in local mode against the original endpoints; a release build without settings (or with half-filled ones) shows a blocking "not configured" screen.
- **Backend** (`api/`): `WARDROBE_AUTH=on` verifies tokens against the project's JWKS and serves only user-scoped `/v1` routes (someone else's IDs answer 404); the local `runs/` routes aren't mounted. Off (default) = the file-based API.
- **Data** (Supabase): `profiles`, `wardrobe_items`, `generation_jobs` with row level security, column-limited client updates (`facts`, `deleted_at`), same-owner foreign keys and owner-folder path checks; private bucket `wardrobe` with owner-only reads. No Edge Functions.
- **Secrets:** `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` are server-only (`.env`). The app holds only the Supabase URL and publishable key (`mobile/.env`).
- **Proof:** pgTAP (`supabase/tests/database/`), API tests with two users (`tests/api/test_v1_*.py`), and a two-user end-to-end suite on the local stack (`tests/integration/`).

## Repository layout
```text
mobile/app/            Expo Router: _layout, sign-in, (tabs)/{index (Home), closet, add, account}
mobile/src/            api (local client, v1 client, types), auth (Supabase client, secure store, provider),
                       components (ItemSheet, TurnView, GarmentImage…), motion, theme, hooks, store
mobile/__tests__/      Jest + Testing Library
api/                   main.py (mode switch), auth, store (Supabase/in-memory), worker, credits, facts_edit,
                       routes/ (local: runs, items, images, turn; account: v1)
pipeline/              orchestrator, back.py, turn.py, stages/, providers/gemini.py, prompts/, run_log
supabase/              migrations, pgTAP tests, local CLI config, email template
scripts/               migrate_runs (runs/ → account), sweep_storage, backfill_cutouts
tests/                 pytest: pipeline, providers, API (local and v1), integration (local Supabase stack)
cli.py, ui/app.py      batch CLI and Streamlit harness for running the pipeline without the app
```

## Pipeline (per photo; the same in both modes)
1. **Quality** (`stage0_quality`, local OpenCV): reject below 800 px short side, too dark, or blurry.
2. **Detect + facts** (`stage1_detect_facts`, one Gemini vision call per photo, `gemini-3.1-flash-lite`, structured output): boxes, included/excluded, category, colors, pattern, trims, visible text, visible/hidden parts, cut-off-by-frame flag.
3. Per included item, concurrently:
   - **Crop** to the box (local).
   - **Generate** (`stage4_generate`, `gemini-2.5-flash-image`): same garment, unfolded, on white; edge-cut pieces are completed.
   - **Verify** (`stage5_verify`, local): Lab color distance and OCR text match against the facts; on failure regenerate with the violations (up to 2 retries).
   - **Cutout** (`cutout`, local rembg `isnet-general-use`, interior filled so white parts stay opaque; skipped if coverage looks wrong).
   - **Score** (`stage6_score`): tier high/medium/low with reason and retake tip.
4. One item failing does not fail the others; a failed detect call fails the photo.

Every model call is appended to a `run_log.jsonl` (stage, model, prompt version, latency, status). Prompts are versioned files in `pipeline/prompts/`.
**Back** (`pipeline/back.py`): same stages on one more photo, generation conditioned on the item's front image; the largest detected piece is used.
**360** (`pipeline/turn.py`): four ghost-mannequin views (front first, then right/back/left anchored on it), each cut out.

## Account mode
**Jobs.** `POST /v1/jobs` (garment), `POST /v1/items/{id}/back` and `POST /v1/items/{id}/turn` upload the photo to `<user>/jobs/<job>/upload.<ext>`, insert a `generation_jobs` row and return `202` with the job. Every job-creating request carries an `Idempotency-Key`; `unique (user_id, idempotency_key)` returns the existing job on retry, and `unique (job_id, piece_index)` stops a retried job duplicating items. The worker claims with `claim_generation_job` (`FOR UPDATE SKIP LOCKED`, 10-minute lease); a crashed job is reclaimed when its lease runs out, up to `max_attempts` (2).

**Storage** (bucket `wardrobe`, private): `<user>/items/<item>/{source,generated,cutout,crop}.*`, `…/back/<job>/…`, `…/turn/<job>/…`. Each new item keeps the **original upload** as its `source` (`source_kind = 'original'`); items migrated from `runs/` use their crop (`source_kind = 'crop'`). The catalog image is `display_path` (generated.png); the app shows the cutout first.

**API (`/v1`)**
| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/jobs` | start a garment job (multipart photo) |
| GET | `/v1/jobs/{id}` | job state, result, error, `cost_credits` |
| GET | `/v1/prices` | credit price list (`{"billing": false}` today) |
| GET | `/v1/credits` | the user's AI Credits wallet (`balance`, `held`, `available`) and activity, newest first (`?limit=` 1–100, `?before=<entry id>`) |
| GET | `/v1/items`, `/v1/items/{id}` | the user's items with signed image URLs |
| PATCH | `/v1/items/{id}` | edit facts (validated server-side) |
| DELETE | `/v1/items/{id}` | soft delete (`deleted_at`) |
| POST | `/v1/items/{id}/back`, `/v1/items/{id}/turn` | start a back or 360 job |

**Credits (hooks only):** jobs record `cost_credits` from `WARDROBE_CREDIT_PRICES` (unset = billing off); a `CreditGate` is called at reserve/release/settle/refund and is a no-op today. **Wallet (built, inactive):** `credit_wallets` (one per account, `balance`/`held`, created at sign-up) and append-only `credit_ledger` (`grant`/`hold`/`charge`/`release`), written only by `SECURITY DEFINER` functions `credit_grant`, `credit_reserve`, `credit_settle`, `credit_release` (service_role only; row lock + stable operation keys). The app can read its own wallet and activity; nothing in the job flow calls the functions yet. Grants: `scripts/grant_credits.py`. Design: [wallet design](superpowers/specs/2026-10-18-ai-credits-wallet-design.md). **Approved billing unit: a user-requested AI generation action, not a garment record.** Front-image creation (`garment` internally), back-image creation (`back`) and one 360 creation (`turn`, bundling four internal image calls) are different actions. Optional enhancements can be purchased for an existing garment later. Multi-piece photo quoting and counting still need a product decision; current backend prices one `garment` job per photo even if multiple fronts are produced. Product requirements: [CREDITS.md](CREDITS.md) (one wallet, server-owned prices, atomic reserve → settle/refund); its "Spec vs built hooks" section lists where M5 differs.

**Operations:** `scripts/migrate_runs.py` moves an existing `runs/` closet into an account (dry run by default, idempotent by `legacy_key`, `.trash` → `deleted_at`). `scripts/sweep_storage.py` removes files of deleted accounts and stale job uploads (dry run by default). `scripts/grant_credits.py` gives an account promotional AI Credits (dry run by default, idempotent by `--key`).

## Local mode (`runs/`, gitignored)
```text
runs/<run_id>/run_log.jsonl
runs/<run_id>/<photo>/item_<n>/
    crop.png  generated.png  cutout.png  facts.json  facts.original.json (after first edit)
    verification.json  result.json
    back/   crop.png generated.png cutout.png facts.json result.json  (optional)
    turn/   front|right|back|left.png + _cutout.png, status.json      (optional)
runs/.trash/…        soft-deleted items and replaced backs
```
The closet is a directory scan (newest first). The full original photo is not kept in local mode — only the per-item crop.

| Method | Path | Purpose |
|---|---|---|
| POST | `/runs` | multipart `photo`; runs the pipeline synchronously (15–60 s) |
| GET | `/items` | every item with a `generated.png`, with back and turn status |
| PATCH / DELETE | `/items/{run}/{photo}/{item}` | edit facts / soft delete to `.trash` |
| POST | `/items/{run}/{photo}/{item}/back` | add or replace the back |
| POST / GET | `/items/{run}/{photo}/{item}/turn` | start a 360 background task / read its state |
| GET | `/images/{run}/{photo}/{item}/{file}` (also `back/`, `turn/`) | allow-listed image files only |

## App
- Tabs: Home · Closet · Add · Account (`mobile/app/(tabs)/_layout.tsx`); `RootNavigator` sends signed-out users to Sign In.
- Session: Supabase's `LargeSecureStore` pattern (AES key in the Keychain, encrypted session in AsyncStorage), auto-refresh paused in the background.
- Plain `fetch` clients (`src/api/client.ts` local, `src/api/v1.ts` account) adapting both to the same item shapes; local component state.
- Native iOS look and motion per `DESIGN.md`; Reanimated motion that honors Reduce Motion; `expo-haptics`. Everything runs in Expo Go.
- `GarmentImage` falls back cutout → generated → crop → placeholder.

## Quality gates
`pytest` (providers faked), `npx jest`, `npx tsc --noEmit`, `npx supabase test db`; `pytest tests/integration` with the local Supabase stack running. Manual runs on real photos for prompt or generation changes; manual phone checks for UI.

## Known limits
- The server and worker run on the owner's Mac; off-LAN access (tunnel) is documented, not set up. No cloud host.
- Local mode's `POST /runs` holds the request for the whole run; its 360 is an in-process task.
- `pyproject.toml` still lists `anthropic` and `replicate` from the earlier pipeline version.
