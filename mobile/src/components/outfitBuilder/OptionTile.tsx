import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { Icon } from "../Icon";
import { PressScale } from "../../motion/PressScale";
import { haptics } from "../../haptics";
import type { Option } from "../../outfitBuilder/filters";
import { useReducedMotion } from "../../useReducedMotion";
import { colors, radius, type } from "../../theme";

const SWATCH = 20;
const SWATCH_STEP = 14;

// One answer in Build My Look's questions: a bold outline icon (or three swatches) over its label.
// Selected = ink fill with inverted content, like Chip; the icon pops once when it becomes selected.
export function OptionTile<T extends string>({ option, selected, width, onPress }: {
  option: Option<T>; selected: boolean; width: number; onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(1)).current;
  const wasSelected = useRef(selected);
  useEffect(() => {
    if (selected && !wasSelected.current && !reduced) {
      pop.setValue(0.8);
      Animated.spring(pop, { toValue: 1, speed: 18, bounciness: 12, useNativeDriver: true }).start();
    }
    wasSelected.current = selected;
  }, [selected, reduced, pop]);

  const fg = selected ? colors.background : colors.label;
  return (
    <PressScale
      onPress={() => { haptics.selection(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected }}
      style={{
        width, height: 78, borderRadius: radius.list, alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: selected ? colors.label : colors.fill,
      }}
    >
      <Animated.View style={{ height: 26, justifyContent: "center", transform: [{ scale: pop }] }}>
        {"icon" in option ? (
          <Icon name={option.icon} size={24} color={fg} weight="semibold" />
        ) : (
          <View style={{ flexDirection: "row" }}>
            {option.swatches.map((c, i) => (
              <View key={c} style={{
                width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, marginLeft: i === 0 ? 0 : SWATCH_STEP - SWATCH,
                backgroundColor: c, borderWidth: 1.5, borderColor: selected ? colors.label : colors.background,
              }} />
            ))}
          </View>
        )}
      </Animated.View>
      <Text numberOfLines={1} adjustsFontSizeToFit
        style={{ ...type.subhead, fontWeight: "500", color: fg, paddingHorizontal: 6 }}>{option.label}</Text>
    </PressScale>
  );
}
