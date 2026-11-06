"""Run the real Build My Look engine (api/outfit_builder) on the owner's closet for the film's answers.

Usage (from the repo root, with the API venv):
  PYTHONPATH=. ~/Projects/digital-wardrobe/.venv/bin/python -I promo-film/scripts/compute_looks.py <closet_rows.json>
closet_rows.json = the owner's active wardrobe_items rows (deleted and pending-review excluded), as
api/routes/v1._active_wardrobe passes them. Writes promo-film/src/data/looks.json. Nothing is invented:
titles, reasons, slots and swap alternatives are the engine's own output; the recording must match it.
"""
import json, os, sys
sys.path.insert(0, ".")
from api.outfit_builder.engine import build_suggestions
from api.outfit_builder.swap import swap_options

FILTERS = {"occasion": "going_out", "style": "streetwear", "vibe": "bold", "weather": "hot", "colors": "colorful"}
OPEN_LOOK = 2            # the look with the worn photo's jeans and sneakers; its top swaps to that photo's tee
SWAP_SLOT = "top"

rows = json.load(open(sys.argv[1]))
result = build_suggestions(rows, FILTERS)
assert not result.limitations, result.limitations
look = result.looks[OPEN_LOOK]
slot, alts = swap_options(rows, look.item_ids, look.slots[SWAP_SLOT], FILTERS)
out = {
    "filters": FILTERS,
    "looks": [{"title": l.title, "reason": l.reason, "item_ids": l.item_ids, "slots": l.slots} for l in result.looks],
    "open_look": OPEN_LOOK,
    "swap": {"slot": slot, "current": look.slots[SWAP_SLOT], "alternatives": [{"item_id": a, "reason": r} for a, r in alts]},
}
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "data", "looks.json")
json.dump(out, open(dest, "w"), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != "swap"}, indent=1)[:1500])
print("swap", slot, [a[:8] for a, _ in alts[:5]])
