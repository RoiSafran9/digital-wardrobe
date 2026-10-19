import type { ItemFacts } from "./api/types";
import { asList } from "./theme";

// Broad groups for chips, stats and Home's "Browse by category" (spec D4). The model's own word stays
// on the item; this only sorts it. Checked in order, so "t-shirt dress" is a dress and "shirt jacket"
// is outerwear.
export const CATEGORY_GROUPS = ["Tops", "Outerwear", "Bottoms", "Dresses", "Shoes", "Bags", "Accessories", "Other"] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

const WORDS: [CategoryGroup, string[]][] = [
  ["Dresses", ["dress", "jumpsuit", "romper", "gown"]],
  ["Outerwear", ["jacket", "coat", "blazer", "cardigan", "vest", "parka", "gilet", "trench", "anorak", "windbreaker", "puffer", "fleece"]],
  ["Shoes", ["sneakers", "sneaker", "boots", "boot", "shoes", "shoe", "sandals", "sandal", "loafers", "loafer", "heels", "flats", "slippers", "trainers"]],
  ["Bags", ["bag", "tote", "backpack", "purse", "clutch", "handbag"]],
  ["Accessories", ["belt", "scarf", "hat", "cap", "beanie", "gloves", "tie", "socks"]],
  ["Bottoms", ["jeans", "pants", "trousers", "shorts", "skirt", "leggings", "chinos", "joggers", "sweatpants"]],
  ["Tops", ["shirt", "t", "tee", "blouse", "sweater", "hoodie", "tank", "top", "polo", "sweatshirt", "jumper", "pullover", "camisole", "overshirt", "turtleneck", "crop", "bodysuit"]],
];

export function groupFor(category: string): CategoryGroup {
  const tokens = category.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const [group, words] of WORDS) if (tokens.some((t) => words.includes(t))) return group;
  return "Other";
}

export function groupOf(item: { facts: ItemFacts }): CategoryGroup {
  return groupFor(asList(item.facts.category.value)[0] ?? "");
}
