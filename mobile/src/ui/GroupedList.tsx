import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../components/Icon";
import { colors, radius, type } from "../theme";

// An inset grouped list: an eyebrow header over a rounded card of rows divided by hairlines.
export function GroupedList({ header, children, footer }: { header?: string; children: React.ReactNode; footer?: string }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ gap: 8 }}>
      {header ? <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingHorizontal: 16 }}>{header}</Text> : null}
      <View style={{ backgroundColor: colors.card, borderRadius: radius.list, overflow: "hidden" }}>
        {rows.map((row, i) => (
          <View key={i} style={i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, marginLeft: 16 } : null}>
            <View style={i ? { marginLeft: -16 } : null}>{row}</View>
          </View>
        ))}
      </View>
      {footer ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, paddingHorizontal: 16 }}>{footer}</Text> : null}
    </View>
  );
}

type RowProps = {
  label: string;
  value?: string;
  accessory?: "chevron" | React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  tint?: boolean;  // a blue action row ("Sign Out")
};

export function Row({ label, value, accessory, onPress, destructive, tint }: RowProps) {
  const fg = destructive ? colors.destructive : tint ? colors.tint : colors.label;
  const body = (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
      <Text style={{ ...type.body, color: fg, flex: 1 }}>{label}</Text>
      {value ? <Text style={{ ...type.body, color: colors.secondaryLabel, flexShrink: 1, textAlign: "right" }}>{value}</Text> : null}
      {accessory === "chevron" ? <Icon name="chevron" size={14} color={colors.tertiaryLabel} /> : accessory ?? null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : "transparent" })}>
      {body}
    </Pressable>
  );
}
