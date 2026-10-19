import type { ItemFacts } from "./api/types";
import { asList, capitalize } from "./theme";

// What to call a piece: the user's name for it, else "<first color> <category>" ("Cream sweater").
export function garmentName(item: { facts: ItemFacts }): string {
  const given = item.facts.name ? asList(item.facts.name.value)[0]?.trim() : "";
  if (given) return given;
  const category = (asList(item.facts.category.value)[0] ?? "").trim().toLowerCase();
  const color = (asList(item.facts.colors.value)[0] ?? "").trim().toLowerCase();
  if (!category) return "Garment";
  return capitalize(color ? `${color} ${category}` : category);
}
