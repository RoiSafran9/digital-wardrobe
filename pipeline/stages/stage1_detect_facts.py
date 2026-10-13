from pipeline.types import DetectedItemWithFacts


async def run(image_path: str, provider) -> list[DetectedItemWithFacts]:
    items = await provider.detect_items_with_facts(image_path)
    return [item for item in items if item.included]


def visible_fraction(item: DetectedItemWithFacts) -> float:
    visible = len(item.visible_parts.value)
    occluded = len(item.occluded_parts.value)
    total = visible + occluded
    return visible / total if total else 1.0
