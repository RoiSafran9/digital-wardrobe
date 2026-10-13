from pipeline.types import DetectedItem, SegmentResult
from pipeline.providers.base import SegmentProvider


async def run(image_path: str, item: DetectedItem, provider: SegmentProvider) -> SegmentResult:
    return await provider.segment(image_path, item.box)
