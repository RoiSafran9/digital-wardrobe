"""Build My Look's deterministic recommendation engine: constructs candidate outfits from the
authenticated user's own wardrobe, scores them against the context the user actually chose, and
selects up to three meaningfully different looks. The optional Gemini step (api/outfit_builder/llm.py)
only relabels the looks this engine already picked; it never changes which items are used.

See docs/features/ai-outfit-builder/03-RECOMMENDATION-ENGINE.md.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product

from api.outfit_builder import llm
from api.outfit_builder.taxonomy import DARK_COLORS, LIGHT_COLORS, NEUTRAL_COLORS, GarmentFeatures, features_for

# Bounds on candidate generation — operational performance settings (benchmark-able later), not a
# cap on how many clothes a user may store (section 4).
TOP_K_PER_SLOT = 8
TOP_K_LAYER = 2
LOOK_LIMIT = 3
# Below this, an explicitly chosen preference (anything other than "any") isn't honestly met —
# the honest answer is "no good match", never a low-quality look mislabeled as a fit (section 5).
MIN_ACCEPTABLE_SCORE = 0.35
# How strongly a new look is penalized for overlapping with one already selected (an MMR-style
# diversity pass over the shared-item fraction of two looks).
DIVERSITY_LAMBDA = 0.6

_TIER_RANK = {"high": 0, "medium": 1, "low": 2}

# Soft, approximate mappings from the user's chosen context onto the formality/warmth signals
# section 2 defines. None means "this choice carries no formality/warmth implication" — Any, and
# the purely aesthetic vibes that have no factual counterpart on a garment.
OCCASION_FORMALITY = {"formal": "formal", "going_out": "smart", "date": "smart", "work": "smart",
                      "everyday": "casual", "any": None}
STYLE_FORMALITY = {"elegant": "formal", "smart_casual": "smart", "sporty": "casual",
                   "streetwear": "casual", "casual": "casual", "any": None}
VIBE_FORMALITY = {"confident": "smart", "relaxed": "casual", "minimal": None, "bold": None, "any": None}
WEATHER_WARMTH = {"hot": "light", "cold": "heavy", "warm": None, "mild": None, "rainy": None, "any": None}

_OCCASION_LABEL = {"everyday": "an everyday day", "work": "work", "date": "a date",
                   "going_out": "going out", "formal": "a formal occasion"}
_WEATHER_LABEL = {"hot": "hot", "warm": "warm", "mild": "mild", "cold": "cold", "rainy": "rainy"}

# A strong, named requirement (section 5): "if a strong selection such as Formal cannot be met
# honestly, tell the user instead of silently delivering Casual looks and describing them as formal."
# This is a hard gate, independent of the blended score below, so it can't be diluted by an unrelated
# dimension (e.g. a candidate with no color data at all scoring a free 1.0 on visual compatibility).
_STRONG_FORMAL = {"formal", "elegant"}


def _meets_strong_formality(items: tuple[GarmentFeatures, ...], filters: dict) -> bool:
    if filters["occasion"] not in _STRONG_FORMAL and filters["style"] not in _STRONG_FORMAL:
        return True
    return not any(f.formality == "casual" for f in items)


@dataclass(frozen=True)
class Candidate:
    items: tuple[GarmentFeatures, ...]
    slots: dict  # slot -> item_id

    @property
    def item_ids(self) -> tuple[str, ...]:
        return tuple(i.item_id for i in self.items)


@dataclass(frozen=True)
class LookResult:
    look_id: str
    title: str
    reason: str
    item_ids: list[str]
    slots: dict
    completeness: str = "core_outfit"


@dataclass
class SuggestionsResult:
    looks: list[LookResult] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    used_fallback: bool = False


def _pool(features: list[GarmentFeatures], slot: str, limit: int) -> list[GarmentFeatures]:
    matches = [f for f in features if f.slot == slot]
    matches.sort(key=lambda f: (_TIER_RANK.get(f.tier, 3), f.item_id))
    return matches[:limit]


def _raw_candidates(features: list[GarmentFeatures]) -> list[Candidate]:
    tops = _pool(features, "top", TOP_K_PER_SLOT)
    bottoms = _pool(features, "bottom", TOP_K_PER_SLOT)
    one_pieces = _pool(features, "one_piece", TOP_K_PER_SLOT)
    outerwear = _pool(features, "outerwear", TOP_K_LAYER)
    footwear = _pool(features, "footwear", TOP_K_LAYER)

    cores: list[dict] = [{"top": t, "bottom": b} for t, b in product(tops, bottoms)]
    cores += [{"one_piece": o} for o in one_pieces]

    candidates: list[Candidate] = []
    seen: set[frozenset] = set()
    for core in cores:
        # Bare core, plus one variant per optional layer the wardrobe actually has, plus both
        # together — never a cross product of every outerwear with every footwear (section 4's
        # "bounded top-K... diverse candidate pool", not an exhaustive enumeration).
        variants = [dict(core)]
        if outerwear:
            variants.append({**core, "outerwear": outerwear[0]})
        if footwear:
            variants.append({**core, "footwear": footwear[0]})
        if outerwear and footwear:
            variants.append({**core, "outerwear": outerwear[0], "footwear": footwear[0]})
        for variant in variants:
            ids = frozenset(g.item_id for g in variant.values())
            if ids in seen:
                continue
            seen.add(ids)
            candidates.append(Candidate(items=tuple(variant.values()), slots={s: g.item_id for s, g in variant.items()}))
    return candidates


def _context_fit(items: tuple[GarmentFeatures, ...], filters: dict) -> float:
    target_formality = (OCCASION_FORMALITY.get(filters["occasion"]) or STYLE_FORMALITY.get(filters["style"])
                        or VIBE_FORMALITY.get(filters["vibe"]))
    target_warmth = WEATHER_WARMTH.get(filters["weather"])
    if not target_formality and not target_warmth:
        return 0.7  # no context constraint chosen: a neutral baseline, not a reward or a penalty
    scores = []
    if target_formality:
        for f in items:
            if f.formality == "unknown":
                scores.append(0.5)
            elif f.formality == target_formality:
                scores.append(1.0)
            elif {f.formality, target_formality} == {"casual", "formal"}:
                scores.append(0.0)  # a real clash: e.g. sneakers for a Formal occasion
            else:
                scores.append(0.6)  # smart next to casual/formal: a soft mismatch, not a hard one
    if target_warmth:
        for f in items:
            if f.warmth == "unknown":
                scores.append(0.5)
            elif f.warmth == target_warmth:
                scores.append(1.0)
            elif {f.warmth, target_warmth} == {"light", "heavy"}:
                scores.append(0.1)  # a heavy coat on a "Hot" look, or only light pieces for "Cold"
            else:
                scores.append(0.6)
    return sum(scores) / len(scores)


def _visual_compat(items: tuple[GarmentFeatures, ...], filters: dict) -> float:
    palette = [c for f in items for c in f.colors]
    distinct = {c for c in palette if c not in NEUTRAL_COLORS}
    base = 1.0 if len(distinct) <= 1 else 0.75 if len(distinct) == 2 else 0.45
    pref = filters["colors"]
    if pref == "any" or not palette:
        return base
    sets = {"neutral": NEUTRAL_COLORS, "colorful": set(palette) - NEUTRAL_COLORS, "dark": DARK_COLORS, "light": LIGHT_COLORS}
    wanted = sets[pref]
    match = sum(1 for c in palette if c in wanted) / len(palette)
    return (base + match) / 2


def _style_vibe_fit(items: tuple[GarmentFeatures, ...], filters: dict) -> float:
    # No dedicated style/vibe tags exist on an item yet (section 2's `styleTags` is sparse/empty), so
    # this is a soft proxy: how well the item's inferred formality matches the chosen style or vibe.
    target = STYLE_FORMALITY.get(filters["style"]) or VIBE_FORMALITY.get(filters["vibe"])
    if not target:
        return 0.7
    matches = [1.0 if f.formality == target else 0.5 if f.formality == "unknown" else 0.3 for f in items]
    return sum(matches) / len(matches)


def score_candidate(items: tuple[GarmentFeatures, ...], filters: dict) -> float:
    """Context 35%, visual/palette 35%, style+vibe 20% (section 6), renormalized to these three —
    diversity (the remaining 10%) is a property of a *set* of looks, applied in select_looks, not of
    one candidate alone."""
    return 0.39 * _context_fit(items, filters) + 0.39 * _visual_compat(items, filters) + 0.22 * _style_vibe_fit(items, filters)


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def select_looks(scored: list[tuple[Candidate, float]], limit: int = LOOK_LIMIT) -> list[tuple[Candidate, float]]:
    """Diversity-aware (MMR-style) greedy selection: each pick maximizes its own score minus a
    penalty for overlapping with looks already chosen, so three similar top+bottom pairs don't all
    make the cut over one genuinely different combination (section 6, fixture N)."""
    pool = list(scored)
    selected: list[tuple[Candidate, float]] = []
    while pool and len(selected) < limit:
        def adjusted(entry: tuple[Candidate, float]) -> float:
            candidate, score = entry
            ids = frozenset(candidate.item_ids)
            overlap = max((_jaccard(ids, frozenset(s.item_ids)) for s, _ in selected), default=0.0)
            return score - DIVERSITY_LAMBDA * overlap
        best = max(pool, key=adjusted)
        pool.remove(best)
        selected.append(best)
    return selected


def _title_for(items: tuple[GarmentFeatures, ...]) -> str:
    names = [i.category.title() for i in items if i.category]
    return " & ".join(dict.fromkeys(names)) or "Your Look"


def _reason_for(filters: dict) -> str:
    bits = []
    if filters["occasion"] != "any":
        bits.append(_OCCASION_LABEL.get(filters["occasion"], filters["occasion"]))
    if filters["weather"] != "any":
        bits.append(f"{_WEATHER_LABEL.get(filters['weather'], filters['weather'])} weather")
    if not bits:
        return "A look built from pieces you already own."
    return f"A pairing for {' and '.join(bits)}."


def _coverage_message(features: list[GarmentFeatures]) -> str | None:
    if not features:
        return "Your looks start in your closet. Add a few pieces to see outfits made just for you."
    has_top = any(f.slot == "top" for f in features)
    has_bottom = any(f.slot == "bottom" for f in features)
    has_one_piece = any(f.slot == "one_piece" for f in features)
    if has_one_piece or (has_top and has_bottom):
        return None
    if has_top and not has_bottom:
        return "Add a bottom or a one-piece to build your first look."
    if has_bottom and not has_top:
        return "Add a top or a one-piece to build your first look."
    return "Add a top and a bottom, or a one-piece, to build your first look."


def build_suggestions(wardrobe_items: list[dict], filters: dict) -> SuggestionsResult:
    """wardrobe_items: the caller's own active, renderable items (api/routes/v1._active_wardrobe).
    filters: an OutfitFiltersIn.model_dump() — occasion/style/vibe/weather/colors, each "any" or a
    chosen value. Never trusts or needs a client-supplied owner or item-id allowlist."""
    features = [features_for(i) for i in wardrobe_items]
    structural = [f for f in features if f.slot != "unknown"]
    missing = _coverage_message(structural)
    if missing:
        return SuggestionsResult(limitations=[missing])

    raw = _raw_candidates(structural)
    by_items = {frozenset(c.item_ids): c for c in raw}.values()  # no duplicate exact composition
    scored = [(c, score_candidate(c.items, filters)) for c in by_items]

    no_match = SuggestionsResult(limitations=["We couldn't find a good match for all these choices."])
    strong = [s for s in scored if _meets_strong_formality(s[0].items, filters)]
    if (filters["occasion"] in _STRONG_FORMAL or filters["style"] in _STRONG_FORMAL) and not strong:
        return no_match
    scored = strong

    has_constraint = any(v != "any" for v in filters.values())
    if has_constraint:
        meeting = [s for s in scored if s[1] >= MIN_ACCEPTABLE_SCORE]
        if not meeting:
            return no_match
        scored = meeting

    selected = select_looks(scored)
    looks = [
        LookResult(look_id=f"look_{i + 1}", title=_title_for(candidate.items), reason=_reason_for(filters),
                  item_ids=list(candidate.item_ids), slots=dict(candidate.slots))
        for i, (candidate, _score) in enumerate(selected)
    ]

    used_fallback = False
    if llm.rerank_enabled() and looks:
        payload = [{"candidate_id": look.look_id,
                    "items": [{"opaque_id": gid, "slot": slot, "subtype": next(
                        (g.category for g in c.items if g.item_id == gid), ""),
                        "colors": list(next(g.colors for g in c.items if g.item_id == gid)),
                        "formality": next(g.formality for g in c.items if g.item_id == gid)}
                        for slot, gid in look.slots.items()]}
                   for look, (c, _s) in zip(looks, selected)]
        overrides = llm.rerank(payload, filters)
        if overrides is None:
            used_fallback = True
        else:
            looks = [LookResult(l.look_id, *overrides.get(l.look_id, (l.title, l.reason)), l.item_ids, l.slots, l.completeness)
                    for l in looks]

    return SuggestionsResult(looks=looks, used_fallback=used_fallback)
