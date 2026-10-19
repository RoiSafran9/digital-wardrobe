import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ClosetItem } from "../../api/types";
import { Icon } from "../Icon";
import { GarmentImage } from "../GarmentImage";
import { colors, type } from "../../theme";

export type CategoryRow = { name: string; count: number; first: ClosetItem };

// "Your closet": one row per category group that has pieces, with its first piece as the thumbnail.
export function CategoryRows({ rows, onOpen }: { rows: CategoryRow[]; onOpen: (name: string) => void }) {
  return (
    <View>
      {rows.map(({ name, count, first }) => (
        <Pressable
          key={name}
          onPress={() => onOpen(name)}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${count}`}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator, opacity: pressed ? 0.6 : 1,
          })}
        >
          <GarmentImage path={first.generated_url} cutoutPath={first.cutout_url} cropPath={first.crop_url}
            tile={colors.tile} style={{ width: 48, height: 58, borderRadius: 12, backgroundColor: colors.tile }} />
          <Text style={{ ...type.body, fontWeight: "500", color: colors.label, flex: 1 }}>{name}</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{count}</Text>
          <Icon name="chevron" size={14} color={colors.tertiaryLabel} />
        </Pressable>
      ))}
    </View>
  );
}
