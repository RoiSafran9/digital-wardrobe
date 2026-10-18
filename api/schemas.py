from typing import Literal
from pydantic import BaseModel
from pipeline.types import ItemFacts


# Same closed vocabularies the detection prompt uses.
COLORS = {"black", "white", "gray", "navy", "blue", "red", "pink", "dusty pink", "mint", "green",
          "yellow", "orange", "purple", "brown", "beige"}
PATTERNS = {"solid", "striped", "floral", "graphic", "plaid", "polka-dot"}


class BackOut(BaseModel):
    generated_url: str
    cutout_url: str | None = None
    visible_text: str = ""


class TurnViewOut(BaseModel):
    angle: Literal["front", "right", "back", "left"]
    url: str
    cutout_url: str | None = None


class TurnOut(BaseModel):
    state: Literal["running", "done", "failed"]
    error: str | None = None
    views: list[TurnViewOut] = []


class ClosetItemOut(BaseModel):
    run_id: str
    photo_name: str
    item_id: str
    tier: Literal["high", "medium", "low"]
    facts: ItemFacts
    crop_url: str
    generated_url: str
    cutout_url: str | None = None
    back: BackOut | None = None
    turn: TurnOut | None = None


class ItemsResponse(BaseModel):
    items: list[ClosetItemOut]


class QualityOut(BaseModel):
    status: Literal["ok", "retake"]
    reason: str | None = None


class RunItemOut(BaseModel):
    item_id: str
    photo_name: str
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


class ItemPatch(BaseModel):
    """User edits to an item's facts; omitted fields stay as they are."""
    category: str | None = None
    colors: list[str] | None = None
    pattern: str | None = None
    trims: str | None = None
    visible_text: str | None = None


class JobOut(BaseModel):
    id: str
    kind: Literal["garment", "back", "turn"]
    status: Literal["queued", "running", "succeeded", "failed", "canceled"]
    error: str | None = None
    item_id: str | None = None
    item_ids: list[str] = []
    quality: QualityOut | None = None
    failed: list[str] = []
