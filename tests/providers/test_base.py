from pipeline.providers.base import VisionProvider, SegmentProvider, ImageGenProvider


class FakeVision:
    async def detect_items(self, image_path): return []
    async def extract_facts(self, crop_path, context_path): raise NotImplementedError
    async def judge(self, crop_path, generated_path, facts): return []


class FakeSegment:
    async def segment(self, image_path, box): raise NotImplementedError


class FakeImageGen:
    async def generate(self, crop_path, facts, violations): raise NotImplementedError


def test_fake_vision_satisfies_protocol():
    assert isinstance(FakeVision(), VisionProvider)


def test_fake_segment_satisfies_protocol():
    assert isinstance(FakeSegment(), SegmentProvider)


def test_fake_imagegen_satisfies_protocol():
    assert isinstance(FakeImageGen(), ImageGenProvider)
