import os
import shutil
import time
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends
from api.config import runs_dir
from api.item_loader import load_turn, write_turn_status
from api.routes.items import TRASH_DIR, _error, _item_dir
from api.routes.runs import ProviderFactory, get_provider_factory
from api.schemas import TurnOut
from pipeline.run_log import RunLogger
from pipeline.turn import TurnFailed, run_turn

router = APIRouter()


async def _make_turn(front: str, back: str | None, turn_dir: str, started_at: str, imagegen) -> None:
    try:
        await run_turn(front, back, turn_dir, imagegen)
    except TurnFailed as e:
        write_turn_status(turn_dir, "failed", started_at, str(e))
        return
    except Exception:
        write_turn_status(turn_dir, "failed", started_at, "couldn't create the 360 view — try again")
        return
    write_turn_status(turn_dir, "done", started_at)


@router.post("/items/{run_id}/{photo_name}/{item_id}/turn", status_code=202, response_model=TurnOut)
async def start_turn(
    run_id: str, photo_name: str, item_id: str, background: BackgroundTasks,
    provider_factory: ProviderFactory = Depends(get_provider_factory),
):
    item_dir = _item_dir(run_id, photo_name, item_id)
    front = os.path.join(item_dir, "generated.png") if item_dir else None
    if not front or not os.path.exists(front):
        return _error(404, "item not found")
    current = load_turn(item_dir, run_id, photo_name, item_id)
    if current is not None and current.state == "running":
        return _error(409, "the 360 view is already being made")

    turn_dir = os.path.join(item_dir, "turn")
    if os.path.exists(turn_dir):
        # Regenerating never loses the previous views: they go to the trash like any removal.
        trash = os.path.join(runs_dir(), TRASH_DIR, run_id, photo_name, item_id, f"turn-{int(time.time())}")
        os.makedirs(os.path.dirname(trash), exist_ok=True)
        shutil.move(turn_dir, trash)
    os.makedirs(turn_dir)
    started_at = datetime.now(timezone.utc).isoformat()
    write_turn_status(turn_dir, "running", started_at)

    back = os.path.join(item_dir, "back", "generated.png")
    imagegen = provider_factory(RunLogger(os.path.join(item_dir, "turn_log.jsonl"))).imagegen
    background.add_task(_make_turn, front, back if os.path.exists(back) else None, turn_dir, started_at, imagegen)
    return TurnOut(state="running")


@router.get("/items/{run_id}/{photo_name}/{item_id}/turn", response_model=TurnOut)
def get_turn(run_id: str, photo_name: str, item_id: str):
    item_dir = _item_dir(run_id, photo_name, item_id)
    turn = load_turn(item_dir, run_id, photo_name, item_id) if item_dir else None
    if turn is None:
        return _error(404, "no 360 view yet")
    return turn
