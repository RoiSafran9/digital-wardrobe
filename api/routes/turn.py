import os
import shutil
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends
from api.config import runs_dir
from api.item_loader import load_turn, turn_job, write_turn_status
from api.routes.items import TRASH_DIR, _error, _item_dir
from api.routes.runs import ProviderFactory, get_provider_factory
from api.schemas import TurnOut
from pipeline.run_log import RunLogger
from pipeline.turn import TurnFailed, TurnRefs, refs_for_item, run_turn

router = APIRouter()


async def _make_turn(refs: TurnRefs, turn_dir: str, started_at: str, job: str, imagegen) -> None:
    # Views are made in the job's own folder and published only if this job still owns turn/:
    # a job that outlived the stale window must never write into the retry that replaced it.
    work = os.path.join(turn_dir, f".job-{job}")
    try:
        await run_turn(refs, work, imagegen)
    except Exception as e:
        shutil.rmtree(work, ignore_errors=True)
        if turn_job(turn_dir) == job:
            message = str(e) if isinstance(e, TurnFailed) else "couldn't create the 360 view — try again"
            write_turn_status(turn_dir, "failed", started_at, message, job)
        return
    if turn_job(turn_dir) != job:
        shutil.rmtree(work, ignore_errors=True)
        return
    for name in os.listdir(work):
        os.replace(os.path.join(work, name), os.path.join(turn_dir, name))
    os.rmdir(work)
    write_turn_status(turn_dir, "done", started_at, job=job)


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
    job = uuid.uuid4().hex
    write_turn_status(turn_dir, "running", started_at, job=job)

    imagegen = provider_factory(RunLogger(os.path.join(item_dir, "turn_log.jsonl"))).imagegen
    background.add_task(_make_turn, refs_for_item(item_dir), turn_dir, started_at, job, imagegen)
    return TurnOut(state="running")


@router.get("/items/{run_id}/{photo_name}/{item_id}/turn", response_model=TurnOut)
def get_turn(run_id: str, photo_name: str, item_id: str):
    item_dir = _item_dir(run_id, photo_name, item_id)
    turn = load_turn(item_dir, run_id, photo_name, item_id) if item_dir else None
    if turn is None:
        return _error(404, "no 360 view yet")
    return turn
