import type { ClosetItem } from "./api/types";
import { categoryOf } from "./categories";
import { asList } from "./theme";

export type ClosetStats = {
  pieces: number;
  categories: { name: string; count: number }[];
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
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  let addedThisWeek = 0;
  for (const item of items) {
    const name = categoryOf(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    asList(item.facts.colors.value).forEach((c) => colors.add(c.trim().toLowerCase()));
    const d = runDate(item.run_id);
    if (d && d > weekAgo && d <= now) addedThisWeek += 1;
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { pieces: items.length, categories, colors: colors.size, addedThisWeek };
}
