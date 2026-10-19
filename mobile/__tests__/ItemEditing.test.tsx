import React from "react";
import { Alert } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import { ToastProvider } from "../src/ui";
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
  fireEvent.press(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  expect(mockedUpdate).toHaveBeenCalledWith(item, {
    category: "fleece", colors: ["gray"], pattern: "striped", trims: "zip collar", visible_text: "IETS FRANS",
  });
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();  // back to view mode
});

test("a new name is saved with the other fields, and the save is confirmed", async () => {
  mockedUpdate.mockImplementation(async (it) => it);
  render(<ToastProvider><ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} /></ToastProvider>);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Name"), " Field jacket ");
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(item, expect.objectContaining({ name: "Field jacket" })));
  expect(await screen.findByText("Changes saved")).toBeTruthy();
});

test("a group shortcut fills the type", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.press(screen.getByRole("button", { name: "Bottoms" }));
  expect(screen.getByLabelText("Type").props.value).toBe("pants");
});

test("cancel leaves the item untouched", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.changeText(screen.getByLabelText("Type"), "something else");
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(mockedUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole("header", { name: "Gray jacket" })).toBeTruthy();
});

test("shows the server's error and stays in edit mode when saving fails", async () => {
  mockedUpdate.mockRejectedValue(new Error("category can't be empty"));
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("category can't be empty")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
});

test("removing asks for confirmation and deletes only after confirming", async () => {
  mockedDelete.mockResolvedValue(undefined);
  const onDeleted = jest.fn();
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={onDeleted} />);

  fireEvent.press(screen.getByRole("button", { name: "Remove from closet" }));
  expect(screen.getByText("Remove from closet?")).toBeTruthy();
  expect(screen.queryByText(/Credits used/)).toBeNull();  // billing off
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(mockedDelete).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole("button", { name: "Remove from closet" }));
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Remove" })));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(item));
  expect(mockedDelete).toHaveBeenCalledWith(item);
});

test("the edit control is labelled, not just an icon", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  expect(screen.getByText("Edit")).toBeTruthy();
});

describe("unsaved edits", () => {
  test("swipe-to-dismiss is on while viewing and off while editing", () => {
    const { UNSAFE_getByType } = render(
      <ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />
    );
    const { Modal } = require("react-native");
    expect(UNSAFE_getByType(Modal).props.allowSwipeDismissal).toBe(true);
    fireEvent.press(screen.getByLabelText("Edit"));
    expect(UNSAFE_getByType(Modal).props.allowSwipeDismissal).toBe(false);
  });

  test("closing while editing asks first; Keep editing stays, Discard closes", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const onClose = jest.fn();
    render(<ItemSheet items={[item]} index={0} onClose={onClose} onUpdated={() => {}} onDeleted={() => {}} />);
    fireEvent.press(screen.getByLabelText("Edit"));
    fireEvent.press(screen.getByLabelText("Close"));

    expect(alertSpy).toHaveBeenCalledWith("Discard changes?", expect.any(String), expect.any(Array));
    const buttons = alertSpy.mock.calls[0][2]!;
    buttons.find((b) => b.style === "cancel")?.onPress?.();
    expect(onClose).not.toHaveBeenCalled();
    buttons.find((b) => b.style === "destructive")!.onPress!();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("closing while just viewing doesn't ask", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const onClose = jest.fn();
    render(<ItemSheet items={[item]} index={0} onClose={onClose} onUpdated={() => {}} onDeleted={() => {}} />);
    fireEvent.press(screen.getByLabelText("Close"));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

test("saving confirms with a haptic", async () => {
  const { haptics } = require("../src/haptics");
  const spy = jest.spyOn(haptics, "success").mockImplementation(() => {});
  mockedUpdate.mockResolvedValue(item);
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.press(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(spy).toHaveBeenCalled());
});
