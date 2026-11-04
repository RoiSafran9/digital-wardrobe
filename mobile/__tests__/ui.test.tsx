import React from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Button, Chip, GroupedList, ProgressBar, Row, Segmented, Sheet, Swatch, ToastProvider, useToast } from "../src/ui";
import { PopIn } from "../src/motion/PopIn";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test("Button calls onPress, and a disabled Button does not", async () => {
  const onPress = jest.fn();
  const { rerender } = await render(<Button title="Take Photo" onPress={onPress} />);
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  await rerender(<Button title="Take Photo" onPress={onPress} disabled />);
  await fireEvent.press(screen.getByRole("button", { name: "Take Photo" }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Take Photo" }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
});

test("a loading Button is disabled and says so", async () => {
  const onPress = jest.fn();
  await render(<Button title="Save" onPress={onPress} loading />);
  await fireEvent.press(screen.getByRole("button", { name: "Save" }));
  expect(onPress).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Save" }).props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
});

test("Sheet shows its content and closes from the backdrop", async () => {
  const onClose = jest.fn();
  await render(<Sheet visible onClose={onClose} title="Generate 4 garments"><Text>Body</Text></Sheet>);
  expect(screen.getByText("Generate 4 garments")).toBeTruthy();
  expect(screen.getByText("Body")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Close"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a hidden Sheet renders nothing", async () => {
  await render(<Sheet visible={false} onClose={() => {}}><Text>Body</Text></Sheet>);
  expect(screen.queryByText("Body")).toBeNull();
});

function ToastButton() {
  const { show } = useToast();
  return <Pressable onPress={() => show("Changes saved")}><Text>go</Text></Pressable>;
}

test("a toast shows its message, then goes away after 2.6s", async () => {
  jest.useFakeTimers();
  await render(<ToastProvider><ToastButton /></ToastProvider>);
  await fireEvent.press(screen.getByText("go"));
  expect(screen.getByText("Changes saved")).toBeTruthy();
  await act(() => { jest.advanceTimersByTime(2700); });
  expect(screen.queryByText("Changes saved")).toBeNull();
});

test("Segmented marks the selected option and reports changes", async () => {
  const onChange = jest.fn();
  await render(<Segmented options={[{ value: "front", label: "Front" }, { value: "back", label: "Back" }]} value="front" onChange={onChange} />);
  expect(screen.getByRole("tab", { name: "Front" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  expect(screen.getByRole("tab", { name: "Back" }).props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  await fireEvent.press(screen.getByRole("tab", { name: "Back" }));
  expect(onChange).toHaveBeenCalledWith("back");
});

test("Chip shows its count and selected state", async () => {
  const onPress = jest.fn();
  await render(<Chip label="Tops" count={4} selected onPress={onPress} />);
  const chip = screen.getByRole("button", { name: "Tops, 4" });
  expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
  await fireEvent.press(chip);
  expect(onPress).toHaveBeenCalled();
});

test("Swatch is a checkbox that reports its state", async () => {
  const onPress = jest.fn();
  await render(<Swatch color="#26325A" label="Navy" selected={false} onPress={onPress} />);
  const swatch = screen.getByRole("checkbox", { name: "Navy" });
  expect(swatch.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));
  await fireEvent.press(swatch);
  expect(onPress).toHaveBeenCalled();
});

test("GroupedList renders a header and rows; a pressable row is a button", async () => {
  const onPress = jest.fn();
  await render(
    <GroupedList header="Price list">
      <Row label="Front image" value="1 credit" />
      <Row label="Help" onPress={onPress} accessory="chevron" />
    </GroupedList>,
  );
  expect(screen.getByText("Price list")).toBeTruthy();
  expect(screen.getByText("1 credit")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Help" }));
  expect(onPress).toHaveBeenCalled();
});

test("ProgressBar exposes its value", async () => {
  await render(<ProgressBar value={0.25} accessibilityLabel="Credits left" />);
  expect(screen.getByLabelText("Credits left").props.accessibilityValue).toEqual({ min: 0, max: 100, now: 25 });
});

test("PopIn shows its content without movement under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  await render(<PopIn testID="p"><Text>Hi</Text></PopIn>);
  expect(screen.getByText("Hi")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByTestId("p").props.style).toEqual(expect.objectContaining({ transform: [{ translateY: 0 }, { scale: 1 }] })),
  );
});
