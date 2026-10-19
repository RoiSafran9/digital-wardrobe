import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getCredits, getPrices } from "../api/client";
import type { CreditAction, Credits } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

export type CreditsValue = {
  billing: boolean;  // the server charges credits for AI actions
  prices: Partial<Record<CreditAction, number>>;
  credits: Credits | null;  // null until loaded, and in local mode
  outfit?: boolean;  // the server offers the Outfit Photo flow
  refresh: () => Promise<void>;
};

const empty: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, refresh: async () => {} };
export const CreditsContext = createContext<CreditsValue>(empty);
export const useCredits = () => useContext(CreditsContext);

// The signed-in account's balance and the server's price list. Forgotten when the account changes
// or signs out, so one person's balance never shows for another.
export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const { status, userId } = useAuth();
  const [state, setState] = useState<Omit<CreditsValue, "refresh">>(empty);
  const owner = useRef<string | null>(null);
  owner.current = status === "signedIn" ? userId : null;

  const refresh = useCallback(async () => {
    const forUser = owner.current;
    if (!forUser) return;
    try {
      const [credits, prices] = await Promise.all([getCredits(), getPrices()]);
      if (owner.current !== forUser) return;  // signed out or switched while loading
      setState({ credits, billing: !!prices?.billing, prices: prices?.prices ?? {}, outfit: !!prices?.outfit });
    } catch {
      // Keep what we had; the next refresh tries again.
    }
  }, []);

  useEffect(() => {
    setState(empty);
    // After this render's effects: AuthProvider (our parent) points the API at the account in its own effect.
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [status, userId, refresh]);

  return <CreditsContext.Provider value={{ ...state, refresh }}>{children}</CreditsContext.Provider>;
}
