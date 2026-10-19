import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppearanceMode = "system" | "light" | "dark";
export const APPEARANCE_KEY = "appearance.mode";

type Value = { mode: AppearanceMode; setMode: (mode: AppearanceMode) => Promise<void> };
const AppearanceContext = createContext<Value>({ mode: "system", setMode: async () => {} });
export const useAppearance = () => useContext(AppearanceContext);

const apply = (mode: AppearanceMode) => Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);

// Light / Dark / System (spec D16), remembered on this device. Every color is a dynamic pair, so
// overriding the app's color scheme re-colors everything without a re-render.
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppearanceMode>("system");
  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
        apply(saved);
      }
    }).catch(() => {});
  }, []);
  const setMode = useCallback(async (next: AppearanceMode) => {
    setModeState(next);
    apply(next);
    await AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => {});
  }, []);
  return <AppearanceContext.Provider value={{ mode, setMode }}>{children}</AppearanceContext.Provider>;
}
