import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GarmentImage } from "../src/components/GarmentImage";
import { API_BASE_URL } from "../src/api/client";

const generated = "/images/r/p/item_0/generated.png";
const cutout = "/images/r/p/item_0/cutout.png";

// The one rendered image (host element).
const image = () => screen.container.queryAll((n) => n.type === "Image")[0];

test("shows the transparent cutout when the item has one", async () => {
  await render(<GarmentImage path={generated} cutoutPath={cutout} />);
  expect(image().props.source.uri).toBe(`${API_BASE_URL}${cutout}`);
});

test("uses the white-background image when there is no cutout", async () => {
  await render(<GarmentImage path={generated} cutoutPath={null} />);
  expect(image().props.source.uri).toBe(`${API_BASE_URL}${generated}`);
});

test("falls back to the white-background image if the cutout fails to load", async () => {
  await render(<GarmentImage path={generated} cutoutPath={cutout} />);
  await fireEvent(image(), "error");
  expect(image().props.source.uri).toBe(`${API_BASE_URL}${generated}`);
});

test("falls back to the photo crop for retake items that were never generated", async () => {
  const crop = "/images/r/p/item_0/crop.png";
  await render(<GarmentImage path={generated} cutoutPath={null} cropPath={crop} />);
  await fireEvent(image(), "error");
  expect(image().props.source.uri).toBe(`${API_BASE_URL}${crop}`);
});

test("a cutout floats on the page: no tile behind it", async () => {
  await render(<GarmentImage path={generated} cutoutPath={cutout} testID="garment" />);
  expect(screen.getByTestId("garment")).toHaveStyle({ backgroundColor: "transparent" });
});

test("non-cutout images keep a tile so their white background reads as intentional", async () => {
  await render(<GarmentImage path={generated} cutoutPath={null} testID="garment" />);
  expect(screen.getByTestId("garment")).not.toHaveStyle({ backgroundColor: "transparent" });
});
