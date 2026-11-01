import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { bootstrap, getCredits, getPrices } from "../api/client";
import type { CreditAction, Credits } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

export type CreditsValue = {
  billing: boolean;  // the server charges credits for AI actions
  prices: Partial<Record<CreditAction, number>>;
  credits: Credits | null;  // null until loaded, and in local mode
  outfit?: boolean;  // the server offers the Outfit Photo flow
  outfitBuilder?: boolean;  // the server offers Build My Look
  generation?: boolean;  // false while the operator has paused new AI work
  refresh: () => Promise<void>;
};

const empty: CreditsValue = { billing: false, prices: {}, credits: null, outfit: false, outfitBuilder: false, generation: true, refresh: async () => {} };
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
      setState({ credits, billing: !!prices?.billing, prices: prices?.prices ?? {}, outfit: !!prices?.outfit,
                 outfitBuilder: !!prices?.outfit_builder, generation: prices?.generation !== false });
    } catch {
      // Keep what we had; the next refresh tries again.
    }
  }, []);

  useEffect(() => {
    setState(empty);
    // After this render's effects: AuthProvider (our parent) points the API at the account in its own effect.
    // Each sign-in first asks for the one-time welcome credits (a no-op unless this account is invited).
    const signedIn = status === "signedIn";
    const timer = setTimeout(() => {
      (signedIn ? bootstrap().catch(() => 0) : Promise.resolve(0)).finally(() => void refresh());
    }, 0);
    return () => clearTimeout(timer);
  }, [status, userId, refresh]);

  return <CreditsContext.Provider value={{ ...state, refresh }}>{children}</CreditsContext.Provider>;
}
