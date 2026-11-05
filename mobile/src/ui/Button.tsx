import React from "react";
import { ActivityIndicator, Text, View, type ColorValue } from "react-native";
import { Icon, type IconName } from "../components/Icon";
import { PressScale } from "../motion/PressScale";
import { colors, hitSlopFor, radius, type, weight } from "../theme";
import { Glass } from "./Glass";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "glass" | "soft" | "ink" | "text" | "destructive";
  size?: "large" | "medium";  // large: 54pt (main action), medium: 44pt (paired and small actions)
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

const LOOK: Record<NonNullable<Props["variant"]>, { bg: ColorValue | undefined; fg: ColorValue }> = {
  primary: { bg: colors.tint, fg: colors.onTint },
  secondary: { bg: colors.card, fg: colors.label },
  glass: { bg: undefined, fg: colors.label },
  soft: { bg: colors.fill, fg: colors.label },
  ink: { bg: colors.label, fg: colors.background },
  text: { bg: undefined, fg: colors.tint },
  destructive: { bg: undefined, fg: colors.destructive },
};

// The handoff's buttons: a full-width 54pt primary, 44pt small ones, glass / soft / ink fills, and text
// actions.
export function Button({ title, onPress, variant = "primary", size = "large", icon, disabled, loading, testID }: Props) {
  const { bg, fg } = LOOK[variant];
  const height = size === "large" ? 54 : 44;
  const corner = size === "large" ? radius.primary : radius.button;
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
        borderRadius: corner,
        backgroundColor: bg,
        opacity: disabled ? 0.4 : 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: isText ? 0 : 20,
      }}
    >
      {variant === "glass" ? <Glass radius={corner} flat style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
        <Text numberOfLines={1} style={{ ...(size === "large" ? type.headline : { ...type.subhead, ...weight(600) }), color: fg }}>{title}</Text>
      </View>
    </PressScale>
  );
}
