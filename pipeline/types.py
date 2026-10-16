from typing import Literal
from pydantic import BaseModel


class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class QualityCheckResult(BaseModel):
    status: Literal["ok", "retake"]
    reason: Literal["blurry", "too_dark", "low_resolution"] | None = None


class FactField(BaseModel):
    value: str | list[str]
    confidence: float
    basis: Literal["observed", "inferred"]


class DetectionFields(BaseModel):
    included: bool
    exclusion_reason: str | None = None
    category: FactField
    colors: FactField
    pattern: FactField
    visible_text: FactField
    trims: FactField
    visible_parts: FactField
    occluded_parts: FactField


class DetectedItemWithFacts(DetectionFields):
    box: BBox


class ItemFacts(BaseModel):
    category: FactField
    colors: FactField
    pattern: FactField
    visible_text: FactField
    trims: FactField
    visible_parts: FactField
    occluded_parts: FactField


def as_item_facts(item: DetectedItemWithFacts) -> ItemFacts:
    return ItemFacts(category=item.category, colors=item.colors, pattern=item.pattern,
                      visible_text=item.visible_text, trims=item.trims,
                      visible_parts=item.visible_parts, occluded_parts=item.occluded_parts)


class VerificationResult(BaseModel):
    status: Literal["pass", "fail"]
    violations: list[str]
    attempt: int
    # Informational only: never fails the check or triggers regeneration.
    notes: list[str] = []


class ItemResult(BaseModel):
    tier: Literal["high", "medium", "low"]
    reason: str
    retake_instruction: str | None = None
    visible_fraction: float


class RunLogEntry(BaseModel):
    stage: str
    model: str
    prompt_version: str
    latency_ms: float
    cost_usd: float | None = None
    status: Literal["ok", "error"]
    error: str | None = None
