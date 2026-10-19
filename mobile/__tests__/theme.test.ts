import { addedLabel, asList, capitalize, swatchFor, colors } from "../src/theme";

test("swatchFor maps known colors case-insensitively and falls back for unknown ones", () => {
  expect(swatchFor("Navy")).toBe("#26325A");
  expect(swatchFor("dusty pink")).toBe("#C9A0A0");
  expect(swatchFor("chartreuse")).toBe(colors.separatorStrong);
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
  ["label", "background"], ["label", "card"], ["label", "tile"], ["label", "grouped"],
  ["secondaryLabel", "background"], ["secondaryLabel", "card"], ["secondaryLabel", "tile"], ["secondaryLabel", "grouped"],
  ["tint", "background"], ["tint", "card"], ["tint", "grouped"], ["tint", "tile"],
  ["destructive", "card"], ["destructive", "grouped"], ["destructive", "destructiveBg"],
  ["successText", "card"], ["successText", "grouped"],
  ["warningText", "card"], ["warningText", "grouped"],
  ["onTint", "tint"],
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

test("type scale follows the handoff on the system font", () => {
  const { type } = require("../src/theme");
  expect(type.largeTitle).toEqual({ fontSize: 34, fontWeight: "700", letterSpacing: -0.68 });
  expect(type.screenTitle).toEqual({ fontSize: 32, fontWeight: "700", letterSpacing: -0.64 });
  expect(type.section).toEqual({ fontSize: 22, fontWeight: "700" });
  expect(type.eyebrow).toEqual({ fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.65 });
  expect(type.stat).toEqual({ fontSize: 26, fontWeight: "600", fontVariant: ["tabular-nums"] });
  expect(type.body).toEqual({ fontSize: 17 });
  expect(type.footnote).toEqual({ fontSize: 13 });
});

test("editorial display type uses Instrument Serif at the handoff sizes", () => {
  const { type, DISPLAY_FONT } = require("../src/theme");
  expect(DISPLAY_FONT).toBe("InstrumentSerif_400Regular");
  expect(type.display(46)).toEqual({ fontFamily: "InstrumentSerif_400Regular", fontSize: 46, lineHeight: 54 });
  expect(type.display(40).fontSize).toBe(40);
});

test("radii and shadows follow the handoff", () => {
  const { radius, shadow } = require("../src/theme");
  expect(radius).toMatchObject({ segment: 8, input: 12, button: 14, primary: 16, list: 18, tile: 22, feature: 26, stage: 28, sheet: 34, pill: 999 });
  expect(shadow.tile).toMatchObject({ shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 15 });
  expect(shadow.sheet).toMatchObject({ shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.12, shadowRadius: 20 });
  expect(shadow.cutout).toMatchObject({ shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 5 });
});

test("tertiaryLabel is never used as a text color (it fails 4.5:1)", () => {
  const fs = require("fs");
  const path = require("path");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (/\.tsx$/.test(name) && /<Text[^>]*color: colors\.tertiaryLabel/s.test(fs.readFileSync(file, "utf8").replace(/<\/Text>/g, "\n"))) hits.push(file);
    }
  };
  walk(path.join(__dirname, "../app"));
  walk(path.join(__dirname, "../src"));
  expect(hits).toEqual([]);
});
