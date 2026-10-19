import React, { useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { normalizeCode } from "../auth/messages";
import { colors, radius, type } from "../theme";

export const CODE_LENGTH = 6;

type Props = { value: string; onChange: (code: string) => void; disabled?: boolean };

// Six boxes over one hidden field, so iOS can autofill the code from Mail and paste works.
// The current box gets an accent border; all six turn green once complete.
export function CodeBoxes({ value, onChange, disabled }: Props) {
  const input = useRef<TextInput>(null);
  const complete = value.length === CODE_LENGTH;
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={{ flexDirection: "row", gap: 8 }} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const current = !complete && i === value.length;
          return (
            <View
              key={i}
              testID={`code-box-${i}`}
              style={{
                flex: 1, height: 62, borderRadius: radius.button, backgroundColor: colors.grouped,
                alignItems: "center", justifyContent: "center", borderWidth: 1.5,
                borderColor: complete ? colors.success : current ? colors.tint : "transparent",
              }}
            >
              <Text style={{ ...type.screenTitle, letterSpacing: 0, color: colors.label, fontVariant: ["tabular-nums"] }}>{value[i] ?? ""}</Text>
            </View>
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
