import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerPushToken, unregisterPushToken } from "./api/client";
import { useAuth } from "./auth/AuthProvider";

export const NOTIFY_KEY = "notify.token";
export const NOT_SET_UP = "Notifications aren't set up for this build yet.";
export const DENIED = "Notifications are off for this app. Turn them on in iOS Settings → Notifications.";

// Pushes that arrive while the app is open still show as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

type Value = { enabled: boolean; busy: boolean; error: string | null; setEnabled: (on: boolean) => Promise<void> };
const NotifyContext = createContext<Value>({ enabled: false, busy: false, error: null, setEnabled: async () => {} });
export const useNotify = () => useContext(NotifyContext);

// 'Notify when ready' (spec D10): off by default. On asks iOS for permission, gets this phone's Expo push
// token and gives it to the server, which pushes when AI work finishes. Remembered per device.
export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const { status, userId } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(null);
    setError(null);
    if (status !== "signedIn" || !userId) return;
    AsyncStorage.getItem(`${NOTIFY_KEY}.${userId}`).then((t) => t && setToken(t)).catch(() => {});
  }, [status, userId]);

  const setEnabled = useCallback(async (on: boolean) => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      if (on) {
        const id = projectId();
        if (!id) throw new Error(NOT_SET_UP);
        const perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted) throw new Error(DENIED);
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId: id });
        await registerPushToken(data);
        await AsyncStorage.setItem(`${NOTIFY_KEY}.${userId}`, data).catch(() => {});
        setToken(data);
      } else {
        if (token) await unregisterPushToken(token).catch(() => {});
        await AsyncStorage.removeItem(`${NOTIFY_KEY}.${userId}`).catch(() => {});
        setToken(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change notifications. Try again.");
    } finally {
      setBusy(false);
    }
  }, [userId, token]);

  return <NotifyContext.Provider value={{ enabled: !!token, busy, error, setEnabled }}>{children}</NotifyContext.Provider>;
}
