import { garmentName } from "../src/garmentName";
import { CATEGORY_GROUPS, groupOf } from "../src/categoryGroups";

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (cat: string, colors: string[], name?: string) => ({
  facts: { category: f(cat), colors: f(colors), pattern: f("solid"), visible_text: f(""), trims: f(""),
           visible_parts: f([]), occluded_parts: f([]), ...(name ? { name: f(name) } : {}) },
});

test("garmentName uses the user's name first", () => {
  expect(garmentName(item("shirt", ["white"], "Oxford Shirt"))).toBe("Oxford Shirt");
});

test("garmentName falls back to the first color and the category", () => {
  expect(garmentName(item("sweater", ["cream", "white"]))).toBe("Cream sweater");
  expect(garmentName(item("T-Shirt", ["dusty pink"]))).toBe("Dusty pink t-shirt");
  expect(garmentName(item("sweater", []))).toBe("Sweater");
  expect(garmentName(item("", []))).toBe("Garment");
});

test("groupOf maps the model's words to broad groups", () => {
  expect(groupOf(item("t-shirt", []))).toBe("Tops");
  expect(groupOf(item("Denim jacket", []))).toBe("Outerwear");
  expect(groupOf(item("jeans", []))).toBe("Bottoms");
  expect(groupOf(item("midi skirt", []))).toBe("Bottoms");
  expect(groupOf(item("dress", []))).toBe("Dresses");
  expect(groupOf(item("sneakers", []))).toBe("Shoes");
  expect(groupOf(item("tote bag", []))).toBe("Bags");
  expect(groupOf(item("belt", []))).toBe("Accessories");
  expect(groupOf(item("hoodie", []))).toBe("Tops");
  expect(groupOf(item("cardigan", []))).toBe("Outerwear");
  expect(groupOf(item("kimono", []))).toBe("Other");
  expect(groupOf(item("", []))).toBe("Other");
  expect(CATEGORY_GROUPS[CATEGORY_GROUPS.length - 1]).toBe("Other");
});
