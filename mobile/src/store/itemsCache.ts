import type { ClosetItem } from "../api/types";

// The last closet the app fetched, so Home and Closet draw at once when the user comes back to them (and
// Closet's first visit shows what Home already loaded) while a fresh fetch runs. Kept in memory only and
// tagged with the account it belongs to: another account (or local mode) never sees it.
let last: { owner: string | null; items: ClosetItem[] } | null = null;

export function cachedItems(owner: string | null): ClosetItem[] | null {
  return last && last.owner === owner ? last.items : null;
}

export function rememberItems(owner: string | null, items: ClosetItem[]): void {
  last = { owner, items };
}

export function forgetItems(): void {
  last = null;
}
