import React from "react";
import type { ColorValue, OpaqueColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

// SF Symbols on iOS (they match the system type and weight); Ionicons only as fallback.
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
} as const satisfies Record<string, { sf: SFSymbol; ion: keyof typeof Ionicons.glyphMap }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  const { sf, ion } = ICONS[name];
  // Ionicons only accepts a resolved string or native opaque color, never the raw null/number ColorValue permits;
  // every caller passes a theme color (hex string or DynamicColorIOS's opaque value), so this cast is safe.
  const ionColor = color as string | OpaqueColorValue;
  return (
    <SymbolView
      name={{ ios: sf }}
      size={size}
      tintColor={color}
      fallback={<Ionicons name={ion} size={size} color={ionColor} />}
    />
  );
}
