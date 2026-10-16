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
