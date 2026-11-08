// How the reminder learns the closet changed, without each add flow knowing about it:
// - every successful account-mode getItems() reports the saved count (src/api/client.ts);
// - each flow calls noteItemsSaved() once the server confirmed new pieces are saved (garment photo,
//   First 3 Pieces round, outfit review), which makes the reminder re-check the count when it has one
//   pending. Counts come only from the server's saved closet, never from scans, picks or pending jobs.
type Listener = { count?: (n: number) => void; saved?: () => void };
const listeners = new Set<Listener>();

export function subscribeCloset(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function reportSavedCount(count: number): void {
  for (const l of [...listeners]) {
    try { l.count?.(count); } catch { /* never break the caller */ }
  }
}

export function noteItemsSaved(): void {
  for (const l of [...listeners]) {
    try { l.saved?.(); } catch { /* never break the caller */ }
  }
}
