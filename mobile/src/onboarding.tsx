import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CreditAction, Credits } from "./api/types";

export const SEEN_KEY = "onboarding.seen";
export const starterKey = (userId: string) => `onboarding.starter.${userId}`;

type OnboardingValue = {
  seen: boolean | null;  // null while loading
  markSeen: () => Promise<void>;
  justSignedIn: boolean;  // set by the code screen; the starter-credits screen is offered only then
  noteSignedIn: () => void;
  clearSignedIn: () => void;
};

const OnboardingContext = createContext<OnboardingValue>({
  seen: true, markSeen: async () => {}, justSignedIn: false, noteSignedIn: () => {}, clearSignedIn: () => {},
});
export const useOnboarding = () => useContext(OnboardingContext);

// The welcome and intro pages show once per device; the starter-credits screen once per account.
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [justSignedIn, setJustSignedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => alive && setSeen(v === "1"))
      .catch(() => alive && setSeen(false));
    return () => { alive = false; };
  }, []);

  const markSeen = useCallback(async () => {
    setSeen(true);
    await AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {});
  }, []);
  const noteSignedIn = useCallback(() => setJustSignedIn(true), []);
  const clearSignedIn = useCallback(() => setJustSignedIn(false), []);

  return (
    <OnboardingContext.Provider value={{ seen, markSeen, justSignedIn, noteSignedIn, clearSignedIn }}>
      {children}
    </OnboardingContext.Provider>
  );
}

// D7: the starter screen appears after a fresh sign-in only when the server charges credits and has
// granted this account some. It never shows a fixed number.
export function starterEligible(billing: boolean, credits: Credits | null): boolean {
  return billing && !!credits && credits.granted > 0;
}

// Once credits have loaded after a fresh sign-in, decide once whether to show the starter screen.
export function useStarterCredits(
  userId: string | null, billing: boolean, credits: Credits | null, show: () => void, ready = true,
) {
  const { justSignedIn, clearSignedIn } = useOnboarding();
  const deciding = useRef(false);
  useEffect(() => {
    if (!ready || !justSignedIn || !userId || !credits || deciding.current) return;
    deciding.current = true;
    clearSignedIn();
    (async () => {
      if (!starterEligible(billing, credits)) return;
      const shown = await AsyncStorage.getItem(starterKey(userId)).catch(() => null);
      if (shown) return;
      await AsyncStorage.setItem(starterKey(userId), "1").catch(() => {});
      show();
    })().finally(() => { deciding.current = false; });
  }, [ready, justSignedIn, userId, billing, credits, clearSignedIn, show]);
}

// The price chips on the starter screen: only actions the server prices, in a fixed order.
export function priceChips(prices: Partial<Record<CreditAction, number>>): string[] {
  const names: [CreditAction, string][] = [["garment", "Front"], ["back", "Back"], ["turn", "360°"]];
  return names.filter(([a]) => prices[a] !== undefined).map(([a, label]) => `${label} · ${prices[a]}`);
}

// Signing up includes a name: when a signed-in account has none yet, ask once (before Home's starter
// screen). Local mode has no profile and never asks.
export function useNameStep(signedIn: boolean, loaded: boolean, name: string | null | undefined, ask: () => void) {
  const asked = useRef(false);
  useEffect(() => {
    if (!signedIn || !loaded || name || asked.current) return;
    asked.current = true;
    ask();
  }, [signedIn, loaded, name, ask]);
  return !signedIn || (loaded && !!name);
}
