import React from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView, type SymbolWeight } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

// SF Symbols on iOS (they match the system type and weight); Ionicons only as fallback.
// Before adding an icon, follow docs/design/ICONS.md (style, reserved symbols, preview script).
const ICONS = {
  home: { sf: "house", ion: "home-outline" },
  camera: { sf: "camera", ion: "camera-outline" },
  cameraBack: { sf: "camera.rotate", ion: "camera-reverse-outline" },
  pencil: { sf: "pencil", ion: "pencil" },
  close: { sf: "xmark", ion: "close" },
  add: { sf: "plus", ion: "add" },
  remove: { sf: "minus", ion: "remove" },
  chevron: { sf: "chevron.right", ion: "chevron-forward" },
  check: { sf: "checkmark.circle.fill", ion: "checkmark-circle" },
  checkmark: { sf: "checkmark", ion: "checkmark" },
  alert: { sf: "exclamationmark.circle", ion: "alert-circle-outline" },
  flat: { sf: "square.stack.3d.down.right", ion: "layers-outline" },
  above: { sf: "iphone", ion: "phone-portrait-outline" },
  several: { sf: "square.grid.2x2", ion: "albums-outline" },
  garment: { sf: "tshirt", ion: "shirt-outline" },
  closet: { sf: "square.grid.2x2", ion: "grid-outline" },
  turn: { sf: "rotate.3d", ion: "sync-outline" },
  account: { sf: "person.crop.circle", ion: "person-circle-outline" },
  plusCircle: { sf: "plus.circle.fill", ion: "add-circle" },
  sparkles: { sf: "sparkles", ion: "sparkles-outline" },
  search: { sf: "magnifyingglass", ion: "search" },
  chevronLeft: { sf: "chevron.left", ion: "chevron-back" },
  person: { sf: "person.fill", ion: "person" },
  gear: { sf: "gearshape", ion: "settings-outline" },
  jacket: { sf: "jacket", ion: "shirt-outline" },
  hanger: { sf: "hanger", ion: "shirt-outline" },
  handbag: { sf: "handbag", ion: "bag-handle-outline" },
  shoe: { sf: "shoe", ion: "footsteps-outline" },
  person2: { sf: "figure.stand", ion: "body-outline" },
  arrowRight: { sf: "arrow.right", ion: "arrow-forward" },
  photos: { sf: "photo.on.rectangle", ion: "images-outline" },
  // Build My Look's question options.
  shuffle: { sf: "shuffle", ion: "shuffle-outline" },
  coffee: { sf: "cup.and.saucer", ion: "cafe-outline" },
  briefcase: { sf: "briefcase", ion: "briefcase-outline" },
  heart: { sf: "heart", ion: "heart-outline" },
  wineglass: { sf: "wineglass", ion: "wine-outline" },
  crown: { sf: "crown", ion: "ribbon-outline" },
  sparkle: { sf: "sparkle", ion: "diamond-outline" },
  sneaker: { sf: "shoe", ion: "footsteps-outline" },
  run: { sf: "figure.run", ion: "walk-outline" },
  leaf: { sf: "leaf", ion: "leaf-outline" },
  star: { sf: "star", ion: "star-outline" },
  circle: { sf: "circle", ion: "ellipse-outline" },
  bolt: { sf: "bolt", ion: "flash-outline" },
  hot: { sf: "thermometer.sun", ion: "sunny" },
  sun: { sf: "sun.max", ion: "sunny-outline" },
  cloudSun: { sf: "cloud.sun", ion: "partly-sunny-outline" },
  snowflake: { sf: "snowflake", ion: "snow-outline" },
  rain: { sf: "cloud.rain", ion: "rainy-outline" },
} as const satisfies Record<string, { sf: SFSymbol; ion: keyof typeof Ionicons.glyphMap }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, color, weight }: {
  name: IconName; size: number; color: ColorValue; weight?: SymbolWeight;
}) {
  const { sf, ion } = ICONS[name];
  // React Native 0.88 widened ColorValue to null and numbers; both icon libraries take only strings and native colors.
  const tint = color == null || typeof color === "number" ? undefined : color;
  return (
    <SymbolView
      name={{ ios: sf }}
      size={size}
      weight={weight}
      tintColor={tint}
      fallback={<Ionicons name={ion} size={size} color={tint} />}
    />
  );
}
