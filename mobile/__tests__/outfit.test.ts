import { candidateTitle, defaultPicks, pickable, quote, sceneNote, visibilityNote } from "../src/outfit/outfit";
import type { OutfitCandidate, OutfitScan } from "../src/api/types";

const cand = (id: string, category: string, visibility: OutfitCandidate["visibility"] = "full"): OutfitCandidate => ({
  id, category, visibility, layer: "single", colors: ["blue"], pattern: "solid", visible_text: "", description: category,
  hidden_parts: [], uncertainty: "", preview_url: null,
});
const scan = (candidates: OutfitCandidate[], extra: Partial<OutfitScan> = {}): OutfitScan => ({
  id: "s1", status: "succeeded", error: null, scene_kind: "worn", person_count: 1, candidates, expires_at: null, ...extra,
});

test("shoes are not offered and mostly hidden garments start unselected", () => {
  const list = pickable(scan([cand("c1", "blazer"), cand("c2", "shirt", "low"), cand("c3", "trousers"), cand("c4", "shoes")]));
  expect(list.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  expect(defaultPicks(list)).toEqual(["c1", "c3"]);
});

test("notes are plain language", () => {
  expect(visibilityNote(cand("c1", "shirt", "low"))).toMatch(/mostly guessed/);
  expect(visibilityNote(cand("c1", "shirt", "partial"))).toMatch(/completed/);
  expect(visibilityNote(cand("c1", "shirt"))).toBeNull();
  expect(candidateTitle(cand("c1", "t-shirt"))).toBe("T-shirt");
  expect(sceneNote(scan([], { scene_kind: "flat" }))).toMatch(/Garment photo/);
  expect(sceneNote(scan([], { person_count: 2 }))).toMatch(/main person/);
  expect(sceneNote(scan([]))).toBeNull();
});

test("the quote uses the server's price and never invents one", () => {
  expect(quote(2, 1, 5)).toEqual({ count: 2, total: 2, affordable: true, label: "2 images · 2 credits · 5 available" });
  expect(quote(3, 2, 5).affordable).toBe(false);
  expect(quote(1, undefined, 0)).toEqual({ count: 1, total: null, affordable: true, label: "1 image · free while billing is off" });
});
