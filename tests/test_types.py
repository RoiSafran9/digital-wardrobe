import pytest
from pydantic import ValidationError
from pipeline.types import (
    BBox, QualityCheckResult, DetectedItemWithFacts, as_item_facts,
    FactField, ItemFacts, VerificationResult, ItemResult, RunLogEntry,
)


def test_quality_check_rejects_bad_status():
    with pytest.raises(ValidationError):
        QualityCheckResult(status="maybe")


def test_quality_check_ok():
    r = QualityCheckResult(status="ok")
    assert r.reason is None


def test_detected_item_with_facts_roundtrip():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    item = DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=10, height=10), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    assert DetectedItemWithFacts.model_validate(item.model_dump()) == item


def test_as_item_facts_extracts_facts_fields():
    field = FactField(value="pink", confidence=0.9, basis="observed")
    text_field = FactField(value="", confidence=0.9, basis="observed")
    item = DetectedItemWithFacts(
        box=BBox(x=0, y=0, width=10, height=10), included=True, exclusion_reason=None,
        category=field, colors=field, pattern=field, visible_text=text_field,
        trims=field, visible_parts=field, occluded_parts=field,
    )
    facts = as_item_facts(item)
    assert isinstance(facts, ItemFacts)
    assert facts.colors.value == "pink"


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
