import React, { useState } from "react";
import { Image, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../api/client";
import { colors, radius } from "../theme";

type Props = {
  path: string;
  // Transparent-background version; preferred so the garment sits directly on the tile.
  cutoutPath?: string | null;
  style?: ViewStyle;
  tile?: string;
};

// A garment on its own tile. Falls back cutout → white-background image → hanger placeholder.
export function GarmentImage({ path, cutoutPath, style, tile = colors.surface }: Props) {
  const sources = cutoutPath ? [cutoutPath, path] : [path];
  const [attempt, setAttempt] = useState(0);
  const current = sources[attempt];

  return (
    <View
      style={[
        { backgroundColor: tile, borderRadius: radius.tile, overflow: "hidden", alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      {current ? (
        <Image
          key={current}
          source={{ uri: imageUrl(current) }}
          onError={() => setAttempt((a) => a + 1)}
          resizeMode="contain"
          style={{ width: "84%", height: "84%" }}
        />
      ) : (
        <Ionicons name="shirt-outline" size={32} color={colors.lineStrong} />
      )}
    </View>
  );
}
