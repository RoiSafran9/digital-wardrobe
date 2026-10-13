import pytest
from pipeline.stages.stage2_segment import run
from pipeline.types import DetectedItem, BBox, SegmentResult


class FakeSegmentProvider:
    async def segment(self, image_path, box):
        return SegmentResult(mask_path="mask.png", crop_path="crop.png",
                              visible_fraction=0.8, occluded_by=[])


@pytest.mark.asyncio
async def test_segment_delegates_to_provider():
    item = DetectedItem(box=BBox(x=0, y=0, width=5, height=5), category="shirt", included=True)
    result = await run("photo.jpg", item, FakeSegmentProvider())
    assert result.visible_fraction == 0.8
    assert result.crop_path == "crop.png"
