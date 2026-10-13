import pytest
from pipeline.stages.stage1_detect import run
from pipeline.types import DetectedItem, BBox


class FakeProvider:
    def __init__(self, items):
        self.items = items
    async def detect_items(self, image_path):
        return self.items


@pytest.mark.asyncio
async def test_filters_excluded_items():
    items = [
        DetectedItem(box=BBox(x=0, y=0, width=1, height=1), category="t-shirt", included=True),
        DetectedItem(box=BBox(x=1, y=1, width=1, height=1), category="sandal",
                     included=False, exclusion_reason="worn on feet"),
    ]
    result = await run("photo.jpg", FakeProvider(items))
    assert len(result) == 1
    assert result[0].category == "t-shirt"


@pytest.mark.asyncio
async def test_zero_items_returns_empty_list():
    result = await run("photo.jpg", FakeProvider([]))
    assert result == []
