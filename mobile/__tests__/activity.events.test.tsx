import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { track } from "../src/activity/track";
import { ErrorBoundary, reportUncaughtErrors } from "../src/ui/ErrorBoundary";
import { CostSheet } from "../src/ui/CostSheet";
import { CreditsContext, type CreditsValue } from "../src/credits/CreditsProvider";
import * as v1 from "../src/api/v1";

jest.mock("../src/activity/track", () => ({ track: jest.fn() }));
const tracked = () => (track as jest.Mock).mock.calls;

beforeEach(() => jest.clearAllMocks());

function Boom(): React.ReactElement {
  throw new Error("secret text the user typed");
}

test("the error boundary reports the kind of error, never its message, and shows a way back", () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorBoundary><Boom /></ErrorBoundary>);
  expect(tracked()).toEqual([["client_error", { where: "global", kind: "render" }]]);
  expect(JSON.stringify(tracked())).not.toContain("secret");
  expect(screen.getByText("Something went wrong")).toBeTruthy();
});

test("uncaught errors are reported and still reach React Native's handler", () => {
  const previous = jest.fn();
  let handler: ((e: unknown, fatal?: boolean) => void) | null = null;
  reportUncaughtErrors({ getGlobalHandler: () => previous, setGlobalHandler: (h) => { handler = h; } });
  handler!(new Error("x"), true);
  expect(tracked()).toEqual([["client_error", { where: "global", kind: "unhandled" }]]);
  expect(previous).toHaveBeenCalledWith(expect.any(Error), true);
});

const credits: CreditsValue = { billing: true, prices: { garment: 1, back: 1, turn: 3 }, outfit: true, generation: true,
  credits: { balance: 10, held: 0, available: 10, granted: 40, used: 30, activity: [] } as never, refresh: jest.fn(async () => {}) };

function Sheet({ onConfirm = jest.fn(), onClose = jest.fn(), action }: { onConfirm?: () => void; onClose?: () => void; action?: "outfit" }) {
  return (
    <CreditsContext.Provider value={credits}>
      <CostSheet visible title="Create" lines={[{ label: "Front image", action: "garment", count: 3 }]} confirmLabel="Generate"
        onConfirm={onConfirm} onClose={onClose} action={action} />
    </CreditsContext.Provider>
  );
}

test("the cost sheet records confirm and cancel with the action and piece count", () => {
  const onConfirm = jest.fn();
  const { unmount } = render(<Sheet onConfirm={onConfirm} />);
  fireEvent.press(screen.getByRole("button", { name: "Generate" }));
  expect(onConfirm).toHaveBeenCalled();
  unmount();
  render(<Sheet action="outfit" />);
  fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(tracked()).toEqual([
    ["cost_sheet", { action: "garment", choice: "confirmed", pieces: 3 }],
    ["cost_sheet", { action: "outfit", choice: "cancelled", pieces: 3 }],
  ]);
});

test("a server error answer is reported once; event sends never report themselves", async () => {
  const account = { getToken: async () => "t", onUnauthorized: jest.fn() };
  global.fetch = jest.fn(async () => ({ status: 503, ok: false, json: async () => ({ error: "paused" }) })) as never;
  await expect(v1.getProfile(account)).rejects.toThrow();
  await expect(v1.postEventBatch(account, { app_version: "1", events: [] })).rejects.toThrow();
  expect(tracked()).toEqual([["client_error", { where: "global", kind: "http_5xx" }]]);
});

test("an unreachable server is reported as a network error", async () => {
  const account = { getToken: async () => "t", onUnauthorized: jest.fn() };
  global.fetch = jest.fn(async () => { throw new TypeError("Network request failed"); }) as never;
  await expect(v1.getProfile(account)).rejects.toThrow();
  expect(tracked()).toEqual([["client_error", { where: "global", kind: "network" }]]);
});

