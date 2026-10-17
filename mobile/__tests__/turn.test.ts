import { dragPosition, opacityFor, snap, wrap, STEP_PX } from "../src/turn";

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

test("neighbouring views crossfade by drag progress, across the wrap", () => {
  expect(opacityFor(0, 0, 4)).toBe(1);
  expect(opacityFor(1, 0.25, 4)).toBeCloseTo(0.25);
  expect(opacityFor(0, 0.25, 4)).toBeCloseTo(0.75);
  expect(opacityFor(3, -0.5, 4)).toBeCloseTo(0.5);   // left of front is the last view
  expect(opacityFor(2, 0, 4)).toBe(0);
});
