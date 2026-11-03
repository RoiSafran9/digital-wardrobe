import React from "react";
import { Image } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import { API_BASE_URL } from "../src/api/client";
import type { ClosetItem, GarmentScan } from "../src/api/types";
import { groupFor, groupOf } from "../src/categoryGroups";
import { NO_SIDE_VIEWS, isFootwearItem, pieceLabel } from "../src/footwear";
import { ROUND_CAP, allPieces, defaultSelection, jobsFor, toggle, type RoundPhoto } from "../src/firstPieces/round";

const f = (value: string | string[]) => ({ value, confidence: 0.9, basis: "observed" as const });
const facts = (category: string, parts = ["pair (both shoes)", "toe"]) => ({
  category: f(category), colors: f(["white"]), pattern: f("solid"), visible_text: f(""),
  trims: f(""), visible_parts: f(parts), occluded_parts: f([]),
});

test.each(["sneakers", "trainers", "boots", "sandals", "loafers", "heels", "pumps", "flats", "slippers", "mules",
  "slides", "clogs", "flip-flops", "espadrilles", "moccasins", "brogues", "dress shoes", "fleece slippers", "ankle boots"])(
  "%s sort under Shoes", (category) => {
    expect(groupFor(category)).toBe("Shoes");
  });

test("lookalike words keep their own group", () => {
  expect(groupFor("boot-cut jeans")).toBe("Bottoms");
  expect(groupFor("bootcut jeans")).toBe("Bottoms");
  expect(groupFor("t-shirt dress")).toBe("Dresses");
  expect(groupFor("oxford shirt")).toBe("Tops");
  expect(groupFor("socks")).toBe("Accessories");
});

test("scan pieces say pair or single shoe; garments are named as before", () => {
  expect(pieceLabel({ category: "sneakers", colors: ["white"], shoes: "pair" })).toBe("White sneakers · pair");
  expect(pieceLabel({ category: "boots", colors: ["black"], shoes: "single" })).toBe("Black boots · single shoe");
  expect(pieceLabel({ category: "boots", colors: ["black"], shoes: null })).toBe("Black boots");
  expect(pieceLabel({ category: "hoodie", colors: ["gray"] })).toBe("Gray hoodie");
});

// --- First 3 Pieces: one pair is one pick ---------------------------------------------------------

const scan = (id: string, categories: string[]): GarmentScan => ({
  id, status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null,
  image: { width: 1000, height: 1000 }, expires_at: null,
  pieces: categories.map((category, index) => ({
    index, category, colors: ["white"], box: { x: 0, y: 0, width: 10 + index, height: 10 },
    shoes: groupFor(category) === "Shoes" ? "pair" as const : null,
  })),
});
const photo = (id: string, categories: string[]): RoundPhoto => ({ id, uri: `file:///${id}.jpg`, state: "found", scan: scan(`s-${id}`, categories) });

test("a pair of shoes and two garments are three picks in one job", () => {
  const pieces = allPieces([photo("a", ["t-shirt", "jeans", "sneakers"])]);
  expect(pieces).toHaveLength(3);
  const picked = defaultSelection(pieces);
  expect(picked).toEqual(["a:0", "a:1", "a:2"]);
  expect(jobsFor(picked, pieces)).toEqual([{ photoId: "a", scanId: "s-a", indexes: [0, 1, 2] }]);
});

test("pairs of shoes count once each toward the round cap", () => {
  const pieces = allPieces([photo("a", ["sneakers", "boots", "sandals"]), photo("b", ["loafers", "heels", "slippers"])]);
  const picked = defaultSelection(pieces);
  expect(picked).toHaveLength(ROUND_CAP);
  const sixth = pieces.map((p) => p.key).find((k) => !picked.includes(k))!;
  expect(toggle(picked, sixth).blocked).toBe(true);
});

// --- Item sheet: no Back/360 for shoes, earlier ones stay viewable ------------------------------------

const shoe: ClosetItem = {
  run_id: "20261103-104633-249", photo_name: "p", item_id: "item_0", tier: "high", facts: facts("sneakers"),
  crop_url: "/shoe/crop.png", generated_url: "/shoe/generated.png", cutout_url: "/shoe/cutout.png", back: null,
};

test("a shoe offers no Back or 360 action and says why", () => {
  expect(isFootwearItem(shoe)).toBe(true);
  render(<ItemSheet items={[shoe]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(screen.queryByRole("button", { name: "Add Back Image" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Generate 360/ })).toBeNull();
  expect(screen.queryByRole("tab", { name: "Back" })).toBeNull();
  expect(screen.queryByRole("tab", { name: "360°" })).toBeNull();
  expect(screen.getByText(NO_SIDE_VIEWS)).toBeTruthy();
  expect(screen.getByText(/Shoes · Sneakers/)).toBeTruthy();
});

test("a back made before stays viewable on a shoe", () => {
  const legacy: ClosetItem = { ...shoe, back: { generated_url: "/shoe/back.png", cutout_url: null, visible_text: "" } };
  render(<ItemSheet items={[legacy]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByRole("tab", { name: "Back" }));
  expect(screen.UNSAFE_getAllByType(Image)[0].props.source.uri).toBe(`${API_BASE_URL}/shoe/back.png`);
});

test("garments keep Back and 360", () => {
  const hoodie: ClosetItem = { ...shoe, facts: facts("hoodie", ["front"]) };
  expect(groupOf(hoodie)).toBe("Tops");
  render(<ItemSheet items={[hoodie]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(screen.getByRole("button", { name: "Add Back Image" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "360°" })).toBeTruthy();
  expect(screen.queryByText(NO_SIDE_VIEWS)).toBeNull();
});
