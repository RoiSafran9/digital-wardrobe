import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { LastRunProvider, useLastRun } from "../src/store/lastRun";

test("starts with no last run", () => {
  const { result } = renderHook(() => useLastRun(), { wrapper: LastRunProvider });
  expect(result.current.lastRun).toBeNull();
});

test("setLastRun updates the value readable via useLastRun", () => {
  const { result } = renderHook(() => useLastRun(), { wrapper: LastRunProvider });
  const fakeRun = { run_id: "r1", quality: { status: "ok" }, items: [], failed: [] };

  act(() => {
    result.current.setLastRun(fakeRun as any);
  });

  expect(result.current.lastRun).toEqual(fakeRun);
});

test("throws when used outside the provider", () => {
  const { result } = renderHook(() => {
    try {
      return useLastRun();
    } catch (e) {
      return e;
    }
  });
  expect(result.current).toBeInstanceOf(Error);
});
