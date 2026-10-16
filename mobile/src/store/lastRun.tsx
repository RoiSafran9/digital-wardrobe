import React, { createContext, useContext, useState, ReactNode } from "react";
import type { RunResponse } from "../api/types";

type LastRunContextValue = {
  lastRun: RunResponse | null;
  setLastRun: (run: RunResponse | null) => void;
};

const LastRunContext = createContext<LastRunContextValue | undefined>(undefined);

export function LastRunProvider({ children }: { children: ReactNode }) {
  const [lastRun, setLastRun] = useState<RunResponse | null>(null);
  return (
    <LastRunContext.Provider value={{ lastRun, setLastRun }}>
      {children}
    </LastRunContext.Provider>
  );
}

export function useLastRun(): LastRunContextValue {
  const ctx = useContext(LastRunContext);
  if (!ctx) {
    throw new Error("useLastRun must be used within a LastRunProvider");
  }
  return ctx;
}
