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


class ItemsResponse(BaseModel):
    items: list[ClosetItemOut]
