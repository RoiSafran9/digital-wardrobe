import React, { useState } from "react";
import { Image, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { imageUrl } from "../api/client";
import { colors, radius } from "../theme";

type Props = {
  path: string;
  // Transparent-background version; preferred so the garment sits directly on the page.
  cutoutPath?: string | null;
  // The original photo crop; shown for retake items that never got a generated image.
  cropPath?: string;
  style?: ViewStyle;
  // Backdrop for images that still carry a background (white generation or photo crop).
  tile?: string;
  testID?: string;
};

// A garment is never boxed: a cutout floats on whatever it sits on. Only images that still
// carry their own background get a tile, so that background reads as intentional.
// Falls back cutout → white-background image → photo crop → placeholder.
export function GarmentImage({ path, cutoutPath, cropPath, style, tile = colors.surface, testID }: Props) {
  const sources = [cutoutPath, path, cropPath].filter((p): p is string => !!p);
  const [attempt, setAttempt] = useState(0);
  const current = sources[attempt];
  const floating = !!current && current === cutoutPath;

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: floating ? "transparent" : tile,
          borderRadius: radius.tile,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {current ? (
        <Image
          key={current}
          source={{ uri: imageUrl(current) }}
          onError={() => setAttempt((a) => a + 1)}
          resizeMode="contain"
          style={{ width: floating ? "92%" : "84%", height: floating ? "92%" : "84%" }}
        />
      ) : (
        <Ionicons name="shirt-outline" size={32} color={colors.lineStrong} />
      )}
    </View>
  );
}
