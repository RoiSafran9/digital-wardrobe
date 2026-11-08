"""The experimental Outfit Photo PoC module (pipeline/outfit.py). Providers faked, no network."""
import json
import os
from types import SimpleNamespace
import cv2
import numpy as np
import pytest
from pipeline import outfit
from pipeline.providers.gemini import _read_prompt
from pipeline.types import VerificationResult


def _cand(box_2d, category="t-shirt", **over):
    c = {"box_2d": box_2d, "category": category, "layer": "single", "colors": ["white"], "pattern": "solid",
         "visible_text": "", "description": "white tee", "visible_parts": ["front"], "hidden_parts": [],
         "visibility": "full", "uncertainty": ""}
    return {**c, **over}


def _scan(*candidates, scene_kind="worn"):
    return {"scene_kind": scene_kind, "person_count": 1, "candidates": list(candidates)}


def test_parse_scan_ids_run_top_to_bottom_whatever_the_model_order():
    raw = _scan(_cand([600, 300, 950, 700], "jeans"), _cand([150, 250, 550, 750], "jacket", layer="outer"),
                _cand([200, 400, 500, 600], "t-shirt", layer="inner"))
    scan = outfit.parse_scan(raw, width=1000, height=2000)
    assert [(c.id, c.category) for c in scan.candidates] == [("c1", "jacket"), ("c2", "t-shirt"), ("c3", "jeans")]
    jacket = scan.candidates[0].box
    assert (jacket.x, jacket.y, jacket.width, jacket.height) == (250, 300, 500, 800)  # 0-1000 scale → pixels


def test_parse_scan_drops_degenerate_boxes_and_flags_frame_edges():
    scan = outfit.parse_scan(_scan(_cand([100, 100, 102, 400]), _cand([500, 0, 1000, 600], "trousers")), 800, 800)
    assert [c.category for c in scan.candidates] == ["trousers"]
    assert scan.candidates[0].cut_off_by_frame


def test_parse_scan_keeps_scene_kind_for_routing():
    scan = outfit.parse_scan(_scan(scene_kind="flat"), 100, 100)
    assert scan.scene_kind == "flat" and scan.candidates == []


def test_preview_crop_and_outline_come_from_the_real_photo(tmp_path):
    photo = tmp_path / "photo.jpg"
    image = np.full((1000, 800, 3), 200, np.uint8)
    image[200:600, 200:600] = (0, 0, 255)
    cv2.imwrite(str(photo), image)
    c = outfit.parse_scan(_scan(_cand([200, 250, 600, 750])), 800, 1000).candidates[0]
    crop = cv2.imread(outfit.preview_crop(str(photo), c, str(tmp_path / "crop.png")))
    assert crop.shape[0] > 400 and crop.shape[1] > 400  # padded for context
    overlay = cv2.imread(outfit.outlined(str(photo), [c], str(tmp_path / "overlay.jpg")))
    assert overlay.shape == image.shape


def test_facts_for_maps_hidden_parts_to_occluded_parts():
    c = outfit.parse_scan(_scan(_cand([0, 0, 500, 500], hidden_parts=["hem (tucked in)"], visible_text="MANTRA")),
                          100, 100).candidates[0]
    facts = outfit.facts_for(c)
    assert facts.occluded_parts.value == ["hem (tucked in)"] and facts.occluded_parts.basis == "inferred"
    assert facts.visible_text.value == "MANTRA"


def test_generate_prompt_formats_and_never_mentions_the_person_traits():
    c = outfit.parse_scan(_scan(_cand([0, 0, 500, 500])), 100, 100).candidates[0]
    prompt = _read_prompt(outfit.GENERATE_PROMPT).format(facts_block=outfit.facts_block(c), violations_block="",
                                                         context_block=outfit.CONTEXT_BLOCK)
    assert "white tee" in prompt and "{" not in prompt.replace(outfit.facts_block(c), "")
    detect = _read_prompt(outfit.DETECT_PROMPT)
    assert "do not describe" in detect.lower() and "scene_kind" in detect


class _FakeModels:
    def __init__(self, fail_on: int | None = None):
        self.calls, self.fail_on = 0, fail_on

    async def generate_content(self, model, contents, config=None):
        self.calls += 1
        if self.calls == self.fail_on:
            raise RuntimeError("model refused")
        ok, png = cv2.imencode(".png", np.full((64, 64, 3), 255, np.uint8))
        part = SimpleNamespace(inline_data=SimpleNamespace(data=png.tobytes()))
        return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))],
                               usage_metadata=SimpleNamespace(prompt_token_count=1000, candidates_token_count=0))


def _client(models):
    return SimpleNamespace(aio=SimpleNamespace(models=models))


@pytest.fixture
def scene(tmp_path, monkeypatch):
    async def passing(crop, generated, facts, attempt):
        return VerificationResult(status="pass", violations=[], attempt=attempt)
    monkeypatch.setattr(outfit.stage5_verify, "run", passing)
    monkeypatch.setattr(outfit.cutout, "run", lambda src, dst: None)
    photo = tmp_path / "photo.jpg"
    cv2.imwrite(str(photo), np.full((1000, 800, 3), 128, np.uint8))
    scan = outfit.parse_scan(_scan(_cand([100, 100, 500, 700], "jacket"), _cand([550, 200, 950, 600], "jeans"),
                                   _cand([960, 200, 1000, 600], "shoes")), 800, 1000)
    return str(photo), scan, tmp_path / "out"


async def test_generate_selected_makes_only_the_selected_candidates(scene):
    photo, scan, out = scene
    models, usage = _FakeModels(), outfit.Usage()
    results = await outfit.generate_selected(_client(models), photo, scan, ["c2", "c2"], str(out), usage)
    assert list(results) == ["c2"] and results["c2"]["status"] == "generated"
    assert models.calls == 1 and len(usage.calls) == 1
    assert (out / "c2" / "generated.png").exists() and not (out / "c1").exists()


async def test_generate_selected_refuses_unknown_ids_before_any_paid_call(scene):
    photo, scan, out = scene
    models = _FakeModels()
    with pytest.raises(ValueError):
        await outfit.generate_selected(_client(models), photo, scan, ["c1", "c9"], str(out), outfit.Usage())
    assert models.calls == 0


async def test_one_failed_candidate_does_not_stop_the_others(scene):
    photo, scan, out = scene
    usage = outfit.Usage()
    results = await outfit.generate_selected(_client(_FakeModels(fail_on=1)), photo, scan, ["c1", "c2"], str(out), usage)
    assert results["c1"]["status"] == "failed" and results["c2"]["status"] == "generated"
    assert [c["ok"] for c in usage.calls] == [False, True]
    assert usage.usd == pytest.approx(outfit.IMAGE_USD_PER_IMAGE + 1000 / 1e6 * outfit.IMAGE_USD_PER_M_IN, abs=1e-4)


async def test_detect_candidates_parses_the_model_json(tmp_path):
    photo = tmp_path / "photo.jpg"
    cv2.imwrite(str(photo), np.full((400, 300, 3), 128, np.uint8))

    class Models:
        async def generate_content(self, model, contents, config=None):
            return SimpleNamespace(text=json.dumps(_scan(_cand([100, 100, 600, 900]))),
                                   usage_metadata=SimpleNamespace(prompt_token_count=1500, candidates_token_count=400))
    usage = outfit.Usage()
    scan = await outfit.detect_candidates(_client(Models()), str(photo), usage)
    assert [c.id for c in scan.candidates] == ["c1"]
    assert usage.calls[0]["kind"] == "detect" and usage.usd == pytest.approx(1500 / 1e6 * 0.25 + 400 / 1e6 * 1.5, abs=1e-5)


def test_poc_report_and_selection_work_offline(tmp_path, monkeypatch):
    from scripts import outfit_poc
    root = tmp_path / "poc"
    monkeypatch.setattr(outfit_poc, "ROOT", str(root))
    monkeypatch.setattr(outfit_poc, "PHOTOS", str(root / "photos"))
    monkeypatch.setattr(outfit_poc, "OUT", str(root / "out"))
    monkeypatch.setattr(outfit_poc, "MANIFEST", str(root / "manifest.json"))
    (root / "photos").mkdir(parents=True)
    cv2.imwrite(str(root / "photos" / "p1.jpg"), np.full((100, 80, 3), 128, np.uint8))
    scan = outfit.parse_scan(_scan(_cand([0, 0, 500, 900], "jacket"), _cand([500, 0, 1000, 900], "jeans")), 80, 100)
    outfit_poc._save(str(root / "out" / "p1" / "scan.json"), scan.model_dump())
    assert outfit_poc._selection("all", "p1", scan) == ["c1", "c2"]
    assert outfit_poc._selection("p1:c2;p2:c1", "p1", scan) == ["c2"]
    assert outfit_poc._selection("p2:c1", "p1", scan) == []
    outfit_poc.cmd_report(SimpleNamespace(only=None))
    page = (root / "report.html").read_text()
    assert "c1 · jacket" in page and "c2 · jeans" in page


def test_poc_budget_stops_before_overspending():
    from scripts.outfit_poc import Budget
    usage = outfit.Usage()
    usage.add("generate", "m", 1.0, 0.04, True)
    Budget(0.1, usage).check(0.05)
    with pytest.raises(SystemExit):
        Budget(0.08, usage).check(0.05)


def test_whiten_bars_paints_letterbox_bars_white_and_keeps_the_garment(tmp_path):
    img = np.full((100, 120, 3), 255, np.uint8)
    img[:, :15] = 0
    img[:, -15:] = 0
    img[30:70, 40:80] = (20, 20, 20)  # a black garment in the middle must stay
    path = str(tmp_path / "g.png")
    cv2.imwrite(path, img)
    assert outfit.whiten_bars(path)
    out = cv2.imread(path)
    assert out[:, :15].min() == 255 and out[:, -15:].min() == 255
    assert out[50, 60].max() == 20
    assert not outfit.whiten_bars(path)  # nothing left to fix


# --- bounded concurrency (at most 2 image calls at once) -------------------------------------------

class _SlowModels:
    """Image calls that take a little while, so overlap is measurable. Records the most calls in flight,
    the candidate each call was for (from its crop path) and the prompt it used; fail_ids always fail."""
    def __init__(self, fail_ids=(), delays=None):
        self.in_flight = self.most = 0
        self.calls, self.fail_ids, self.delays = [], set(fail_ids), delays or {}

    async def generate_content(self, model, contents, config=None):
        import asyncio
        crop = next(p for p in contents if isinstance(p, dict))
        cid = self._cid_of(crop)
        self.calls.append((cid, contents[-1]))
        self.in_flight += 1
        self.most = max(self.most, self.in_flight)
        try:
            await asyncio.sleep(self.delays.get(cid, 0.02))
            if cid in self.fail_ids:
                raise RuntimeError("model refused")
            ok, png = cv2.imencode(".png", np.full((64, 64, 3), 255, np.uint8))
            part = SimpleNamespace(inline_data=SimpleNamespace(data=png.tobytes()))
            return SimpleNamespace(candidates=[SimpleNamespace(content=SimpleNamespace(parts=[part]))],
                                   usage_metadata=SimpleNamespace(prompt_token_count=10, candidates_token_count=0))
        finally:
            self.in_flight -= 1

    crops: dict = {}

    def _cid_of(self, part):
        return self.crops[part["inline_data"]["data"]]


@pytest.fixture
def four(tmp_path, monkeypatch):
    """Four candidates, each with a distinct crop (so a fake call can tell which one it is for)."""
    async def passing(crop, generated, facts, attempt):
        return VerificationResult(status="pass", violations=[], attempt=attempt)
    monkeypatch.setattr(outfit.stage5_verify, "run", passing)
    monkeypatch.setattr(outfit.cutout, "run", lambda src, dst: None)
    photo = tmp_path / "photo.jpg"
    image = np.zeros((1000, 800, 3), np.uint8)
    for i, shade in enumerate((40, 90, 140, 190)):
        image[i * 250:(i + 1) * 250] = shade
    cv2.imwrite(str(photo), image)
    scan = outfit.parse_scan(_scan(*[_cand([i * 250 + 20, 100, i * 250 + 230, 700], cat)
                                     for i, cat in enumerate(("jacket", "t-shirt", "jeans", "sneakers"))]), 800, 1000)
    return str(photo), scan, tmp_path / "out"


def _models_for(out, scan, **kw):
    models = _SlowModels(**kw)

    class Lookup(dict):
        def __missing__(self, data):
            for c in scan.candidates:
                path = out / c.id / "crop.png"
                if path.exists() and path.read_bytes() == data:
                    return c.id
            raise KeyError("unknown crop")
    models.crops = Lookup()
    return models


async def test_at_most_two_image_calls_run_at_once_and_results_keep_the_pick_order(four):
    photo, scan, out = four
    models = _models_for(out, scan, delays={"c1": 0.08, "c2": 0.01, "c3": 0.03, "c4": 0.01})
    usage = outfit.Usage()
    results = await outfit.generate_selected(_client(models), photo, scan, ["c3", "c1", "c4", "c2"], str(out), usage)
    assert models.most == 2  # overlapped, never more than two
    assert list(results) == ["c3", "c1", "c4", "c2"]  # the caller's order, not the finishing order
    assert all(r["status"] == "generated" for r in results.values())
    assert sorted(cid for cid, _ in models.calls) == ["c1", "c2", "c3", "c4"]  # one call each, no duplicates
    for cid in ("c1", "c2", "c3", "c4"):  # each candidate wrote only its own folder
        assert (out / cid / "generated.png").exists() and (out / cid / "crop.png").exists()
    assert len(usage.calls) == 4


async def test_concurrency_one_runs_them_one_at_a_time(four, monkeypatch):
    photo, scan, out = four
    models = _models_for(out, scan)
    monkeypatch.setenv("WARDROBE_OUTFIT_CONCURRENCY", "1")
    await outfit.generate_selected(_client(models), photo, scan, ["c1", "c2", "c3"], str(out), outfit.Usage())
    assert models.most == 1


@pytest.mark.parametrize("value,expected", [("", 2), ("1", 1), ("2", 2), ("8", 2), ("0", 1), ("lots", 2)])
def test_the_concurrency_setting_is_clamped_to_one_or_two(monkeypatch, value, expected):
    monkeypatch.setenv("WARDROBE_OUTFIT_CONCURRENCY", value)
    assert outfit.image_concurrency() == expected


async def test_a_failed_pick_is_reported_alone_and_progress_separates_processed_from_made(four):
    photo, scan, out = four
    models = _models_for(out, scan, fail_ids={"c2"})
    seen = []
    results = await outfit.generate_selected(_client(models), photo, scan, ["c1", "c2", "c3"], str(out), outfit.Usage(),
                                             on_progress=lambda done, total, made: seen.append((done, total, made)))
    assert [results[c]["status"] for c in ("c1", "c2", "c3")] == ["generated", "failed", "generated"]
    assert not (out / "c2" / "generated.png").exists()
    assert seen[0] == (0, 3, 0) and seen[-1] == (3, 3, 2)
    assert [d for d, _, _ in seen] == [0, 1, 2, 3]  # one report per finished pick
    assert sum(cid == "c2" for cid, _ in models.calls) == 1  # a model error is not retried (as before)


async def test_each_pick_keeps_its_own_retry_with_its_own_violations(four, monkeypatch):
    photo, scan, out = four
    attempts = {}

    async def verify(crop, generated, facts, attempt):
        cid = os.path.basename(os.path.dirname(generated))
        attempts.setdefault(cid, []).append(attempt)
        if cid == "c1" and attempt == 1:
            return VerificationResult(status="fail", violations=["color shift detected (Lab distance 31.0)"], attempt=attempt)
        return VerificationResult(status="pass", violations=[], attempt=attempt)
    monkeypatch.setattr(outfit.stage5_verify, "run", verify)
    models = _models_for(out, scan)
    results = await outfit.generate_selected(_client(models), photo, scan, ["c1", "c2"], str(out), outfit.Usage())
    assert attempts == {"c1": [1, 2], "c2": [1]}
    assert results["c1"]["attempts"] == 2 and results["c2"]["attempts"] == 1
    prompts = [p for cid, p in models.calls if cid == "c1"]
    assert "color shift" not in prompts[0] and "color shift" in prompts[1]  # only c1's retry carries c1's violation
    assert all("color shift" not in p for cid, p in models.calls if cid == "c2")
    assert models.most <= 2


async def test_worn_shoes_keep_their_own_prompt_when_run_side_by_side(four):
    photo, scan, out = four
    models = _models_for(out, scan)
    await outfit.generate_selected(_client(models), photo, scan, ["c1", "c4"], str(out), outfit.Usage())
    shoe = _read_prompt(outfit.FOOTWEAR_GENERATE_PROMPT).split("{")[0][:60]
    garment = _read_prompt(outfit.GENERATE_PROMPT).split("{")[0][:60]
    by_id = dict(models.calls)
    assert by_id["c4"].startswith(shoe) and by_id["c1"].startswith(garment)


async def test_an_unreadable_photo_is_refused_before_any_paid_call(four, tmp_path):
    _, scan, out = four
    models = _models_for(out, scan)
    with pytest.raises(ValueError):
        await outfit.generate_selected(_client(models), str(tmp_path / "missing.jpg"), scan, ["c1", "c2"], str(out), outfit.Usage())
    assert models.calls == []


async def test_an_unexpected_error_stops_the_other_picks(four, monkeypatch):
    photo, scan, out = four
    models = _models_for(out, scan, delays={"c1": 0.01, "c2": 0.2, "c3": 0.2})

    def broken_cutout(src, dst):
        if "/c1/" in src:
            raise OSError("disk full")
    monkeypatch.setattr(outfit.cutout, "run", broken_cutout)
    with pytest.raises(OSError):
        await outfit.generate_selected(_client(models), photo, scan, ["c1", "c2", "c3"], str(out), outfit.Usage())
    # The slow picks were cancelled mid-call: nothing of theirs was saved and no call is still running.
    assert models.in_flight == 0
    assert not (out / "c2" / "generated.png").exists() and not (out / "c3" / "generated.png").exists()
