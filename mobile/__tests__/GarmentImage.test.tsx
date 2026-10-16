import React from "react";
import { Image } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { GarmentImage } from "../src/components/GarmentImage";
import { API_BASE_URL } from "../src/api/client";

const generated = "/images/r/p/item_0/generated.png";
const cutout = "/images/r/p/item_0/cutout.png";

test("shows the transparent cutout when the item has one", () => {
  render(<GarmentImage path={generated} cutoutPath={cutout} />);
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(`${API_BASE_URL}${cutout}`);
});

test("uses the white-background image when there is no cutout", () => {
  render(<GarmentImage path={generated} cutoutPath={null} />);
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(`${API_BASE_URL}${generated}`);
});

test("falls back to the white-background image if the cutout fails to load", () => {
  render(<GarmentImage path={generated} cutoutPath={cutout} />);
  fireEvent(screen.UNSAFE_getByType(Image), "error");
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(`${API_BASE_URL}${generated}`);
});

test("falls back to the photo crop for retake items that were never generated", () => {
  const crop = "/images/r/p/item_0/crop.png";
  render(<GarmentImage path={generated} cutoutPath={null} cropPath={crop} />);
  fireEvent(screen.UNSAFE_getByType(Image), "error");
  expect(screen.UNSAFE_getByType(Image).props.source.uri).toBe(`${API_BASE_URL}${crop}`);
});

test("a cutout floats on the page: no tile behind it", () => {
  render(<GarmentImage path={generated} cutoutPath={cutout} testID="garment" />);
  expect(screen.getByTestId("garment")).toHaveStyle({ backgroundColor: "transparent" });
});

test("non-cutout images keep a tile so their white background reads as intentional", () => {
  render(<GarmentImage path={generated} cutoutPath={null} testID="garment" />);
  expect(screen.getByTestId("garment")).not.toHaveStyle({ backgroundColor: "transparent" });
});
