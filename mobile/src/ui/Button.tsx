import React from "react";
import { ActivityIndicator, Text, View, type ColorValue } from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { PressScale } from "../motion/PressScale";
import { colors, hitSlopFor, radius, type } from "../theme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "text" | "destructive";
  size?: "large" | "medium";  // large: 54pt (main action), medium: 48pt (paired actions)
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

const LOOK: Record<NonNullable<Props["variant"]>, { bg: ColorValue | undefined; fg: ColorValue }> = {
  primary: { bg: colors.tint, fg: colors.onTint },
  secondary: { bg: colors.card, fg: colors.label },
  text: { bg: undefined, fg: colors.tint },
  destructive: { bg: undefined, fg: colors.destructive },
};

// The handoff's buttons: a full-width 54pt primary, 48pt paired buttons, and text actions.
export function Button({ title, onPress, variant = "primary", size = "large", icon, disabled, loading, testID }: Props) {
  const { bg, fg } = LOOK[variant];
  const height = size === "large" ? 54 : 48;
  const off = disabled || loading;
  const isText = variant === "text" || variant === "destructive";
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={isText ? hitSlopFor(height) : undefined}
      scaleTo={0.98}
      style={{
        height,
        borderRadius: size === "large" ? radius.primary : radius.button,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: isText ? 0 : 20,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <Text style={{ ...(size === "large" ? type.headline : { ...type.subhead, fontWeight: "600" }), color: fg }}>{title}</Text>
      </View>
    </PressScale>
  );
}
