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

// A view's signed distance from the current position, the short way round the circle:
// 0 = facing us, +1 = next view (waiting on the right), -1 = previous one.
export function offsetFrom(view: number, pos: number, n: number): number {
  const d = wrap(view - pos, n);
  return d > n / 2 ? d - n : d;
}

// Like a turntable: the facing view swings away as the next swings in, each a quarter turn
// apart, and whichever is nearer facing us is the one shown — they swap at halfway.
export function faceFor(view: number, pos: number, n: number): { rotateY: number; opacity: number } {
  const d = offsetFrom(view, pos, n);
  return { rotateY: d * 90 + 0, opacity: Math.abs(d) < 0.5 ? 1 : 0 };
}

// How far a flick carries the spin: the release speed projected a moment ahead, capped.
export const MAX_FLING_VIEWS = 3;
const FLING_MS = 300;

// vx is the release speed in pt/ms (negative = moving left = turning forward). Returns the
// unwrapped position to settle on.
export function flingTarget(pos: number, vx: number): number {
  const carry = Math.max(-MAX_FLING_VIEWS, Math.min(MAX_FLING_VIEWS, (-vx * FLING_MS) / STEP_PX));
  return Math.round(pos + carry);
}
