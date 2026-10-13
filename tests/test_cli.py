import pytest
from unittest.mock import patch, AsyncMock
from cli import main


def test_main_fails_fast_on_missing_key(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("REPLICATE_API_TOKEN", raising=False)
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    with pytest.raises(RuntimeError, match="missing env var"):
        main(str(photos_dir), str(tmp_path / "runs"))

def test_main_processes_each_photo(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setenv("REPLICATE_API_TOKEN", "k")
    photos_dir = tmp_path / "photos"
    photos_dir.mkdir()
    (photos_dir / "a.jpg").write_bytes(b"fake")
    (photos_dir / "b.jpg").write_bytes(b"fake")

    with patch("cli.build_providers") as mock_build, \
         patch("cli.run_photo", new_callable=AsyncMock) as mock_run:
        mock_build.return_value = object()
        mock_run.return_value = {"quality": None, "items": [], "failed": []}
        run_id = main(str(photos_dir), str(tmp_path / "runs"))

    assert mock_run.await_count == 2
    assert run_id
