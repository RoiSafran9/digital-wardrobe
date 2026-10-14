# Digital Wardrobe — Expo Mobile App Design

## Context

Pipeline backend (`pipeline/`) exists and works: `run_photo(image_path, output_dir, providers, logger, max_attempts)` turns one photo into per-item results (crop image, generated clean image, facts, confidence tier), written to `runs/<run_id>/<photo_name>/item_<n>/`. Today the only way to run it is the Streamlit test harness (`ui/app.py`) or CLI — both desktop-only.

This spec covers building a personal-use mobile app (Expo, for the user's own phone) that captures/uploads a wardrobe photo, runs it through the pipeline, and shows results — plus a "closet" screen listing every item ever processed. This requires a new HTTP API in front of the pipeline, since the pipeline is currently a Python-only library with no network interface.

## Decisions

- **Scope:** personal, single-user app. No auth, no multi-tenancy, no cloud deploy. Phone and backend share the same local WiFi network; app talks to the backend via the Mac's LAN IP.
- **Backend call style:** synchronous. `POST /runs` blocks until `run_photo()` completes and returns the full result in one response. No job queue, no polling (YAGNI — pipeline already simplified to a handful of model calls; revisit only if real timeouts bite).
- **Persistence:** none beyond the existing filesystem convention (`runs/<run_id>/...`). The closet listing is built by scanning that directory at request time — no database.
- **Mobile stack:** Expo + TypeScript, `expo-router` for tab navigation, plain `fetch` for networking, local `useState`/`useEffect` per screen (no Redux/React Query — YAGNI for a 3-screen personal app).
- **Backend stack:** FastAPI, new `api/` directory, imports `pipeline.orchestrator.run_photo` directly (in-process, no subprocess/RPC).

## Project structure

```
my_wardrobe/
├── pipeline/                 # unchanged
├── ui/                       # unchanged (Streamlit harness stays)
├── api/
│   ├── __init__.py
│   ├── main.py                # FastAPI app, route wiring, static mount
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── runs.py             # POST /runs
│   │   └── items.py            # GET /items
│   └── schemas.py              # Pydantic response models (API-facing, separate from pipeline.types)
├── tests/
│   └── api/
│       ├── test_runs.py
│       └── test_items.py
└── mobile/
    ├── app.json
    ├── package.json
    ├── tsconfig.json
    ├── app/
    │   ├── _layout.tsx           # expo-router root layout, tab navigator
    │   ├── index.tsx              # Capture tab
    │   ├── results.tsx            # Results tab
    │   └── closet.tsx             # Closet tab
    ├── src/
    │   ├── api/
    │   │   ├── client.ts          # fetch wrapper, base URL config
    │   │   └── types.ts           # TS mirrors of api/schemas.py response shapes
    │   └── components/
    │       ├── ItemCard.tsx       # image + tier badge + facts, shared by Results/Closet detail
    │       └── TierBadge.tsx      # tier -> color mapping
    └── __tests__/
        ├── client.test.ts
        └── TierBadge.test.tsx
```

## Backend API (`api/`)

### `POST /runs`

- **Request:** multipart form, single field `photo` (image file).
- **Behavior:** saves upload to a temp path, builds a fresh `output_dir` under `runs/<run_id>/<photo_name>/`, calls `run_photo(path, output_dir, providers, logger)`. `providers` built via `cli.build_providers(logger)` (already a standalone function, same one `ui/app.py:27` calls) and `logger` via `RunLogger(os.path.join(run_dir, "run_log.jsonl"))` (same as `ui/app.py:24`) — import both, do not duplicate their logic.
- **Response `200`:**
  ```json
  {
    "run_id": "string",
    "quality": {"status": "ok", "reason": null},
    "items": [
      {
        "item_id": "item_0",
        "tier": "high",
        "reason": "string",
        "retake_instruction": null,
        "facts": { "...": "ItemFacts fields" },
        "crop_url": "/images/<run_id>/<photo_name>/item_0/crop.png",
        "generated_url": "/images/<run_id>/<photo_name>/item_0/generated.png"
      }
    ],
    "failed": ["item_2"]
  }
  ```
- **Errors:**
  - `400` if no file / unreadable image: `{"error": "no photo provided"}` or `{"error": "cannot read image"}`.
  - `500` if `run_photo` raises unexpectedly: `{"error": str(exc)}`.

### `GET /items`

- **Behavior:** walks `runs/*/*/item_*/result.json` (same layout `run_photo` already writes), reading each item's `result.json` + `facts.json` sibling files. No new index file — directory scan is the source of truth.
- **Response `200`:**
  ```json
  {
    "items": [
      {
        "run_id": "string",
        "item_id": "item_0",
        "tier": "high",
        "facts": { "...": "ItemFacts fields" },
        "crop_url": "/images/<run_id>/<photo_name>/item_0/crop.png",
        "generated_url": "/images/<run_id>/<photo_name>/item_0/generated.png"
      }
    ]
  }
  ```
  Sorted newest-first (by directory mtime).
- Items whose `result.json` is missing/unreadable are skipped, not errored (partial runs from `failed` list shouldn't break the whole listing).

### `GET /images/{run_id}/{photo_name}/{item_id}/{filename}`

- Static file serve, mapped straight to `runs/<run_id>/<photo_name>/<item_id>/<filename>` on disk. `filename` restricted to `crop.png` or `generated.png` (reject anything else with `404`, to avoid arbitrary path traversal outside the intended two files).

### Testing

- `tests/api/test_runs.py`, `tests/api/test_items.py` using FastAPI's `TestClient`, same `pytest` + `pytest-asyncio` conventions as the rest of the repo. Fake/stub providers (same pattern as existing stage tests) so tests don't hit real Gemini APIs.

## Mobile app (`mobile/`)

### Capture tab (`app/index.tsx`)

- `expo-image-picker`: button to take a photo or pick from library.
- On selection: `POST /runs` (multipart) via `src/api/client.ts`, show a loading spinner for the duration (no progress steps — single synchronous call per the decision above).
- On success: store the response in a simple in-memory store (React context or just route params) and navigate to Results tab.
- On error: show the error message from the API response in an inline banner; stay on Capture tab.

### Results tab (`app/results.tsx`)

- Renders the last run's `items` (from the shared store) as a list of `ItemCard`s: generated image, `TierBadge`, facts list, and `retake_instruction` text when tier is `"low"`.
- Empty state ("no run yet — go capture a photo") when there's no last-run data.

### Closet tab (`app/closet.tsx`)

- On mount: `GET /items`, render as a grid of thumbnails (`generated_url`).
- Tap a thumbnail → expands to the same `ItemCard` detail view used in Results (shared component, no duplicate rendering logic).
- Pull-to-refresh re-fetches `GET /items`.

### `src/api/client.ts`

- Base URL from a config constant (`EXPO_PUBLIC_API_URL` env var, falls back to a hardcoded LAN IP placeholder the user edits once).
- Thin wrapper: `postRun(photoUri): Promise<RunResponse>`, `getItems(): Promise<ItemsResponse>`. Throws on non-2xx with the parsed `{error}` body as the message.

### `TierBadge.tsx`

- Pure function/component: `tier: "high" | "medium" | "low"` → color + label (`high` = green "Great", `medium` = yellow "OK", `low` = red "Retake"). This mapping is the only piece of UI logic worth a unit test.

### Testing

- Jest + `@testing-library/react-native` (Expo's default test setup via `jest-expo`).
- `client.test.ts`: mocks `fetch`, asserts `postRun`/`getItems` parse success and error responses correctly.
- `TierBadge.test.tsx`: asserts tier → color/label mapping.
- No snapshot/visual tests for MVP — screens are thin wiring over tested units.

## Data flow (end to end)

1. User opens Capture tab, picks/takes photo.
2. App POSTs multipart image to `http://<mac-lan-ip>:8000/runs`.
3. API saves file, calls `run_photo`, waits for full pipeline run (quality check → detect+facts → per-item generate/verify loop → score), returns JSON with per-item tiers/facts/image URLs.
4. App shows Results tab with that run's items; images loaded from `/images/...` URLs pointing at the same backend.
5. Separately, Closet tab calls `GET /items` any time, which re-scans the `runs/` directory and returns every item from every past run — including ones from this run, once Step 3 finished writing files to disk.

## Error handling

- **Network unreachable** (phone not on same WiFi, wrong IP): `fetch` rejects, app shows "can't reach server — check WiFi/IP" banner.
- **Pipeline failure for a whole photo** (quality=retake or zero items detected): `run_photo` already returns `{"items": [], "failed": []}` in those cases — API passes that through as a `200` with empty `items`; app shows "no items found — retake photo".
- **Pipeline failure for one item**: already captured in `run_photo`'s `failed` list; API includes it in the response; app shows a small "N item(s) failed to process" note, doesn't block viewing the items that did succeed.
- **Static file 404** (image path tampering or race before file write completes): app shows a placeholder broken-image icon, not a crash.

## Out of scope (for this spec)

- Cloud deployment / remote access.
- Auth / multi-user.
- Editing or deleting closet items.
- Outfit suggestions or any feature beyond capture → view → closet.
- Async job queue / progress streaming (documented as the upgrade path if sync calls prove too slow in practice).
