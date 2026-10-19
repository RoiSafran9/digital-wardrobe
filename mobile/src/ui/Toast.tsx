import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, type } from "../theme";
import { EASE_OUT } from "../motion/Rise";

export const TOAST_MS = 2600;

type ToastValue = { show: (message: string) => void };
const ToastContext = createContext<ToastValue>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

// One short confirmation at a time, top-center, ink pill. Fades in, holds, fades out (2.6s in all).
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const next = useRef(0);
  const show = useCallback((message: string) => setToast({ id: ++next.current, message }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? <ToastPill key={toast.id} message={toast.message} /> : null}
    </ToastContext.Provider>
  );
}

function ToastPill({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 300, easing: EASE_OUT, useNativeDriver: true }),
      Animated.delay(TOAST_MS - 600),
      Animated.timing(t, { toValue: 0, duration: 300, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [t]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: "absolute", top: insets.top + 8, alignSelf: "center",
        backgroundColor: colors.label, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10,
        opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }}
    >
      <Text style={{ ...type.toast, color: colors.background }}>{message}</Text>
    </Animated.View>
  );
}
