import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IconName } from "../Icon";
import { colors, radius, type, weight } from "../../theme";
import { Glass, IconButton } from "../../ui";

// The camera and the photo frames are always dark, whatever the appearance; these are fixed, not theme colors.
export const CAMERA_INK = "#FFFFFF";
export const PHOTO_BG = "#1C1C1E";  // behind a photo that doesn't fill its frame

type BarAction = { icon: IconName; label: string; onPress: () => void };

// The add flows' top bar (handoff TopBar): a round glass button on the left (or any small node), a small
// centered title and an optional control on the right. `dark` over the camera.
export function FlowBar({ left, leftNode, title, right, dark = false, live = false }: {
  left?: BarAction; leftNode?: React.ReactNode; title?: string; right?: React.ReactNode; dark?: boolean; live?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 6, minHeight: 46 }}>
      <View style={{ width: 88, alignItems: "flex-start" }}>
        {left ? <IconButton icon={left.icon} label={left.label} onPress={left.onPress} dark={dark} /> : leftNode}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <Text accessibilityRole="header" accessibilityLiveRegion={live ? "polite" : undefined} numberOfLines={1}
            style={{ ...type.subhead, ...weight(600), color: dark ? CAMERA_INK : colors.label }}>{title}</Text>
        ) : null}
      </View>
      <View style={{ width: 88, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

// A sticky glass footer over the bottom of a flow screen; the content scrolls under it. Reports its height so
// the scroll can end above it.
export function FlowFooter({ children, onHeight }: { children: React.ReactNode; onHeight?: (height: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <Glass radius={0} level="sheet" flat style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16), gap: 6 }}>
        {children}
      </Glass>
    </View>
  );
}

// The camera's viewfinder: inset 12pt, rounded 28, with white corner brackets. The photo views after the
// shot reuse it so the picture stays where it was taken.
export function Viewfinder({ children }: { children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, marginHorizontal: 12, borderRadius: radius.hero, overflow: "hidden", backgroundColor: PHOTO_BG }}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {(["tl", "tr", "bl", "br"] as const).map((c) => {
          const top = c[0] === "t", left = c[1] === "l";
          return (
            <View key={c} style={{
              position: "absolute", width: 26, height: 26, borderColor: "rgba(255,255,255,0.8)",
              top: top ? 14 : undefined, bottom: top ? undefined : 14, left: left ? 14 : undefined, right: left ? undefined : 14,
              borderTopWidth: top ? 3 : 0, borderBottomWidth: top ? 0 : 3, borderLeftWidth: left ? 3 : 0, borderRightWidth: left ? 0 : 3,
              borderTopLeftRadius: c === "tl" ? 6 : 0, borderTopRightRadius: c === "tr" ? 6 : 0,
              borderBottomLeftRadius: c === "bl" ? 6 : 0, borderBottomRightRadius: c === "br" ? 6 : 0,
            }} />
          );
        })}
      </View>
    </View>
  );
}

// A small pill on the dark camera screens ("Finding them is free").
export function CameraPill({ text }: { text: string }) {
  return (
    <View style={{ alignSelf: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)" }}>
      <Text style={{ ...type.footnote, ...weight(600), color: CAMERA_INK }}>{text}</Text>
    </View>
  );
}

// The light screen after a dark camera view comes up out of black instead of switching at once.
export function FadeFromBlack() {
  const t = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 0, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000000", opacity: t }]} />;
}
