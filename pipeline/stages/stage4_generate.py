from pipeline.types import ItemFacts
from pipeline.providers.base import ImageGenProvider


async def run(crop_path: str, facts: ItemFacts, violations: list[str] | None,
               provider: ImageGenProvider) -> str:
    return await provider.generate(crop_path, facts, violations)
