from typing import Protocol, runtime_checkable
from pipeline.types import DetectedItemWithFacts, ItemFacts


@runtime_checkable
class VisionProvider(Protocol):
    async def detect_items_with_facts(self, image_path: str) -> list[DetectedItemWithFacts]: ...


@runtime_checkable
class ImageGenProvider(Protocol):
    async def generate(self, crop_path: str, facts: ItemFacts, violations: list[str] | None) -> str: ...
