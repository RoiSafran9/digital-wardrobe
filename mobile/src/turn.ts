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

// Turning between two photographed sides, smoothly: the side you're leaving stays fully opaque
// underneath while the next side fades in over it (so the garment never dims), and the whole
// garment leans and narrows a little mid-turn, as if turning toward its profile.
export const LEAN_DEG = 14;
export const SQUEEZE = 0.06;

export type Layers = { base: number; top: number; topOpacity: number; rotateY: number; scaleX: number };

export function layersFor(pos: number, n: number): Layers {
  const p = wrap(pos, n);
  const base = Math.floor(p) % n;
  const f = p - Math.floor(p);
  const swing = Math.sin(Math.PI * f);       // 0 on a side, 1 halfway between
  return {
    base,
    top: wrap(base + 1, n),
    topOpacity: f * f * (3 - 2 * f),         // smoothstep: eases in and out of each side
    rotateY: -LEAN_DEG * swing + 0,          // + 0: never -0
    scaleX: 1 - SQUEEZE * swing,
  };
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
