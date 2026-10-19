import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { ItemSheet } from "../src/components/ItemSheet";
import { getTurn, startTurn } from "../src/api/client";
import type { ClosetItem, Turn } from "../src/api/types";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), startTurn: jest.fn(), getTurn: jest.fn() }));
const mockedStart = startTurn as jest.Mock;
const mockedGet = getTurn as jest.Mock;

const f = (value: string | string[]) => ({ value, confidence: 0.9, basis: "observed" as const });
const item: ClosetItem = {
  run_id: "20261016-104633-249", photo_name: "p", item_id: "item_0", tier: "high",
  facts: {
    category: f("t-shirt"), colors: f(["white"]), pattern: f("solid"), visible_text: f(""),
    trims: f(""), visible_parts: f(["front"]), occluded_parts: f(["back"]),
  },
  crop_url: "/c.png", generated_url: "/g.png", cutout_url: "/g_cut.png", back: null, turn: null,
};
const running: Turn = { state: "running", error: null, views: [] };
const done: Turn = {
  state: "done", error: null,
  views: (["front", "right", "back", "left"] as const).map((angle) => ({ angle, url: `/t/${angle}.png`, cutout_url: null })),
};

// Like the closet: the parent owns the item and feeds updates back into the sheet.
function Harness({ initial, spy }: { initial: ClosetItem; spy: jest.Mock }) {
  const [it, setIt] = React.useState(initial);
  return (
    <ItemSheet items={[it]} index={0} onClose={() => {}} onDeleted={() => {}}
      onUpdated={(u) => { spy(u); setIt(u); }} />
  );
}

function sheet(it: ClosetItem, onUpdated = jest.fn()) {
  render(<Harness initial={it} spy={onUpdated} />);
  return onUpdated;
}

// Let a poll's fetch promise settle after its timer fires.
async function tick(ms: number) {
  await act(async () => jest.advanceTimersByTime(ms));
  await act(async () => {});
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

test("offers Generate 360° View on closet items without one", () => {
  sheet(item);
  expect(screen.getByRole("button", { name: "Generate 360° View" })).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "360°" }));
  expect(screen.getByText("See it from every angle")).toBeTruthy();
});

test("starting shows progress, polls, and switches to the 360 when done", async () => {
  mockedStart.mockResolvedValue(running);
  mockedGet.mockResolvedValueOnce(running).mockResolvedValueOnce(done);
  const onUpdated = sheet(item);

  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Generate 360° View" })));
  expect(onUpdated).toHaveBeenLastCalledWith({ ...item, turn: running });
  expect(screen.getByText("Creating four angles…")).toBeTruthy();

  await tick(2000);
  await tick(2000);
  expect(onUpdated).toHaveBeenLastCalledWith({ ...item, turn: done });
  expect(screen.getByLabelText("360 view")).toBeTruthy();
});

test("resumes polling when the item is already running", async () => {
  mockedGet.mockResolvedValue(done);
  const onUpdated = sheet({ ...item, turn: running });
  await tick(2000);
  expect(mockedGet).toHaveBeenCalled();
  expect(onUpdated).toHaveBeenLastCalledWith({ ...item, turn: done });
});

test("a finished 360 opens on the turn view with the AI label", () => {
  sheet({ ...item, turn: done });
  expect(screen.getByLabelText("360 view")).toBeTruthy();
  expect(screen.getByText("Drag to rotate · AI view")).toBeTruthy();
  fireEvent.press(screen.getByRole("tab", { name: "Front" }));
  expect(screen.queryByLabelText("360 view")).toBeNull();
});

test("a failed job shows the reason and Try again starts it again", async () => {
  mockedStart.mockResolvedValue(running);
  sheet({ ...item, turn: { state: "failed", error: "Interrupted — try again", views: [] } });
  fireEvent.press(screen.getByRole("tab", { name: "360°" }));
  expect(screen.getByText("Interrupted — try again")).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Try Again" })));
  expect(mockedStart).toHaveBeenCalled();
});

test("a start error is shown", async () => {
  mockedStart.mockRejectedValue(new Error("Can't reach your wardrobe server."));
  sheet(item);
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Generate 360° View" })));
  expect(screen.getByText("Can't reach your wardrobe server.")).toBeTruthy();
});

test("polling stops when the sheet closes", async () => {
  mockedGet.mockResolvedValue(running);
  const { unmount } = render(<ItemSheet items={[{ ...item, turn: running }]} index={0} onClose={() => {}} onUpdated={jest.fn()} onDeleted={() => {}} />);
  unmount();
  await act(async () => jest.advanceTimersByTime(6000));
  expect(mockedGet).not.toHaveBeenCalled();
});

test("turning the garment pauses item paging until the finger lifts", () => {
  sheet({ ...item, turn: done });
  const touch = { nativeEvent: { touches: [], changedTouches: [] }, touchHistory: { numberActiveTouches: 1, indexOfSingleActiveTouch: 0, mostRecentTimeStamp: 1, touchBank: [{ touchActive: true, startPageX: 0, startPageY: 0, startTimeStamp: 0, currentPageX: 0, currentPageY: 0, currentTimeStamp: 1, previousPageX: 0, previousPageY: 0, previousTimeStamp: 0 }] } };
  expect(screen.getByTestId("item-pager").props.scrollEnabled).toBe(true);
  fireEvent(screen.getByLabelText("360 view"), "responderGrant", touch);
  expect(screen.getByTestId("item-pager").props.scrollEnabled).toBe(false);
  fireEvent(screen.getByLabelText("360 view"), "responderRelease", touch);
  expect(screen.getByTestId("item-pager").props.scrollEnabled).toBe(true);
});

test("a slow status check is never stacked with another one", async () => {
  mockedGet.mockReturnValue(new Promise(() => {}));   // the server is busy and doesn't answer
  sheet({ ...item, turn: running });
  await tick(2000);
  await tick(6000);
  expect(mockedGet).toHaveBeenCalledTimes(1);
});

describe("with billing on", () => {
  const { CreditsContext } = require("../src/credits/CreditsProvider");
  const wallet = (available: number) => ({ balance: available, held: 0, available, granted: 10, used: 0, entries: [], next_before: null });
  function billed(available: number) {
    const refresh = jest.fn(async () => {});
    render(
      <CreditsContext.Provider value={{ billing: true, prices: { turn: 3 }, credits: wallet(available), refresh }}>
        <Harness initial={item} spy={jest.fn()} />
      </CreditsContext.Provider>,
    );
    return refresh;
  }

  test("the 360 shows its cost and asks before spending it", async () => {
    mockedStart.mockResolvedValue(running);
    billed(5);
    expect(screen.getByText("3 credits")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Generate 360° View" }));
    expect(mockedStart).not.toHaveBeenCalled();
    expect(screen.getByText("Balance 5 → 2")).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByRole("button", { name: "Generate · 3 credits" })));
    expect(mockedStart).toHaveBeenCalled();
  });

  test("without enough credits the 360 doesn't start and says why", () => {
    billed(2);
    fireEvent.press(screen.getByRole("button", { name: "Generate 360° View" }));
    expect(mockedStart).not.toHaveBeenCalled();
    expect(screen.getByText("Not enough credits")).toBeTruthy();
    expect(screen.getByText("/ 3 credits needed")).toBeTruthy();
  });
});
