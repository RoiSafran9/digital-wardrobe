import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TabBar } from "../src/components/TabBar";

async function renderBar() {
  const props = {
    state: { index: 0, routes: [{ key: "i", name: "index" }, { key: "c", name: "closet" }, { key: "a", name: "add" }, { key: "m", name: "account" }] },
    emitter: { emit: jest.fn(() => ({ defaultPrevented: false })) },
    navigateToTab: jest.fn(),
    descriptors: {},
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
    onCamera: jest.fn(),
    onLooks: jest.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await render(<TabBar {...(props as any)} />);
  return props;
}

test("Home · Closet · camera · Looks · Me; Add is not a tab", async () => {
  await renderBar();
  expect(screen.getAllByRole("tab").map((t) => t.props.accessibilityLabel)).toEqual(["Home", "Closet", "Looks", "Me"]);
  expect(screen.getByRole("button", { name: "Add clothes" })).toBeTruthy();
});

test("the camera opens capture, Looks opens Build My Look, a tab navigates", async () => {
  const props = await renderBar();
  await fireEvent.press(screen.getByRole("button", { name: "Add clothes" }));
  expect(props.onCamera).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("tab", { name: "Looks" }));
  expect(props.onLooks).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("tab", { name: "Me" }));
  expect(props.navigateToTab).toHaveBeenCalledWith("m");
});
