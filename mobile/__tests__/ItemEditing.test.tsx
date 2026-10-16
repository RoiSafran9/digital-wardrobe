import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import { updateItem, deleteItem } from "../src/api/client";
import type { ClosetItem } from "../src/api/types";

jest.mock("../src/api/client", () => ({
  ...jest.requireActual("../src/api/client"),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
}));
const mockedUpdate = updateItem as jest.Mock;
const mockedDelete = deleteItem as jest.Mock;

const f = (value: string | string[]) => ({ value, confidence: 0.9, basis: "observed" as const });
const item: ClosetItem = {
  run_id: "20261016-104633-249", photo_name: "p", item_id: "item_0", tier: "high",
  facts: {
    category: f("jacket"), colors: f(["gray", "navy"]), pattern: f("solid"),
    visible_text: f("IETS FRANS"), trims: f("zip collar"), visible_parts: f(["front"]), occluded_parts: f(["back"]),
  },
  crop_url: "/c.png", generated_url: "/g.png",
};

beforeEach(() => jest.clearAllMocks());

test("no edit or remove controls without closet callbacks (read-only results view)", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.queryByLabelText("Edit")).toBeNull();
  expect(screen.queryByText("Remove from closet")).toBeNull();
});

test("editing saves only through the API and reports the updated item", async () => {
  const updated = { ...item, facts: { ...item.facts, category: f("fleece") } };
  mockedUpdate.mockResolvedValue(updated);
  const onUpdated = jest.fn();
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={onUpdated} onDeleted={() => {}} />);

  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Type"), "fleece");
  fireEvent.press(screen.getByLabelText("Color navy"));      // toggle navy off
  fireEvent.press(screen.getByRole("button", { name: "Striped" }));
  fireEvent.press(screen.getByText("Save"));

  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  expect(mockedUpdate).toHaveBeenCalledWith(item, {
    category: "fleece", colors: ["gray"], pattern: "striped", trims: "zip collar", visible_text: "IETS FRANS",
  });
  expect(screen.queryByText("Save")).toBeNull();  // back to view mode
});

test("cancel leaves the item untouched", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Type"), "something else");
  fireEvent.press(screen.getByText("Cancel"));
  expect(mockedUpdate).not.toHaveBeenCalled();
  expect(screen.getByText("Jacket")).toBeTruthy();
});

test("shows the server's error and stays in edit mode when saving fails", async () => {
  mockedUpdate.mockRejectedValue(new Error("category can't be empty"));
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.press(screen.getByText("Save"));
  expect(await screen.findByText("category can't be empty")).toBeTruthy();
  expect(screen.getByText("Save")).toBeTruthy();
});

test("removing asks for confirmation and deletes only after confirming", async () => {
  const alertSpy = jest.spyOn(Alert, "alert");
  mockedDelete.mockResolvedValue(undefined);
  const onDeleted = jest.fn();
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={onDeleted} />);

  fireEvent.press(screen.getByText("Remove from closet"));
  expect(alertSpy).toHaveBeenCalled();
  const buttons = alertSpy.mock.calls[0][2]!;
  expect(mockedDelete).not.toHaveBeenCalled();

  buttons.find((b) => b.style === "cancel")?.onPress?.();  // RN cancel buttons just dismiss
  expect(mockedDelete).not.toHaveBeenCalled();

  buttons.find((b) => b.style === "destructive")!.onPress!();
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(item));
  expect(mockedDelete).toHaveBeenCalledWith(item);
});
