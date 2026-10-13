from pipeline.types import DetectedItem
from pipeline.providers.base import VisionProvider


async def run(image_path: str, provider: VisionProvider) -> list[DetectedItem]:
    items = await provider.detect_items(image_path)
    return [item for item in items if item.included]
