import { dragPosition, faceFor, flingTarget, offsetFrom, snap, wrap, MAX_FLING_VIEWS, STEP_PX } from "../src/turn";

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

test("the facing view is flat; the next one waits turned edge-on", () => {
  expect(faceFor(0, 0, 4)).toEqual({ rotateY: 0, opacity: 1 });
  expect(faceFor(1, 0, 4).rotateY).toBeCloseTo(90);
  expect(faceFor(1, 0, 4).opacity).toBe(0);
});

test("mid-turn the garment swings away and the next side swings in, swapping at halfway", () => {
  const leaving = faceFor(0, 0.4, 4);
  const coming = faceFor(1, 0.4, 4);
  expect(leaving.rotateY).toBeCloseTo(-36);
  expect(coming.rotateY).toBeCloseTo(54);
  expect(leaving.opacity).toBe(1);
  expect(coming.opacity).toBe(0);
  expect(faceFor(0, 0.6, 4).opacity).toBe(0);
  expect(faceFor(1, 0.6, 4).opacity).toBe(1);
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
