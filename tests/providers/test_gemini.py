import json
import pytest
from unittest.mock import MagicMock, patch


@pytest.mark.asyncio
async def test_detect_items_with_facts_parses_response(monkeypatch, tmp_path):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    img_path = tmp_path / "photo.jpg"
    img_path.write_bytes(b"\xff\xd8\xff\xe0fake")  # minimal jpeg-ish bytes, never decoded

    from pipeline.providers.gemini import GeminiProvider

    field = {"value": "pink", "confidence": 0.9, "basis": "observed"}
    fake_response = MagicMock()
    fake_response.text = json.dumps([{
        "box": {"x": 0, "y": 0, "width": 10, "height": 10}, "included": True, "exclusion_reason": None,
        "category": {"value": "t-shirt", "confidence": 0.9, "basis": "observed"},
        "colors": field, "pattern": field,
        "visible_text": {"value": "", "confidence": 0.9, "basis": "observed"},
        "trims": field,
        "visible_parts": {"value": ["front"], "confidence": 0.9, "basis": "observed"},
        "occluded_parts": {"value": [], "confidence": 0.9, "basis": "observed"},
    }])

    with patch("pipeline.providers.gemini.genai.Client") as MockClient:
        instance = MockClient.return_value
        instance.models.generate_content.return_value = fake_response
        provider = GeminiProvider()
        items = await provider.detect_items_with_facts(str(img_path))

    assert len(items) == 1
    assert items[0].category.value == "t-shirt"
    assert items[0].visible_parts.value == ["front"]


@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    from pipeline.providers.gemini import GeminiProvider
    with pytest.raises(RuntimeError, match="missing env var: GEMINI_API_KEY"):
        GeminiProvider()
