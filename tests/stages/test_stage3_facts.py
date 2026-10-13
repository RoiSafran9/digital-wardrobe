import pytest
from pipeline.stages.stage3_facts import run
from pipeline.types import ItemFacts, FactField


class FakeProvider:
    async def extract_facts(self, crop_path, context_path):
        field = FactField(value="pink", confidence=0.9, basis="observed")
        return ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                          trims=field, visible_parts=field, occluded_parts=field)


@pytest.mark.asyncio
async def test_extract_facts_delegates_to_provider():
    result = await run("crop.png", None, FakeProvider())
    assert result.colors.value == "pink"
