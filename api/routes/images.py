import os
from fastapi import APIRouter
from starlette.responses import FileResponse, Response
from api.config import runs_dir

router = APIRouter()

ALLOWED_FILENAMES = {"crop.png", "generated.png", "cutout.png"}


@router.get("/images/{run_id}/{photo_name}/{item_id}/{filename}")
def get_image(run_id: str, photo_name: str, item_id: str, filename: str) -> Response:
    if filename not in ALLOWED_FILENAMES:
        return Response(status_code=404)
    path = os.path.join(runs_dir(), run_id, photo_name, item_id, filename)
    if not os.path.isfile(path):
        return Response(status_code=404)
    return FileResponse(path, media_type="image/png")
