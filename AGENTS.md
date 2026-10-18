# Shared Agent Instructions

This repository is the source of truth for Digital Wardrobe code and product decisions. `PRODUCT.md` (users, principles) and `DESIGN.md` (visual system) override anything older; `docs/superpowers/specs/2026-10-18-multiuser-architecture-design.md` records the account/backend decisions.

## Before working
1. Read `README.md`, `PRODUCT.md`, `docs/PRD.md` and `docs/ARCHITECTURE.md`; for UI also `DESIGN.md`; for a feature, its spec in `docs/superpowers/specs/`.
2. Inspect the current branch, status and recent commits. Do not overwrite or discard work from another agent.
3. If a request falls under "Later" in `docs/ROADMAP.md` or isn't covered by the docs, raise it rather than building it silently.

## Working rules
- Commit directly to `main` — the owner's chosen workflow. Pull before work, keep commits small and focused, never force-push. Use a branch or PR only when the owner asks.
- Python 3.11 (pipeline, API) and TypeScript (app). Prefer simple solutions over speculative abstraction.
- Two modes must keep working: **account mode** (`WARDROBE_AUTH=on`, Supabase, `/v1`) and **local mode** (default, files under `runs/`). Don't break one while changing the other.
- **Privacy:** every wardrobe is private to its account. Take the user ID only from the verified token, never from a request body or path; scope every query and Storage path to it (`<user_id>/…`); answer someone else's IDs with 404. Images go out only as short-lived signed URLs. Schema or policy changes come as migrations in `supabase/migrations/` with pgTAP tests proving two accounts stay isolated.
- **Secrets:** `GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` live only in the server's `.env`. The app (`mobile/`) gets only the Supabase URL and publishable key. Never commit `.env*`, keys, `runs/` (the owner's real clothing photos) or build output.
- **Jobs:** AI work in account mode is a `generation_jobs` row run by the worker. Job-creating requests carry an `Idempotency-Key`; retries must never create duplicate items or a second paid model call.
- **Garment fidelity:** the catalog image reproduces the real piece as photographed (color, wash, texture, print, text, trims, proportions), only unfolded, smoothed and isolated. Don't invent logos or details. Pieces running past the photo edge are completed, with a non-blocking tip. Generated views that weren't photographed (360) are labelled as AI.
- Closet images: transparent cutout first, white-background generated image as fallback, photo crop last. Removal is a soft delete and stays recoverable; the model's original facts are kept on first edit.
- Cost and latency: no extra paid model calls or waiting beyond what a feature needs; expensive features run only on request. Billing stays off until the owner sets prices.
- Add tests for behavior changes and update `docs/PRD.md`, `docs/ARCHITECTURE.md` or `docs/ROADMAP.md` when an agreed requirement or design changes.
- No invented users, testimonials or metrics in docs or UI.

## Credits decision
- Approved product direction: **one unified AI Credits wallet per account**, a remaining-balance meter in Account, and an in-app AI Price List. Built so far: only the M5 hooks (job `cost_credits`, env price list, a no-op `CreditGate`, `GET /v1/prices`); billing is off and there is no wallet, ledger, meter or price-list screen.
- Do not invent numerical credit prices or purchase plans. Build billing only on reviewed scope: server-owned prices, identity from the verified token, atomic/idempotent ledger changes, clear user confirmation and failure reconciliation. Read `docs/CREDITS.md` (decisions, and where they differ from the built hooks) first.

## Checks
```bash
PYTHONPATH=$PWD .venv/bin/pytest -q      # pipeline + API, from repo root (providers faked, no network)
cd mobile && npx jest && npx tsc --noEmit
npx supabase test db                     # database rules (local stack running)
pytest tests/integration                 # two-user end-to-end; needs SUPABASE_TEST_* env, see README
```
Changes to prompts or generation also need a manual run on a real photo; say when a check couldn't run.

## Coordination
Several agents (Claude Code sessions, Codex) may work in this repo. Check recent commits and open PRs before editing overlapping areas, keep to the files your task needs, and leave a short summary of files changed, checks run and open questions.
