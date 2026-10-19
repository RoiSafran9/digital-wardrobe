import type { ClosetItem } from "./api/types";
import { groupOf } from "./categoryGroups";
import { garmentName } from "./garmentName";
import { asList, COLOR_NAMES } from "./theme";

export const ALL = "All";
export type ClosetFilters = { group: string; color: string; query: string };

function haystack(item: ClosetItem): string {
  const f = item.facts;
  return [garmentName(item), groupOf(item), ...asList(f.category.value), ...asList(f.colors.value),
    ...asList(f.pattern.value), ...asList(f.trims.value), ...asList(f.visible_text.value)].join(" ").toLowerCase();
}

// Closet search and filters, all on the phone: group chip, color swatch and free text over name,
// category, group, colors, pattern, details and printed text.
export function filterCloset<T extends ClosetItem>(items: T[], { group, color, query }: ClosetFilters): T[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) =>
    (group === ALL || groupOf(item) === group)
    && (color === ALL || asList(item.facts.colors.value).some((c) => c.toLowerCase() === color.toLowerCase()))
    && (!q || haystack(item).includes(q)));
}

// The garment colors in the closet, in the vocabulary's order (unknown names last).
export function colorsPresent(items: ClosetItem[]): string[] {
  const seen = new Set(items.flatMap((i) => asList(i.facts.colors.value).map((c) => c.trim().toLowerCase())));
  const known = COLOR_NAMES.filter((c) => seen.has(c));
  return [...known, ...[...seen].filter((c) => !COLOR_NAMES.includes(c)).sort()];
}
