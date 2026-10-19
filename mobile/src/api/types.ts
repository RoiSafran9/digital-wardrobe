export type Tier = "high" | "medium" | "low";

export type FactField = {
  value: string | string[];
  confidence: number;
  basis: "observed" | "inferred";
};

export type ItemFacts = {
  category: FactField;
  colors: FactField;
  pattern: FactField;
  visible_text: FactField;
  trims: FactField;
  visible_parts: FactField;
  occluded_parts: FactField;
  name?: FactField | null;  // the user's name for the piece; the model never sets it
};

export type RunItem = {
  id?: string;  // set by the account API (/v1); local items are addressed by run/photo/item
  item_id: string;
  photo_name: string;
  tier: Tier;
  reason: string;
  retake_instruction: string | null;
  facts: ItemFacts;
  crop_url: string;
  generated_url: string;
  cutout_url?: string | null;
};

export type RunResponse = {
  run_id: string;
  quality: { status: "ok" | "retake"; reason: string | null };
  items: RunItem[];
  failed: string[];
  over_limit?: number;  // pieces in the photo not made because of the fronts the user approved (billing on)
};

// AI Credits (account mode). Prices and balances always come from the server.
export type CreditAction = "garment" | "back" | "turn";

export type CreditEntry = {
  id: number;
  kind: "grant" | "hold" | "charge" | "release";
  amount: number;
  action: CreditAction | null;
  job_id: string | null;
  note: string | null;
  created_at: string;
};

export type Credits = {
  balance: number;
  held: number;
  available: number;
  granted: number;
  used: number;
  entries: CreditEntry[];
  next_before: number | null;
};

// outfit: the server has the Outfit Photo flow switched on (WARDROBE_OUTFIT=on).
export type Prices = { billing: boolean; prices: Partial<Record<CreditAction, number>>; outfit?: boolean };

export type BackView = {
  generated_url: string;
  cutout_url?: string | null;
  visible_text: string;
};

export type TurnAngle = "front" | "right" | "back" | "left";

export type TurnViewOut = {
  angle: TurnAngle;
  url: string;
  cutout_url?: string | null;
};

// The 360 "on body" view: AI-generated ghost-mannequin angles, made on request.
export type Turn = {
  state: "running" | "done" | "failed";
  error: string | null;
  views: TurnViewOut[];
};

export type ClosetItem = {
  id?: string;  // set by the account API (/v1); local items are addressed by run/photo/item
  run_id: string;
  photo_name: string;
  item_id: string;
  tier: Tier;
  facts: ItemFacts;
  crop_url: string;
  generated_url: string;
  cutout_url?: string | null;
  back?: BackView | null;
  turn?: Turn | null;
  origin?: "garment_photo" | "outfit_photo";
  review_state?: "pending" | "kept" | null;  // outfit results wait for keep/discard
};

// Outfit Photo: a garment found on the person in the photo (Stage 1, free). preview_url is a crop of
// the real photo, not an AI image.
export type OutfitCandidate = {
  id: string;
  category: string;
  layer: "outer" | "inner" | "single";
  visibility: "full" | "partial" | "low";
  colors: string[];
  pattern: string;
  visible_text: string;
  description: string;
  hidden_parts: string[];
  uncertainty: string;
  preview_url: string | null;
};

export type OutfitScan = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  error: string | null;
  scene_kind: "worn" | "flat" | "mixed" | "none" | null;
  person_count: number | null;
  candidates: OutfitCandidate[];
  expires_at: string | null;
};

export type OutfitResult = { items: ClosetItem[]; failed: string[] };

export type ItemsResponse = {
  items: ClosetItem[];
};

export type ApiError = {
  error: string;
};

// Fields the user can edit; omitted fields stay as they are.
export type ItemPatch = {
  name?: string;
  category?: string;
  colors?: string[];
  pattern?: string;
  trims?: string;
  visible_text?: string;
};
