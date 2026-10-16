import React, { useState } from "react";
import { Image, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../api/client";
import { colors, radius } from "../theme";

// A garment on its own tile; shows a quiet hanger placeholder if the image is missing.
export function GarmentImage({ path, style, tile = colors.surface }: { path: string; style?: ViewStyle; tile?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={[
        { backgroundColor: tile, borderRadius: radius.tile, overflow: "hidden", alignItems: "center", justifyContent: "center" },
        style,
      ]}
    >
      {failed ? (
        <Ionicons name="shirt-outline" size={32} color={colors.lineStrong} />
      ) : (
        <Image
          source={{ uri: imageUrl(path) }}
          onError={() => setFailed(true)}
          resizeMode="contain"
          style={{ width: "88%", height: "88%" }}
        />
      )}
    </View>
  );
}
