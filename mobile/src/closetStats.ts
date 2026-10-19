import type { ClosetItem } from "./api/types";
import { categoryOf } from "./categories";
import { CATEGORY_GROUPS, groupOf } from "./categoryGroups";
import { asList } from "./theme";

export type ClosetStats = {
  pieces: number;
  categories: { name: string; count: number }[];
  groups: { name: string; count: number }[];  // broad groups present, in CATEGORY_GROUPS order
  colors: number;
  addedThisWeek: number;
};

function runDate(runId: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(runId);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function closetStats(items: ClosetItem[], now: Date): ClosetStats {
  const counts = new Map<string, number>();
  const colors = new Set<string>();
  const groupCounts = new Map<string, number>();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  let addedThisWeek = 0;
  for (const item of items) {
    const name = categoryOf(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    const group = groupOf(item);
    groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
    asList(item.facts.colors.value).forEach((c) => colors.add(c.trim().toLowerCase()));
    const d = runDate(item.run_id);
    if (d && d > weekAgo && d <= now) addedThisWeek += 1;
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const groups = CATEGORY_GROUPS.filter((g) => groupCounts.has(g)).map((g) => ({ name: g as string, count: groupCounts.get(g)! }));
  return { pieces: items.length, categories, groups, colors: colors.size, addedThisWeek };
}
