import React, { useRef } from "react";
import { Pressable, Text, TextInput, View, type TextInputInstance } from "react-native";
import { normalizeCode } from "../auth/messages";
import { colors, radius, type } from "../theme";
import { Glass } from "../ui/Glass";

export const CODE_LENGTH = 6;

type Props = { value: string; onChange: (code: string) => void; disabled?: boolean };

// Six glass boxes over one hidden field, so iOS can autofill the code from Mail and paste works.
// The current box gets a 2pt accent border; all six turn green once complete.
export function CodeBoxes({ value, onChange, disabled }: Props) {
  const input = useRef<TextInputInstance>(null);
  const complete = value.length === CODE_LENGTH;
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={{ flexDirection: "row", gap: 8 }} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const current = !complete && i === value.length;
          return (
            <Glass key={i} testID={`code-box-${i}`} radius={radius.input} level="sheet"
              style={{ flex: 1, height: 58, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.stat, color: colors.label }}>{value[i] ?? ""}</Text>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.input, borderWidth: 2,
                  borderColor: complete ? colors.success : colors.tint, opacity: complete || current ? 1 : 0,
                }}
              />
            </Glass>
          );
        })}
      </View>
      <TextInput
        ref={input}
        accessibilityLabel="6-digit code"
        value={value}
        onChangeText={(text) => onChange(normalizeCode(text).slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH + 2}  // room for a pasted "123 456"
        editable={!disabled}
        autoFocus
        caretHidden
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: "transparent" }}
      />
    </Pressable>
  );
}
