import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { colors, radius, shadow, type } from "../theme";
import { useReducedMotion } from "../useReducedMotion";

// The handoff's sheet curve: quick start, long soft landing.
export const SHEET_EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const DURATION = 380;

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  floating?: boolean;  // a card inset from the screen edges (confirmations) instead of an edge-to-edge sheet
  children: React.ReactNode;
  testID?: string;
};

// A glass bottom sheet over a dimmed backdrop; tap outside to dismiss. Slides up, and back down before it
// unmounts. Under Reduce Motion it fades instead of sliding.
export function Sheet({ visible, onClose, title, floating = false, children, testID }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const anim = Animated.timing(t, { toValue: visible ? 1 : 0, duration: visible ? DURATION : 260, easing: SHEET_EASE, useNativeDriver: true });
    anim.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => anim.stop();
  }, [visible, t]);

  if (!mounted) return null;
  const translateY = reduced ? 0 : t.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.32)", opacity: t }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          style={{
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderBottomLeftRadius: floating ? radius.sheet : 0,
            borderBottomRightRadius: floating ? radius.sheet : 0,
            marginHorizontal: floating ? 10 : 0,
            marginBottom: floating ? Math.max(insets.bottom, 10) : 0,
            paddingHorizontal: 20,
            paddingBottom: floating ? 20 : Math.max(insets.bottom, 20),
            maxHeight: height - insets.top - 40,
            opacity: reduced ? t : 1,
            transform: [{ translateY }],
            ...shadow.sheet,
          }}
        >
          <View pointerEvents="none" style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden",
            borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
            borderBottomLeftRadius: floating ? radius.sheet : 0, borderBottomRightRadius: floating ? radius.sheet : 0,
            borderWidth: 0.5, borderColor: colors.glassBorder,
          }}>
            <BlurView intensity={40} tint="systemChromeMaterial" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.glassSheet }} />
          </View>
          <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 14 }}>
            <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.separatorStrong }} />
          </View>
          {title ? (
            <Text accessibilityRole="header" style={{ ...type.section, color: colors.label, marginBottom: 12 }}>{title}</Text>
          ) : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
