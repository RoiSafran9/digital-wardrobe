import { closetStats } from "../src/closetStats";
import { categoryOf } from "../src/categories";

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (run: string, cat: string | string[], colors: string[]) => ({
  run_id: run, photo_name: "p", item_id: "item_0", tier: "high" as const,
  facts: { category: f(cat), colors: f(colors), pattern: f("solid"), visible_text: f(""), trims: f(""),
           visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "", generated_url: "",
});

test("categoryOf normalizes casing and whitespace, falls back to Other", () => {
  expect(categoryOf(item("20261016-1", "t-shirt ", []))).toBe("T-shirt");
  expect(categoryOf(item("20261016-1", ["shorts"], []))).toBe("Shorts");
  expect(categoryOf(item("20261016-1", "", []))).toBe("Other");
});

test("counts pieces, categories, colors and this week's additions", () => {
  const now = new Date(2026, 9, 16);
  const s = closetStats([
    item("20261016-100000", "t-shirt", ["gray", "black"]),
    item("20261015-100000", "T-shirt", ["Navy"]),
    item("20261001-100000", "shorts", ["navy"]),
  ], now);
  expect(s.pieces).toBe(3);
  expect(s.categories).toEqual([{ name: "T-shirt", count: 2 }, { name: "Shorts", count: 1 }]);
  expect(s.colors).toBe(3);           // gray, black, navy
  expect(s.addedThisWeek).toBe(2);
});

test("an empty closet is all zeros", () => {
  expect(closetStats([], new Date())).toEqual({ pieces: 0, categories: [], colors: 0, addedThisWeek: 0 });
});
