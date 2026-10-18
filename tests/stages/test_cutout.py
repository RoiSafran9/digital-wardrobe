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


def _shirt_with_gap(path, gap_color=(255, 255, 255)):
    # A dark garment whose outline encloses a wide gap (like the space between a sleeve and the
    # body), filled with `gap_color` in the generated image.
    img = np.full((200, 200, 3), 255, dtype=np.uint8)
    img[30:170, 30:170] = (40, 50, 90)
    img[80:120, 80:120] = gap_color
    Image.fromarray(img).save(path)


def _remove_like_rembg(image):
    # rembg clears near-white areas and zeroes the color of what it clears.
    rgb = np.asarray(image.convert("RGB")).copy()
    alpha = np.where(rgb.min(axis=2) < 230, 255, 0).astype(np.uint8)
    rgb[alpha == 0] = 0
    return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")


def test_background_showing_between_sleeve_and_body_stays_transparent(tmp_path, monkeypatch):
    monkeypatch.setattr(cutout, "_remove", _remove_like_rembg)
    src = tmp_path / "generated.png"
    _shirt_with_gap(src)

    out = cutout.run(str(src), str(tmp_path / "cutout.png"))

    result = np.asarray(Image.open(out))
    gap = result[result.shape[0] // 2, result.shape[1] // 2]
    assert gap[3] == 0, "the studio-white gap inside the outline was filled in"


def test_white_parts_of_the_garment_keep_their_own_color_not_black(tmp_path, monkeypatch):
    # A white panel inside the garment is off-white fabric, not the pure studio background: it
    # stays opaque, and in its real color (rembg had zeroed it to black).
    monkeypatch.setattr(cutout, "_remove", _remove_like_rembg)
    src = tmp_path / "generated.png"
    _shirt_with_gap(src, gap_color=(236, 236, 236))

    out = cutout.run(str(src), str(tmp_path / "cutout.png"))

    result = np.asarray(Image.open(out))
    panel = result[result.shape[0] // 2, result.shape[1] // 2]
    assert panel[3] == 255
    assert panel[:3].min() >= 230, f"filled area came out dark: {panel[:3]}"
