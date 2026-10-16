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
};

export type RunItem = {
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
};

export type BackView = {
  generated_url: string;
  cutout_url?: string | null;
  visible_text: string;
};

export type ClosetItem = {
  run_id: string;
  photo_name: string;
  item_id: string;
  tier: Tier;
  facts: ItemFacts;
  crop_url: string;
  generated_url: string;
  cutout_url?: string | null;
  back?: BackView | null;
};

export type ItemsResponse = {
  items: ClosetItem[];
};

export type ApiError = {
  error: string;
};

// Fields the user can edit; omitted fields stay as they are.
export type ItemPatch = {
  category?: string;
  colors?: string[];
  pattern?: string;
  trims?: string;
  visible_text?: string;
};
