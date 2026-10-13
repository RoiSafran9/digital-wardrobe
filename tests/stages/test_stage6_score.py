from pipeline.stages.stage6_score import run
from pipeline.types import VerificationResult

def test_high_tier_when_verified_and_high_visible_fraction():
    v = VerificationResult(status="pass", violations=[], attempt=1)
    result = run(v, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "high"

def test_medium_tier_when_low_visible_fraction_but_verified():
    v = VerificationResult(status="pass", violations=[], attempt=1)
    result = run(v, visible_fraction=0.4, max_attempts=2)
    assert result.tier == "medium"
    assert "overlapping" in result.reason.lower() or "visible" in result.reason.lower()

def test_low_tier_when_verification_failed_after_all_retries():
    v = VerificationResult(status="fail", violations=["color shift"], attempt=3)
    result = run(v, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "low"
    assert result.retake_instruction is not None

def test_low_tier_when_no_verification_at_all():
    result = run(None, visible_fraction=0.95, max_attempts=2)
    assert result.tier == "low"
    assert result.retake_instruction is not None
