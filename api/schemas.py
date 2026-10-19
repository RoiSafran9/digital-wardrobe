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
    name: str | None = None
    category: str | None = None
    colors: list[str] | None = None
    pattern: str | None = None
    trims: str | None = None
    visible_text: str | None = None


class JobProgress(BaseModel):
    done: int
    total: int


class ProfileOut(BaseModel):
    email: str | None = None
    display_name: str | None = None


class ProfileIn(BaseModel):
    display_name: str | None = None


class AccountDeleteIn(BaseModel):
    confirm: str | None = None


class JobOut(BaseModel):
    id: str
    kind: Literal["garment", "back", "turn", "outfit_scan", "outfit_generate"]
    status: Literal["queued", "running", "succeeded", "failed", "canceled"]
    error: str | None = None
    item_id: str | None = None
    item_ids: list[str] = []
    quality: QualityOut | None = None
    failed: list[str] = []
    cost_credits: int | None = None  # AI Credits one action of this job costs; None while billing is off
    max_fronts: int | None = None  # garment jobs with billing on: the fronts the user approved paying for
    over_limit: int = 0  # pieces found in the photo but not made because of max_fronts
    progress: JobProgress | None = None  # garment jobs: pieces finished so far, once detection is done


class PricesOut(BaseModel):
    billing: bool
    prices: dict[str, int]
    outfit: bool = False  # the Outfit Photo flow is on (WARDROBE_OUTFIT=on)


class CreditEntryOut(BaseModel):
    id: int
    kind: Literal["grant", "hold", "charge", "release"]
    amount: int  # always positive; kind says which way it moved
    action: Literal["garment", "back", "turn"] | None = None
    job_id: str | None = None
    note: str | None = None  # a grant's reason
    created_at: str


class CreditsOut(BaseModel):
    """The signed-in user's AI Credits: available = balance - held (held = reserved for running jobs)."""
    balance: int
    held: int
    available: int
    granted: int  # every credit ever granted; with used, an honest "used X of Y" baseline
    used: int  # every credit ever charged (= granted - balance)
    entries: list[CreditEntryOut]
    next_before: int | None = None  # pass as ?before= for older activity; None on the last page


class V1ItemOut(BaseModel):
    """A closet item in the multi-user API: same shape as ClosetItemOut, keyed by id, with signed image URLs."""
    id: str
    created_at: str
    tier: Literal["high", "medium", "low"]
    facts: ItemFacts
    crop_url: str
    generated_url: str
    cutout_url: str | None = None
    back: BackOut | None = None
    turn: TurnOut | None = None
    origin: Literal["garment_photo", "outfit_photo"] = "garment_photo"
    review_state: Literal["pending", "kept"] | None = None  # outfit results wait for the user's keep/discard


class V1ItemsResponse(BaseModel):
    items: list[V1ItemOut]


class OutfitCandidateOut(BaseModel):
    """One garment found on the person. Plain-language uncertainty, no numeric confidence."""
    id: str
    category: str
    layer: Literal["outer", "inner", "single"]
    visibility: Literal["full", "partial", "low"]
    colors: list[str]
    pattern: str
    visible_text: str
    description: str
    hidden_parts: list[str]
    uncertainty: str
    box: dict[str, float]  # pixels on the uploaded photo
    preview_url: str | None = None  # short-lived signed crop of the real photo


class OutfitScanOut(BaseModel):
    id: str
    status: Literal["queued", "running", "succeeded", "failed", "canceled"]
    error: str | None = None
    scene_kind: Literal["worn", "flat", "mixed", "none"] | None = None
    person_count: int | None = None
    candidates: list[OutfitCandidateOut] = []
    expires_at: str | None = None


class OutfitGenerateIn(BaseModel):
    """Stage 2: the garments the user picked and the per-front price they were shown (null while billing is off)."""
    candidate_ids: list[str]
    expected_unit_price: int | None = None
