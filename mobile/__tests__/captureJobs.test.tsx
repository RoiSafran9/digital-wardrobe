import React from "react";
import { Pressable, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { CaptureJobsProvider, useCaptureJobs } from "../src/store/captureJobs";
import { postRun } from "../src/api/client";
import { NO_CREDITS } from "../src/api/v1";

jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), postRun: jest.fn() }));
const mockedPost = postRun as jest.Mock;

function Probe() {
  const { current, start, retry, clear } = useCaptureJobs();
  return (
    <>
      <Text>{current ? `${current.status}${current.insufficient ? " insufficient" : ""}${current.result ? ` ${current.result.run_id}` : ""}${current.error ? ` ${current.error}` : ""}` : "idle"}</Text>
      <Pressable onPress={() => start("file:///a.jpg", 2)}><Text>start</Text></Pressable>
      <Pressable onPress={retry}><Text>retry</Text></Pressable>
      <Pressable onPress={clear}><Text>clear</Text></Pressable>
    </>
  );
}

const ok = { run_id: "r1", quality: { status: "ok", reason: null }, items: [], failed: [] };
beforeEach(() => jest.clearAllMocks());

test("start → running → done with the result, sent with the approved fronts", async () => {
  let finish: (v: unknown) => void = () => {};
  mockedPost.mockReturnValue(new Promise((r) => { finish = r; }));
  render(<CaptureJobsProvider><Probe /></CaptureJobsProvider>);
  fireEvent.press(screen.getByText("start"));
  expect(screen.getByText("running")).toBeTruthy();
  expect(mockedPost).toHaveBeenCalledWith("file:///a.jpg", 2);
  await act(async () => finish(ok));
  expect(screen.getByText("done r1")).toBeTruthy();
});

test("a server 'not enough credits' marks the job as insufficient", async () => {
  mockedPost.mockRejectedValue(new Error(NO_CREDITS));
  render(<CaptureJobsProvider><Probe /></CaptureJobsProvider>);
  await act(async () => fireEvent.press(screen.getByText("start")));
  expect(screen.getByText(/failed insufficient/)).toBeTruthy();
});

test("retry posts the same photo again", async () => {
  mockedPost.mockRejectedValueOnce(new Error("Can't reach your wardrobe server.")).mockResolvedValueOnce(ok);
  render(<CaptureJobsProvider><Probe /></CaptureJobsProvider>);
  await act(async () => fireEvent.press(screen.getByText("start")));
  expect(screen.getByText("failed Can't reach your wardrobe server.")).toBeTruthy();
  await act(async () => fireEvent.press(screen.getByText("retry")));
  expect(mockedPost).toHaveBeenLastCalledWith("file:///a.jpg", 2);
  expect(screen.getByText("done r1")).toBeTruthy();
});

test("a cleared job ignores a late answer", async () => {
  let finish: (v: unknown) => void = () => {};
  mockedPost.mockReturnValue(new Promise((r) => { finish = r; }));
  render(<CaptureJobsProvider><Probe /></CaptureJobsProvider>);
  fireEvent.press(screen.getByText("start"));
  fireEvent.press(screen.getByText("clear"));
  await act(async () => finish(ok));
  expect(screen.getByText("idle")).toBeTruthy();
});
