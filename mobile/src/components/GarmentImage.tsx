import React, { useState } from "react";
import { View, type ColorValue, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Icon } from "./Icon";
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
  tile?: ColorValue;
  testID?: string;
};

// Account-mode images come as short-lived signed URLs, re-signed on every fetch. Caching by the path
// without its signature means a garment loaded once shows instantly from memory or disk afterwards,
// instead of reloading from the network each time a screen refetches the closet.
export function cacheKeyFor(path: string): string {
  return path.split("?")[0];
}

// A garment is never boxed: a cutout floats on whatever it sits on. Only images that still
// carry their own background get a tile, so that background reads as intentional.
// Falls back cutout → white-background image → photo crop → placeholder.
export function GarmentImage({ path, cutoutPath, cropPath, style, tile = colors.tile, testID }: Props) {
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
          key={cacheKeyFor(current)}
          source={{ uri: imageUrl(current), cacheKey: cacheKeyFor(current) }}
          cachePolicy="memory-disk"
          recyclingKey={cacheKeyFor(current)}
          transition={0}
          onError={() => setAttempt((a) => a + 1)}
          contentFit="contain"
          style={{ width: floating ? "92%" : "84%", height: floating ? "92%" : "84%" }}
        />
      ) : (
        <Icon name="garment" size={32} color={colors.separatorStrong} />
      )}
    </View>
  );
}
