from pipeline.providers.base import VisionProvider, ImageGenProvider


class FakeVision:
    async def detect_items_with_facts(self, image_path): return []


class FakeImageGen:
    async def generate(self, crop_path, facts, violations): raise NotImplementedError
    async def generate_back(self, crop_path, front_image_path, facts, violations): raise NotImplementedError


def test_fake_vision_satisfies_protocol():
    assert isinstance(FakeVision(), VisionProvider)


def test_fake_imagegen_satisfies_protocol():
    assert isinstance(FakeImageGen(), ImageGenProvider)
