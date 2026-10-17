"""The 360 "on body" view: four ghost-mannequin angles of an item, generated from its catalog images.

The front is generated first and then passed back as an anchor, so the other angles keep its volume
and proportions. Each view is cut out locally like every other garment image.
"""
import asyncio
import os
from pipeline.stages import cutout

TURN_ORDER = ("front", "right", "back", "left")

# Per model call. Four of these stay under the API's 5-minute stale window, so a job that
# hangs fails on its own before the owner can start another one.
VIEW_TIMEOUT_SECONDS = 60


class TurnFailed(Exception):
    """The 360 view couldn't be made; the message is shown to the user."""


async def run_turn(front_path: str, back_path: str | None, out_dir: str, imagegen) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    paths: list[str] = []
    anchor: str | None = None
    for view in TURN_ORDER:
        try:
            data = await asyncio.wait_for(imagegen.generate_view(front_path, back_path, view, anchor),
                                          VIEW_TIMEOUT_SECONDS)
        except Exception as e:
            raise TurnFailed("couldn't create the 360 view — try again") from e
        path = os.path.join(out_dir, f"{view}.png")
        with open(path, "wb") as f:
            f.write(data)
        if view == "front":
            anchor = path
        cutout.run(path, os.path.join(out_dir, f"{view}_cutout.png"))
        paths.append(path)
    return paths
