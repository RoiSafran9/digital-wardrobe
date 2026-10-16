import { addedLabel, asList, capitalize, swatchFor, colors } from "../src/theme";

test("swatchFor maps known colors case-insensitively and falls back for unknown ones", () => {
  expect(swatchFor("Navy")).toBe("#26325A");
  expect(swatchFor("dusty pink")).toBe("#C9A0A0");
  expect(swatchFor("chartreuse")).toBe(colors.lineStrong);
});

test("asList normalizes single values and drops empty strings", () => {
  expect(asList("gray")).toEqual(["gray"]);
  expect(asList(["gray", "", "black"])).toEqual(["gray", "black"]);
  expect(asList("")).toEqual([]);
});

test("capitalize uppercases the first letter only", () => {
  expect(capitalize("t-shirt")).toBe("T-shirt");
  expect(capitalize("")).toBe("");
});

test("addedLabel reads the date from a run id", () => {
  expect(addedLabel("20261015-214623-803")).toBe("Added Oct 15");
  expect(addedLabel("20261003-000000")).toBe("Added Oct 3");
  expect(addedLabel("not-a-run")).toBeNull();
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS = [
  ["muted", "paper"], ["muted", "surface"], ["muted", "sunken"],
  ["inkSoft", "paper"], ["ink", "paper"], ["danger", "dangerBg"], ["paper", "ink"],
] as const;

describe.each(["light", "dark"] as const)("%s palette", (mode) => {
  const { palettes } = require("../src/theme");
  test.each(PAIRS)("%s text on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(contrast(palettes[mode][fg], palettes[mode][bg])).toBeGreaterThanOrEqual(4.5);
  });

  test.each(["high", "medium", "low"] as const)("%s tier badge is readable", (tier) => {
    const { tierPalettes } = require("../src/theme");
    const { fg, bg } = tierPalettes[mode][tier];
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

test("hitSlopFor grows small controls to Apple's 44pt minimum without resizing them", () => {
  const { hitSlopFor } = require("../src/theme");
  // Height only by default: pills are already wide, and sideways slop would overlap neighbours.
  expect(hitSlopFor(30)).toEqual({ top: 7, bottom: 7, left: 0, right: 0 });
  expect(hitSlopFor(34, 34)).toEqual({ top: 5, bottom: 5, left: 5, right: 5 });
  expect(hitSlopFor(50)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
});
