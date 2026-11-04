import type { ItemFacts } from "./api/types";
import { asList } from "./theme";

// Broad groups for chips, stats and Home's "Browse by category" (spec D4). The model's own word stays
// on the item; this only sorts it. Checked in order, so "t-shirt dress" is a dress and "shirt jacket"
// is outerwear. Shoes come first ("dress shoes", "fleece slippers"); their words are the server's
// (pipeline/footwear.py, kept in sync by tests/test_footwear.py).
export const CATEGORY_GROUPS = ["Tops", "Outerwear", "Bottoms", "Dresses", "Shoes", "Bags", "Accessories", "Other"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const SHOE_WORDS = [
  "footwear", "shoes", "shoe", "sneakers", "sneaker", "trainers", "trainer", "boots", "boot", "booties", "bootie",
  "sandals", "sandal", "loafers", "loafer", "heels", "heel", "pumps", "pump", "flats", "slippers", "slipper",
  "mules", "mule", "slides", "clogs", "clog", "flops", "espadrilles", "espadrille", "moccasins", "moccasin",
  "brogues", "brogue",
];

const WORDS: [CategoryGroup, string[]][] = [
  ["Shoes", SHOE_WORDS],
  ["Dresses", ["dress", "jumpsuit", "romper", "gown"]],
  ["Outerwear", ["jacket", "coat", "blazer", "cardigan", "vest", "parka", "gilet", "trench", "anorak", "windbreaker", "puffer", "fleece"]],
  ["Bags", ["bag", "tote", "backpack", "purse", "clutch", "handbag"]],
  ["Accessories", ["belt", "scarf", "hat", "cap", "beanie", "gloves", "tie", "socks"]],
  ["Bottoms", ["jeans", "pants", "trousers", "shorts", "skirt", "leggings", "chinos", "joggers", "sweatpants"]],
  ["Tops", ["shirt", "t", "tee", "blouse", "sweater", "hoodie", "tank", "top", "polo", "sweatshirt", "jumper", "pullover", "camisole", "overshirt", "turtleneck", "crop", "bodysuit"]],
];

export function groupFor(category: string): CategoryGroup {
  // "boot-cut jeans" are jeans: one word before splitting, so "boot" doesn't make them shoes.
  const tokens = category.toLowerCase().replace(/boot[\s_-]+cut/g, "bootcut").split(/[^a-z]+/).filter(Boolean);
  for (const [group, words] of WORDS) if (tokens.some((t) => words.includes(t))) return group;
  return "Other";
}

export function groupOf(item: { facts: ItemFacts }): CategoryGroup {
  return groupFor(asList(item.facts.category.value)[0] ?? "");
}
