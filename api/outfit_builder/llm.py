"""Optional, feature-flagged step: ask Gemini for nicer titles/reasons for the looks the deterministic
engine already picked. Off unless WARDROBE_OUTFIT_BUILDER_AI=on and WARDROBE_GENERATION is on; any
failure, timeout, invalid JSON or out-of-set candidate id leaves the engine's own deterministic titles
and reasons untouched. The model never sees or chooses item ids, image URLs or account details — only
opaque per-look candidate ids and the bounded, prevalidated metadata in the prompt.

See docs/features/ai-outfit-builder/03-RECOMMENDATION-ENGINE.md section 7. Deviation from that section:
there the model may also rerank/shortlist; here it only relabels the engine's own selection, so a
model mistake can never change which owned items are shown.
"""
from __future__ import annotations

import json
import logging
import os

log = logging.getLogger("wardrobe.outfit_builder.llm")

MODEL = "gemini-3.1-flash-lite"
TIMEOUT_S = 8
TITLE_MAX = 40
REASON_MAX = 140


def rerank_enabled() -> bool:
    from api.controls import generation_on
    return generation_on() and os.environ.get("WARDROBE_OUTFIT_BUILDER_AI", "").strip().lower() == "on"


def _prompt(candidates: list[dict], filters: dict) -> str:
    return (
        "You write short titles and reasons for outfits already built from clothes the user owns. "
        "Every candidate and item is already validated and fixed — do not invent, reorder, drop or "
        "add any candidate_id, item, slot, color or weather fact; only describe what is given. "
        "Return strict JSON of exactly this shape, one entry per candidate given: "
        '{"ranked": [{"candidate_id": "<id>", "title": "<=40 chars", "reason": "<=140 chars, terse, English"}]}.\n'
        f"context: {json.dumps(filters)}\n"
        f"candidates: {json.dumps(candidates)}"
    )


def _parse_response(text: str, known_ids: set) -> dict[str, tuple[str, str]] | None:
    try:
        data = json.loads(text)
        entries = data["ranked"]
    except (json.JSONDecodeError, KeyError, TypeError):
        return None
    out: dict[str, tuple[str, str]] = {}
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict):
            continue
        cid, title, reason = entry.get("candidate_id"), entry.get("title"), entry.get("reason")
        if (cid in known_ids and isinstance(title, str) and isinstance(reason, str)
                and 0 < len(title) <= TITLE_MAX and 0 < len(reason) <= REASON_MAX):
            out[cid] = (title.strip(), reason.strip())
    return out or None


def rerank(candidates: list[dict], filters: dict) -> dict[str, tuple[str, str]] | None:
    """candidates: [{"candidate_id", "items": [{"opaque_id","slot","subtype","colors","formality"}]}].
    Returns {candidate_id: (title, reason)} for the ids the model actually answered for in valid
    shape — missing/invalid ids simply keep the caller's own deterministic title/reason. Returns
    None only when nothing usable came back at all (the caller then also flags `used_fallback`)."""
    if not candidates:
        return None
    try:
        from google import genai
        from pipeline.config import require_env
        client = genai.Client(api_key=require_env("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model=MODEL, contents=_prompt(candidates, filters),
            config={"response_mime_type": "application/json", "http_options": {"timeout": TIMEOUT_S * 1000}},
        )
        return _parse_response(response.text or "", {c["candidate_id"] for c in candidates})
    except Exception:
        log.warning("outfit builder rerank unavailable, keeping the deterministic titles", exc_info=True)
        return None
