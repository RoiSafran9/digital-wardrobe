import os
import numpy as np
from PIL import Image
from pipeline.stages import cutout


def _white_with_dark_square(path, size=200, box=(50, 60, 150, 140)):
    img = np.full((size, size, 3), 255, dtype=np.uint8)
    x0, y0, x1, y1 = box
    img[y0:y1, x0:x1] = (40, 50, 90)
    Image.fromarray(img).save(path)


def _fake_remove_keep_dark(image, session=None):
    # Stand-in for rembg: opaque where the pixel isn't white.
    rgb = np.asarray(image.convert("RGB"))
    alpha = np.where(rgb.min(axis=2) < 250, 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def test_writes_transparent_png_trimmed_to_the_garment(tmp_path, monkeypatch):
    monkeypatch.setattr(cutout, "_remove", _fake_remove_keep_dark)
    src = tmp_path / "generated.png"
    _white_with_dark_square(src)

    out = cutout.run(str(src), str(tmp_path / "cutout.png"))

    assert out == str(tmp_path / "cutout.png")
    result = Image.open(out)
    assert result.mode == "RGBA"
    alpha = np.asarray(result.getchannel("A"))
    assert alpha[0, 0] == 0  # corners transparent
    # trimmed close to the 100x80 garment, with only a small margin
    assert 100 <= result.width <= 112 and 80 <= result.height <= 92


def test_skips_when_cutout_keeps_almost_nothing(tmp_path, monkeypatch):
    monkeypatch.setattr(cutout, "_remove", lambda image, session=None: Image.new("RGBA", image.size, (0, 0, 0, 0)))
    src = tmp_path / "generated.png"
    _white_with_dark_square(src)

    assert cutout.run(str(src), str(tmp_path / "cutout.png")) is None
    assert not os.path.exists(tmp_path / "cutout.png")


def test_skips_when_background_was_not_removed(tmp_path, monkeypatch):
    monkeypatch.setattr(cutout, "_remove", lambda image, session=None: image.convert("RGBA"))
    src = tmp_path / "generated.png"
    _white_with_dark_square(src)

    assert cutout.run(str(src), str(tmp_path / "cutout.png")) is None


def test_never_raises_on_errors(tmp_path, monkeypatch):
    def boom(image, session=None):
        raise RuntimeError("model failed")
    monkeypatch.setattr(cutout, "_remove", boom)
    src = tmp_path / "generated.png"
    _white_with_dark_square(src)

    assert cutout.run(str(src), str(tmp_path / "cutout.png")) is None


def test_white_parts_inside_the_garment_stay_opaque(tmp_path, monkeypatch):
    # A navy shirt with white stripes on a white background: background removal also
    # clears the white stripes. They are inside the garment's outline, so they must stay.
    def remove_with_stripe_holes(image):
        h, w = 200, 200
        alpha = np.zeros((h, w), dtype=np.uint8)
        alpha[40:160, 50:150] = 255
        alpha[50:150:8, 52:148] = 0        # stripe holes inside the garment
        alpha[44:46, 50:150] = 0            # a stripe running out to the garment's edge
        rgb = np.full((h, w, 3), 255, dtype=np.uint8)
        rgb[40:160, 50:150] = (90, 40, 30)
        return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")

    monkeypatch.setattr(cutout, "_remove", remove_with_stripe_holes)
    src = tmp_path / "generated.png"
    _white_with_dark_square(src)

    out = cutout.run(str(src), str(tmp_path / "cutout.png"))

    alpha = np.asarray(Image.open(out).getchannel("A"))
    h, w = alpha.shape
    inner = alpha[h // 4: 3 * h // 4, w // 4: 3 * w // 4]
    assert inner.min() == 255, "stripes inside the garment were left transparent"
    assert alpha[0, 0] == 0 and alpha[-1, -1] == 0  # real background still removed
