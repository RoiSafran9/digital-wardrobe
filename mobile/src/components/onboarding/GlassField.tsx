import React, { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { colors, radius, type } from "../../theme";
import { Glass } from "../../ui/Glass";

// The sign-in field: a 54pt glass well that takes a 2pt accent border while it has focus.
export function GlassField({ onFocus, onBlur, ...props }: Omit<TextInputProps, "style">) {
  const [focused, setFocused] = useState(false);
  return (
    <Glass radius={radius.input} level="sheet" style={{ height: 54 }}>
      <TextInput
        placeholderTextColor={colors.tertiaryLabel}
        {...props}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={{ ...type.body, color: colors.label, height: 54, paddingHorizontal: 16 }}
      />
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.input, borderWidth: 2, borderColor: colors.tint, opacity: focused ? 1 : 0 }}
      />
    </Glass>
  );
}
