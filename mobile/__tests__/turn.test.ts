import { dragPosition, flingTarget, layersFor, offsetFrom, snap, wrap, LEAN_DEG, MAX_FLING_VIEWS, SQUEEZE, STEP_PX } from "../src/turn";

test("wrap keeps an index on the circle", () => {
  expect(wrap(4, 4)).toBe(0);
  expect(wrap(-1, 4)).toBe(3);
});

test("dragging left by one step turns to the next view", () => {
  expect(dragPosition(0, -STEP_PX)).toBe(1);
  expect(dragPosition(0, STEP_PX / 2)).toBe(-0.5);
});

test("snap rounds to the nearest view and wraps", () => {
  expect(snap(0.6, 4)).toBe(1);
  expect(snap(0.4, 4)).toBe(0);
  expect(snap(3.6, 4)).toBe(0);
  expect(snap(-0.6, 4)).toBe(3);
});

test("offset is a view's signed distance from the position, the short way round the circle", () => {
  expect(offsetFrom(1, 0.25, 4)).toBeCloseTo(0.75);
  expect(offsetFrom(0, 0.25, 4)).toBeCloseTo(-0.25);
  expect(offsetFrom(3, -0.25, 4)).toBeCloseTo(-0.75);   // left of front is the last view
  expect(offsetFrom(0, 3.75, 4)).toBeCloseTo(0.25);
});

test("at rest one side faces you, flat and full width", () => {
  expect(layersFor(0, 4)).toEqual({ base: 0, top: 1, topOpacity: 0, rotateY: 0, scaleX: 1 });
  expect(layersFor(2, 4)).toMatchObject({ base: 2, topOpacity: 0 });
});

test("mid-turn the next side fades in over the current one, which stays solid underneath", () => {
  // No moment where both are half-transparent: the base is always fully opaque.
  const half = layersFor(0.5, 4);
  expect(half).toMatchObject({ base: 0, top: 1 });
  expect(half.topOpacity).toBeCloseTo(0.5);
  expect(layersFor(0.25, 4).topOpacity).toBeGreaterThan(0);
  expect(layersFor(0.25, 4).topOpacity).toBeLessThan(0.5);
});

test("the fade is continuous across a side: just before it the next side is fully in", () => {
  expect(layersFor(0.999, 4).topOpacity).toBeGreaterThan(0.99);
  expect(layersFor(1, 4)).toMatchObject({ base: 1, topOpacity: 0 });
});

test("mid-turn the garment leans and narrows a little, as if turning; flat again on each side", () => {
  const half = layersFor(0.5, 4);
  expect(Math.abs(half.rotateY)).toBeCloseTo(LEAN_DEG);
  expect(half.scaleX).toBeCloseTo(1 - SQUEEZE);
  expect(layersFor(0.999, 4).rotateY).toBeCloseTo(0, 0);
  expect(LEAN_DEG).toBeLessThanOrEqual(20);           // a lean, not a card flip
});

test("layers wrap around the circle in both directions", () => {
  expect(layersFor(3.5, 4)).toMatchObject({ base: 3, top: 0 });
  const back = layersFor(-0.25, 4);
  expect(back).toMatchObject({ base: 3, top: 0 });
  expect(back.topOpacity).toBeGreaterThan(0.5);
});

test("a slow release settles on the nearest view", () => {
  expect(flingTarget(1.3, 0)).toBe(1);
  expect(flingTarget(1.6, -0.05)).toBe(2);
});

test("a fast flick keeps spinning past several views, but not forever", () => {
  expect(flingTarget(0, -1.5)).toBeGreaterThanOrEqual(2);   // flick left (vx < 0) turns forward
  expect(flingTarget(0, 1.5)).toBeLessThanOrEqual(-2);
  expect(flingTarget(0, -50)).toBe(MAX_FLING_VIEWS);
});
