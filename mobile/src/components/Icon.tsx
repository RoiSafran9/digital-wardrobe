import React from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

// SF Symbols on iOS (they match the system type and weight); Ionicons only as fallback.
const ICONS = {
  camera: { sf: "camera", ion: "camera-outline" },
  cameraBack: { sf: "camera.rotate", ion: "camera-reverse-outline" },
  pencil: { sf: "pencil", ion: "pencil" },
  close: { sf: "xmark", ion: "close" },
  add: { sf: "plus", ion: "add" },
  check: { sf: "checkmark.circle.fill", ion: "checkmark-circle" },
  checkmark: { sf: "checkmark", ion: "checkmark" },
  alert: { sf: "exclamationmark.circle", ion: "alert-circle-outline" },
  flat: { sf: "square.stack.3d.down.right", ion: "layers-outline" },
  above: { sf: "iphone", ion: "phone-portrait-outline" },
  several: { sf: "square.grid.2x2", ion: "albums-outline" },
  garment: { sf: "tshirt", ion: "shirt-outline" },
  closet: { sf: "square.grid.2x2", ion: "grid-outline" },
} as const satisfies Record<string, { sf: SFSymbol; ion: keyof typeof Ionicons.glyphMap }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size, color }: { name: IconName; size: number; color: ColorValue }) {
  const { sf, ion } = ICONS[name];
  return (
    <SymbolView
      name={{ ios: sf }}
      size={size}
      tintColor={color}
      fallback={<Ionicons name={ion} size={size} color={color} />}
    />
  );
}
