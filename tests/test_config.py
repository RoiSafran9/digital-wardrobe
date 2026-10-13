import pytest
from pipeline.config import require_env


def test_require_env_missing(monkeypatch):
    monkeypatch.delenv("DOES_NOT_EXIST", raising=False)
    with pytest.raises(RuntimeError, match="missing env var: DOES_NOT_EXIST"):
        require_env("DOES_NOT_EXIST")


def test_require_env_present(monkeypatch):
    monkeypatch.setenv("SOME_VAR", "value")
    assert require_env("SOME_VAR") == "value"
