from typing import Literal
from pydantic import BaseModel
from pipeline.types import ItemFacts


class ClosetItemOut(BaseModel):
    run_id: str
    item_id: str
    tier: Literal["high", "medium", "low"]
    facts: ItemFacts
    crop_url: str
    generated_url: str
    cutout_url: str | None = None


class ItemsResponse(BaseModel):
    items: list[ClosetItemOut]


class QualityOut(BaseModel):
    status: Literal["ok", "retake"]
    reason: str | None = None


class RunItemOut(BaseModel):
    item_id: str
    tier: Literal["high", "medium", "low"]
    reason: str
    retake_instruction: str | None = None
    facts: ItemFacts
    crop_url: str
    generated_url: str
    cutout_url: str | None = None


class RunResponse(BaseModel):
    run_id: str
    quality: QualityOut
    items: list[RunItemOut]
    failed: list[str]


class ErrorResponse(BaseModel):
    error: str
