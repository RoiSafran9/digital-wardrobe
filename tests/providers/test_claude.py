import json
import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_judge_returns_violations(monkeypatch, tmp_path):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key")
    crop_path = tmp_path / "crop.png"
    crop_path.write_bytes(b"\x89PNGfake")
    gen_path = tmp_path / "generated.png"
    gen_path.write_bytes(b"\x89PNGfake")

    from pipeline.providers.claude import ClaudeProvider
    from pipeline.types import ItemFacts, FactField

    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(category=field, colors=field, pattern=field, visible_text=field,
                       trims=field, visible_parts=field, occluded_parts=field)

    fake_message = MagicMock()
    fake_message.content = [MagicMock(text=json.dumps(["print text changed from PINK to PINKK"]))]

    with patch("pipeline.providers.claude.Anthropic") as MockClient:
        instance = MockClient.return_value
        instance.messages.create.return_value = fake_message
        provider = ClaudeProvider()
        violations = await provider.judge(str(crop_path), str(gen_path), facts)

    assert violations == ["print text changed from PINK to PINKK"]


@pytest.mark.asyncio
async def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    from pipeline.providers.claude import ClaudeProvider
    with pytest.raises(RuntimeError, match="missing env var: ANTHROPIC_API_KEY"):
        ClaudeProvider()
