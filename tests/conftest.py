import numpy as np
import pytest
from PIL import Image
from pipeline.stages import cutout


@pytest.fixture(autouse=True)
def fake_background_removal(monkeypatch):
    """Keep tests offline and fast: never load the real rembg model."""
    def keep_non_white(image):
        rgb = np.asarray(image.convert("RGB"))
        alpha = np.where(rgb.min(axis=2) < 250, 255, 0).astype(np.uint8)
        return Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    monkeypatch.setattr(cutout, "_remove", keep_non_white)
