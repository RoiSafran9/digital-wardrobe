import pytest
from pipeline.stages.stage1_detect_facts import run, visible_fraction
from pipeline.types import DetectedItemWithFacts, BBox, FactField


def _item(included=True, visible_parts=None, occluded_parts=None, exclusion_reason=None):
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    return DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=1, height=1), included=included, exclusion_reason=exclusion_reason,
        category=field, colors=field, pattern=field, visible_text=text_field, trims=field,
        visible_parts=FactField(value=visible_parts or [], confidence=0.9, basis="observed"),
        occluded_parts=FactField(value=occluded_parts or [], confidence=0.9, basis="observed"),
    )


class FakeProvider:
    def __init__(self, items):
        self.items = items

    async def detect_items_with_facts(self, image_path):
        return self.items


@pytest.mark.asyncio
async def test_filters_excluded_items():
    items = [_item(True), _item(False, exclusion_reason="worn on feet")]
    result = await run("photo.jpg", FakeProvider(items))
    assert len(result) == 1
    assert result[0].included


@pytest.mark.asyncio
async def test_zero_items_returns_empty_list():
    result = await run("photo.jpg", FakeProvider([]))
    assert result == []


def test_visible_fraction_from_parts_ratio():
    item = _item(visible_parts=["front", "collar"], occluded_parts=["back"])
    assert visible_fraction(item) == pytest.approx(2 / 3)


def test_visible_fraction_defaults_to_full_when_no_parts_listed():
    item = _item(visible_parts=[], occluded_parts=[])
    assert visible_fraction(item) == 1.0
