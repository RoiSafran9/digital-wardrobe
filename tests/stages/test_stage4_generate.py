import pytest
from pipeline.stages.stage4_generate import run
from pipeline.types import ItemFacts, FactField


class FakeImageGen:
    async def generate(self, crop_path, facts, violations, complete_edges=False):
        return "generated.png"


@pytest.mark.asyncio
async def test_generate_delegates_to_provider():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                       trims=field, visible_parts=field, occluded_parts=field)
    path = await run("crop.png", facts, None, FakeImageGen())
    assert path == "generated.png"
