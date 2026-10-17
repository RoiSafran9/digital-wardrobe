import json
import os
from datetime import datetime, timezone
from pipeline.types import ItemFacts, ItemResult


def load_item(item_dir: str) -> tuple[str, ItemResult, ItemFacts] | None:
    item_id = os.path.basename(item_dir)
    try:
        with open(os.path.join(item_dir, "result.json")) as f:
            result = ItemResult.model_validate_json(f.read())
        with open(os.path.join(item_dir, "facts.json")) as f:
            facts = ItemFacts.model_validate_json(f.read())
    except (OSError, ValueError):
        return None
    return item_id, result, facts


def image_urls(run_id: str, photo_name: str, item_id: str) -> tuple[str, str]:
    base = f"/images/{run_id}/{photo_name}/{item_id}"
    return f"{base}/crop.png", f"{base}/generated.png"


def cutout_url(item_dir: str, run_id: str, photo_name: str, item_id: str) -> str | None:
    # Only items whose background removal succeeded have a cutout.
    if not os.path.exists(os.path.join(item_dir, "cutout.png")):
        return None
    return f"/images/{run_id}/{photo_name}/{item_id}/cutout.png"


def load_back(item_dir: str, run_id: str, photo_name: str, item_id: str):
    """The item's back view as a BackOut, or None when it has no usable back."""
    from api.schemas import BackOut
    back_dir = os.path.join(item_dir, "back")
    if not os.path.exists(os.path.join(back_dir, "generated.png")):
        return None
    try:
        with open(os.path.join(back_dir, "facts.json")) as f:
            facts = ItemFacts.model_validate_json(f.read())
    except (OSError, ValueError):
        return None
    base = f"/images/{run_id}/{photo_name}/{item_id}/back"
    text = facts.visible_text.value
    return BackOut(
        generated_url=f"{base}/generated.png",
        cutout_url=f"{base}/cutout.png" if os.path.exists(os.path.join(back_dir, "cutout.png")) else None,
        visible_text=" ".join(text) if isinstance(text, list) else text,
    )


# A job still "running" after this long died with the server; it can be started again.
STALE_AFTER_SECONDS = 5 * 60
INTERRUPTED = "Interrupted — try again"


def write_turn_status(turn_dir: str, state: str, started_at: str, error: str | None = None) -> None:
    with open(os.path.join(turn_dir, "status.json"), "w") as f:
        json.dump({"state": state, "error": error, "started_at": started_at}, f)


def load_turn(item_dir: str, run_id: str, photo_name: str, item_id: str):
    """The item's 360 view as a TurnOut, or None when one was never started."""
    from api.schemas import TurnOut, TurnViewOut
    from pipeline.turn import TURN_ORDER
    turn_dir = os.path.join(item_dir, "turn")
    try:
        with open(os.path.join(turn_dir, "status.json")) as f:
            status = json.load(f)
        state, error = status["state"], status.get("error")
        started = datetime.fromisoformat(status["started_at"])
    except (OSError, ValueError, KeyError, TypeError):
        return None
    if state == "running" and (datetime.now(timezone.utc) - started).total_seconds() > STALE_AFTER_SECONDS:
        return TurnOut(state="failed", error=INTERRUPTED)
    if state != "done":
        return TurnOut(state=state, error=error)
    base = f"/images/{run_id}/{photo_name}/{item_id}/turn"
    views = [
        TurnViewOut(
            angle=angle, url=f"{base}/{angle}.png",
            cutout_url=f"{base}/{angle}_cutout.png" if os.path.exists(os.path.join(turn_dir, f"{angle}_cutout.png")) else None,
        )
        for angle in TURN_ORDER if os.path.exists(os.path.join(turn_dir, f"{angle}.png"))
    ]
    return TurnOut(state="done", views=views)
