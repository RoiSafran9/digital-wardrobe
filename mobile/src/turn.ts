// Turning a garment by dragging: one view per STEP_PX of horizontal drag, on a closed circle.
export const STEP_PX = 90;

export function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

// Dragging left (negative dx) turns the garment toward the next view.
export function dragPosition(start: number, dx: number): number {
  return start - dx / STEP_PX;
}

export function snap(pos: number, n: number): number {
  return wrap(Math.round(pos), n);
}

// Distance around the circle between a view and the current position; fully visible at 0,
// gone at 1 — so the two neighbours of the position crossfade.
export function opacityFor(view: number, pos: number, n: number): number {
  const d = Math.abs(wrap(pos, n) - view);
  return Math.max(0, 1 - Math.min(d, n - d));
}
