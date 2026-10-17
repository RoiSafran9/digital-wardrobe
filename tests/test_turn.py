import os
import cv2
import numpy as np
import pytest
from pipeline.turn import TURN_ORDER, TurnFailed, run_turn


def _png_bytes():
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    img[20:80, 30:70] = (40, 50, 90)
    return cv2.imencode(".png", img)[1].tobytes()


class FakeImageGen:
    def __init__(self, fail_on=None):
        self.calls = []
        self.fail_on = fail_on

    async def generate_view(self, front_path, back_path, view, anchor_path=None):
        self.calls.append((front_path, back_path, view, anchor_path))
        if view == self.fail_on:
            raise RuntimeError("quota")
        return _png_bytes()


@pytest.mark.asyncio
async def test_makes_four_views_in_turn_order_anchored_on_the_front(tmp_path):
    gen = FakeImageGen()
    out = str(tmp_path / "turn")

    paths = await run_turn("front.png", "back.png", out, gen)

    assert paths == [os.path.join(out, f"{v}.png") for v in TURN_ORDER]
    assert [c[2] for c in gen.calls] == ["front", "right", "back", "left"]
    assert gen.calls[0][3] is None                                   # front has no anchor
    assert all(c[3] == os.path.join(out, "front.png") for c in gen.calls[1:])
    assert all(c[1] == "back.png" for c in gen.calls)
    for v in TURN_ORDER:
        assert os.path.exists(os.path.join(out, f"{v}.png"))
        assert os.path.exists(os.path.join(out, f"{v}_cutout.png"))


@pytest.mark.asyncio
async def test_works_without_a_back(tmp_path):
    gen = FakeImageGen()
    await run_turn("front.png", None, str(tmp_path / "turn"), gen)
    assert all(c[1] is None for c in gen.calls)


@pytest.mark.asyncio
async def test_a_failed_view_raises_turn_failed_with_a_readable_message(tmp_path):
    with pytest.raises(TurnFailed, match="try again"):
        await run_turn("front.png", None, str(tmp_path / "turn"), FakeImageGen(fail_on="back"))


@pytest.mark.asyncio
async def test_a_hung_model_call_times_out_instead_of_running_forever(tmp_path, monkeypatch):
    import asyncio
    import pipeline.turn as turn

    class Hung:
        async def generate_view(self, *args):
            await asyncio.sleep(5)

    monkeypatch.setattr(turn, "VIEW_TIMEOUT_SECONDS", 0.01)
    with pytest.raises(TurnFailed):
        await run_turn("front.png", None, str(tmp_path / "turn"), Hung())
