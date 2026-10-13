from pipeline.types import ItemFacts
from pipeline.providers.base import VisionProvider


async def run(crop_path: str, context_path: str | None, provider: VisionProvider) -> ItemFacts:
    return await provider.extract_facts(crop_path, context_path)
