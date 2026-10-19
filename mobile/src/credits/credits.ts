// AI Credits wording and arithmetic shared by Account, capture, + Back and 360. No prices live here:
// they always come from the server (GET /v1/prices).
import type { CreditAction, CreditEntry, Credits } from "../api/types";

export const MAX_FRONTS = 20;  // the server's limit for max_fronts
export const ASK_FOR_MORE = "Ask the app owner for more credits.";
export const BILLING_OFF = "Billing is off — AI actions don't use credits yet.";

export const ACTION_LABELS: Record<CreditAction, string> = {
  garment: "Front image",
  back: "Back image",
  turn: "360 view",
};

export const creditsLabel = (n: number) => (n === 1 ? "1 credit" : `${n} credits`);

// The most front images the user can approve for one photo: what they can afford, up to the server's cap.
export function affordableFronts(available: number, price: number): number {
  if (price <= 0) return MAX_FRONTS;
  return Math.max(0, Math.min(MAX_FRONTS, Math.floor(available / price)));
}

// Whether the user can pay for one action right now. Billing off or no price: always.
export function canAfford(credits: Credits | null, price: number | undefined): boolean {
  if (!price) return true;
  return (credits?.available ?? 0) >= price;
}

// Activity shows what changed the balance: grants in, charges out. Holds and releases are bookkeeping.
export function visibleEntries(entries: CreditEntry[]): CreditEntry[] {
  return entries.filter((e) => e.kind === "grant" || e.kind === "charge");
}

export function entryLabel(entry: CreditEntry): string {
  if (entry.kind === "grant") return entry.note || "Credits added";
  return entry.action ? ACTION_LABELS[entry.action] : "AI action";
}

export const entrySign = (entry: CreditEntry) => (entry.kind === "grant" ? `+${entry.amount}` : `−${entry.amount}`);

export type QuoteLine = { label: string; action: CreditAction; count: number };
export type Quote = { lines: { label: string; credits: number }[]; total: number; after: number | null; affordable: boolean };

// What a set of AI actions will cost at the server's prices, and the balance left afterwards
// (null while the balance isn't known). An action without a price costs nothing.
export function quote(lines: QuoteLine[], prices: Partial<Record<CreditAction, number>>, available: number | null): Quote {
  const priced = lines.map((l) => ({ label: `${l.label} × ${l.count}`, credits: (prices[l.action] ?? 0) * l.count }));
  const total = priced.reduce((sum, l) => sum + l.credits, 0);
  const after = available === null ? null : available - total;
  return { lines: priced, total, after, affordable: total === 0 || (after !== null && after >= 0) };
}
