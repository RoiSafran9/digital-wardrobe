import { colorsPresent, filterCloset } from "../src/closetFilter";

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, cat: string, colors: string[], extra: Record<string, string> = {}) => ({
  run_id: "r", photo_name: "p", item_id: id, tier: "high" as const, crop_url: "", generated_url: "",
  facts: { category: f(cat), colors: f(colors), pattern: f(extra.pattern ?? "solid"), visible_text: f(extra.text ?? ""),
           trims: f(extra.trims ?? ""), visible_parts: f([]), occluded_parts: f([]), ...(extra.name ? { name: f(extra.name) } : {}) },
});

const closet = [
  item("a", "sweater", ["beige"], { trims: "cable knit" }),
  item("b", "jeans", ["blue"]),
  item("c", "t-shirt", ["white", "navy"], { text: "PARIS", name: "Breton tee", pattern: "striped" }),
  item("d", "jacket", ["navy"]),
];
const ids = (xs: { item_id: string }[]) => xs.map((x) => x.item_id);
const ALL = { group: "All", color: "All", query: "" };

test("no filters → everything", () => expect(ids(filterCloset(closet, ALL))).toEqual(["a", "b", "c", "d"]));
test("query matches color, case-insensitively and trimmed", () => expect(ids(filterCloset(closet, { ...ALL, query: "  NAVY " }))).toEqual(["c", "d"]));
test("query matches printed text, details, name, pattern and group", () => {
  expect(ids(filterCloset(closet, { ...ALL, query: "paris" }))).toEqual(["c"]);
  expect(ids(filterCloset(closet, { ...ALL, query: "cable" }))).toEqual(["a"]);
  expect(ids(filterCloset(closet, { ...ALL, query: "breton" }))).toEqual(["c"]);
  expect(ids(filterCloset(closet, { ...ALL, query: "striped" }))).toEqual(["c"]);
  expect(ids(filterCloset(closet, { ...ALL, query: "outerwear" }))).toEqual(["d"]);
});
test("group and color combine", () => {
  expect(ids(filterCloset(closet, { ...ALL, group: "Tops", color: "navy" }))).toEqual(["c"]);
  expect(ids(filterCloset(closet, { ...ALL, group: "Bottoms", color: "navy" }))).toEqual([]);
});
test("colors present, in vocabulary order, without duplicates", () => {
  expect(colorsPresent(closet)).toEqual(["white", "navy", "blue", "beige"]);
});
test("a big closet filters fine", () => {
  const many = Array.from({ length: 200 }, (_, i) => item(String(i), i % 2 ? "jeans" : "shirt", ["blue"]));
  expect(filterCloset(many, { ...ALL, group: "Bottoms" })).toHaveLength(100);
});
