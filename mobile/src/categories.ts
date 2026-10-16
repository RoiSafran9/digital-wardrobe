import type { ItemFacts } from "./api/types";
import { asList, capitalize } from "./theme";

// One normalization for every place that groups or filters by category.
export function categoryOf(item: { facts: ItemFacts }): string {
  const raw = (asList(item.facts.category.value)[0] ?? "").trim().toLowerCase();
  return raw ? capitalize(raw) : "Other";
}
