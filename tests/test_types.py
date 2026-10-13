import pytest
from pydantic import ValidationError
from pipeline.types import (
    BBox, QualityCheckResult, DetectedItem, SegmentResult,
    FactField, ItemFacts, VerificationResult, ItemResult, RunLogEntry,
)


def test_quality_check_rejects_bad_status():
    with pytest.raises(ValidationError):
        QualityCheckResult(status="maybe")


def test_quality_check_ok():
    r = QualityCheckResult(status="ok")
    assert r.reason is None


def test_detected_item_roundtrip():
    item = DetectedItem(box=BBox(x=0, y=0, width=10, height=10), category="t-shirt", included=True)
    assert DetectedItem.model_validate(item.model_dump()) == item


def test_item_facts_fields():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    facts = ItemFacts(
        category=field, colors=field, pattern=field, visible_text=field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    assert facts.colors.basis == "observed"


def test_item_result_tier_literal():
    with pytest.raises(ValidationError):
        ItemResult(tier="super", reason="x", visible_fraction=1.0)


def test_run_log_entry_defaults():
    entry = RunLogEntry(stage="stage0", model="none", prompt_version="v1",
                         latency_ms=1.0, status="ok")
    assert entry.cost_usd is None and entry.error is None
