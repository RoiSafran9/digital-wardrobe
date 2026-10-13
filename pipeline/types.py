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


class DetectedItem(BaseModel):
    box: BBox
    category: str
    included: bool
    exclusion_reason: str | None = None


class SegmentResult(BaseModel):
    mask_path: str
    crop_path: str
    visible_fraction: float
    occluded_by: list[int] = []


class FactField(BaseModel):
    value: str | list[str]
    confidence: float
    basis: Literal["observed", "inferred"]


class ItemFacts(BaseModel):
    category: FactField
    colors: FactField
    pattern: FactField
    visible_text: FactField
    trims: FactField
    visible_parts: FactField
    occluded_parts: FactField


class VerificationResult(BaseModel):
    status: Literal["pass", "fail"]
    violations: list[str]
    attempt: int


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
