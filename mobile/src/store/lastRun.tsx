import React, { createContext, useContext, useState, ReactNode } from "react";

type RunResponse = {
  run_id: string;
  quality: unknown;
  items: unknown[];
  failed: string[];
};

type LastRunContextValue = {
  lastRun: RunResponse | null;
  setLastRun: (run: RunResponse) => void;
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
