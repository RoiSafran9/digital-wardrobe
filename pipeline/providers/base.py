from typing import Protocol, runtime_checkable
from pipeline.types import BBox, DetectedItem, SegmentResult, ItemFacts


@runtime_checkable
class VisionProvider(Protocol):
    async def detect_items(self, image_path: str) -> list[DetectedItem]: ...
    async def extract_facts(self, crop_path: str, context_path: str | None) -> ItemFacts: ...
    async def judge(self, crop_path: str, generated_path: str, facts: ItemFacts) -> list[str]: ...


@runtime_checkable
class SegmentProvider(Protocol):
    async def segment(self, image_path: str, box: BBox) -> SegmentResult: ...


@runtime_checkable
class ImageGenProvider(Protocol):
    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str: ...
