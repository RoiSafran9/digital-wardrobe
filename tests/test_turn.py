import json
import os
import cv2
import numpy as np
import pytest
from pipeline.turn import TURN_ORDER, SideRef, TurnFailed, TurnRefs, ink_fraction, refs_for_item, run_turn


def _image(printed: bool):
    """A white tee on white; `printed` adds a big navy/red graphic in the middle."""
    img = np.full((100, 100, 3), 255, dtype=np.uint8)
    img[15:85, 25:75] = (238, 238, 238)          # the white garment itself
    if printed:
        img[35:60, 35:65] = (120, 50, 20)        # navy (BGR)
        img[60:70, 35:65] = (40, 40, 200)        # red
    return img


def _png_bytes(printed=True):
    return cv2.imencode(".png", _image(printed))[1].tobytes()


def _write_png(path, printed=True):
    cv2.imwrite(str(path), _image(printed))
    return str(path)


class FakeImageGen:
    def __init__(self, fail_on=None, plain_backs=0):
        self.calls = []
        self.fail_on = fail_on
        self.plain_backs = plain_backs          # how many back attempts come out without the print

    async def generate_view(self, refs, view, anchors, retry_note=None):
        self.calls.append({"view": view, "anchors": dict(anchors), "refs": refs, "retry_note": retry_note})
        if view == self.fail_on:
            raise RuntimeError("quota")
        if view == "back" and self.plain_backs > 0:
            self.plain_backs -= 1
            return _png_bytes(printed=False)
        return _png_bytes()


def _refs(tmp_path, back=True, back_printed=True):
    front = SideRef(catalog=_write_png(tmp_path / "front.png"), photo=_write_png(tmp_path / "crop.png"), text="LOGO")
    if not back:
        return TurnRefs(front=front, back=None)
    return TurnRefs(front=front, back=SideRef(
        catalog=_write_png(tmp_path / "back.png", back_printed), photo=_write_png(tmp_path / "back_crop.png", back_printed),
        text="DOME 90" if back_printed else ""))


@pytest.mark.asyncio
async def test_back_is_made_before_the_sides_and_the_front_anchors_the_others(tmp_path):
    gen = FakeImageGen()
    out = str(tmp_path / "turn")

    paths = await run_turn(_refs(tmp_path), out, gen)

    assert paths == [os.path.join(out, f"{v}.png") for v in TURN_ORDER]
    assert [c["view"] for c in gen.calls] == ["front", "back", "right", "left"]
    assert gen.calls[0]["anchors"] == {}
    # The back is drawn from the back photos alone: with the front ghost beside it, the model
    # copied the front onto the back.
    assert gen.calls[1]["anchors"] == {}
    # The back ghost's large print leaked onto the sleeves when it anchored the profiles.
    for side in gen.calls[2:]:
        assert side["anchors"] == {"front": os.path.join(out, "front.png")}
    for v in TURN_ORDER:
        assert os.path.exists(os.path.join(out, f"{v}.png"))
        assert os.path.exists(os.path.join(out, f"{v}_cutout.png"))


@pytest.mark.asyncio
async def test_every_view_sees_all_the_photos_of_the_item(tmp_path):
    gen = FakeImageGen()
    refs = _refs(tmp_path)
    await run_turn(refs, str(tmp_path / "turn"), gen)
    assert all(c["refs"] is refs for c in gen.calls)


@pytest.mark.asyncio
async def test_without_a_back_the_sides_only_anchor_on_the_front(tmp_path):
    gen = FakeImageGen()
    out = str(tmp_path / "turn")
    await run_turn(_refs(tmp_path, back=False), out, gen)
    assert gen.calls[1]["view"] == "back" and gen.calls[1]["anchors"] == {"front": os.path.join(out, "front.png")}
    # The made-up plain back is no reference for the sides.
    assert all(c["anchors"] == {"front": os.path.join(out, "front.png")} for c in gen.calls[2:])


@pytest.mark.asyncio
async def test_a_back_that_lost_its_print_is_made_once_more(tmp_path):
    gen = FakeImageGen(plain_backs=1)
    await run_turn(_refs(tmp_path), str(tmp_path / "turn"), gen)
    backs = [c for c in gen.calls if c["view"] == "back"]
    assert len(backs) == 2
    assert backs[0]["retry_note"] is None and "print" in backs[1]["retry_note"]


@pytest.mark.asyncio
async def test_retry_is_capped_at_one(tmp_path):
    gen = FakeImageGen(plain_backs=5)
    await run_turn(_refs(tmp_path), str(tmp_path / "turn"), gen)
    assert len([c for c in gen.calls if c["view"] == "back"]) == 2


@pytest.mark.asyncio
async def test_a_plain_back_is_not_retried(tmp_path):
    gen = FakeImageGen(plain_backs=1)
    await run_turn(_refs(tmp_path, back_printed=False), str(tmp_path / "turn"), gen)
    assert len([c for c in gen.calls if c["view"] == "back"]) == 1


def test_ink_fraction_sees_a_print_on_a_white_garment(tmp_path):
    assert ink_fraction(_write_png(tmp_path / "p.png", True)) > 0.05
    assert ink_fraction(_write_png(tmp_path / "n.png", False)) < 0.01


@pytest.mark.asyncio
async def test_a_failed_view_raises_turn_failed_with_a_readable_message(tmp_path):
    with pytest.raises(TurnFailed, match="try again"):
        await run_turn(_refs(tmp_path), str(tmp_path / "turn"), FakeImageGen(fail_on="back"))


@pytest.mark.asyncio
async def test_a_hung_model_call_times_out_instead_of_running_forever(tmp_path, monkeypatch):
    import asyncio
    import pipeline.turn as turn

    class Hung:
        async def generate_view(self, *args, **kwargs):
            await asyncio.sleep(5)

    monkeypatch.setattr(turn, "VIEW_TIMEOUT_SECONDS", 0.01)
    with pytest.raises(TurnFailed):
        await run_turn(_refs(tmp_path), str(tmp_path / "turn"), Hung())


def _field(v):
    return {"value": v, "confidence": 0.9, "basis": "observed"}


def _facts(text):
    return json.dumps({k: _field(v) for k, v in {
        "category": "t-shirt", "colors": ["white"], "pattern": "graphic", "visible_text": text,
        "trims": "", "visible_parts": ["front"], "occluded_parts": []}.items()})


def test_refs_for_item_collects_every_photo_and_its_printed_text(tmp_path):
    item = tmp_path / "item_0"
    (item / "back").mkdir(parents=True)
    for name in ("generated.png", "crop.png", "back/generated.png", "back/crop.png"):
        _write_png(item / name)
    (item / "facts.json").write_text(_facts("90 EASTERN DIVISION"))
    (item / "back" / "facts.json").write_text(_facts(["DOME", "90"]))

    refs = refs_for_item(str(item))

    assert refs.front == SideRef(catalog=str(item / "generated.png"), photo=str(item / "crop.png"), text="90 EASTERN DIVISION")
    assert refs.back == SideRef(catalog=str(item / "back/generated.png"), photo=str(item / "back/crop.png"), text="DOME 90")


def test_refs_for_item_without_a_back(tmp_path):
    item = tmp_path / "item_0"
    item.mkdir()
    _write_png(item / "generated.png")
    (item / "facts.json").write_text(_facts(""))
    refs = refs_for_item(str(item))
    assert refs.back is None and refs.front.photo is None and refs.front.text == ""
