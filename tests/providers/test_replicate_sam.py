import numpy as np
import pytest
from unittest.mock import patch
from pipeline.types import BBox


@pytest.mark.asyncio
async def test_segment_computes_visible_fraction(monkeypatch, tmp_path):
    monkeypatch.setenv("REPLICATE_API_TOKEN", "fake-token")
    from pipeline.providers.replicate_sam import ReplicateSamProvider

    # fake mask: half the bbox area is foreground (255), half background (0)
    mask_path = tmp_path / "mask.png"
    import cv2
    mask = np.zeros((10, 10), dtype=np.uint8)
    mask[:5, :] = 255
    cv2.imwrite(str(mask_path), mask)

    img_path = tmp_path / "photo.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")

    with patch("pipeline.providers.replicate_sam.replicate.run") as mock_run:
        mock_run.return_value = [str(mask_path)]
        provider = ReplicateSamProvider()
        result = await provider.segment(str(img_path), BBox(x=0, y=0, width=10, height=10))

    assert 0.4 < result.visible_fraction < 0.6
    assert result.mask_path == str(mask_path)


@pytest.mark.asyncio
async def test_missing_token_raises(monkeypatch):
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    from pipeline.providers.replicate_sam import ReplicateSamProvider
    with pytest.raises(RuntimeError, match="missing env var: REPLICATE_API_TOKEN"):
        ReplicateSamProvider()
