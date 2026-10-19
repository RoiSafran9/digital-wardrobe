import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import type { OutfitCandidate } from "../../api/types";
import { colors, radius, type } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";

type Props = {
  uri: string;
  candidates: OutfitCandidate[];
  selected?: string[];  // undefined: just show the boxes (detecting)
  onToggle?: (id: string) => void;
  overlay?: React.ReactNode;
  maxHeight?: number;
};

// The user's photo with a box around each garment found. Boxes pop in one by one; selected boxes are
// solid accent with a light wash, unselected ones dashed white. Box coordinates are photo pixels.
export function PhotoWithBoxes({ uri, candidates, selected, onToggle, overlay, maxHeight = 420 }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let live = true;
    try {
      Image.getSize(uri, (w, h) => live && setSize({ w, h }), () => live && setSize(null));
    } catch {
      setSize(null);
    }
    return () => { live = false; };
  }, [uri]);
  const aspect = size ? size.w / size.h : 0.75;
  const width = Math.min(frame, maxHeight * aspect);
  const height = width / aspect;
  const scale = size ? width / size.w : 0;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setFrame(e.nativeEvent.layout.width)} style={{ alignItems: "center" }}>
      <View style={{ width, height, borderRadius: radius.feature, overflow: "hidden", backgroundColor: colors.tile }}>
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" accessibilityLabel="Your outfit photo" />
        {overlay}
        {size ? candidates.map((c, i) => (
          <Box key={c.id} index={i} candidate={c} scale={scale}
            selected={selected ? selected.includes(c.id) : true} onPress={onToggle ? () => onToggle(c.id) : undefined} />
        )) : null}
      </View>
    </View>
  );
}

function Box({ candidate, index, scale, selected, onPress }: { candidate: OutfitCandidate; index: number; scale: number; selected: boolean; onPress?: () => void }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 420, delay: index * 180, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, index]);
  const { x, y, width, height } = candidate.box;
  const style = {
    position: "absolute" as const, left: x * scale, top: y * scale, width: width * scale, height: height * scale,
    borderRadius: 10, borderWidth: 2, borderStyle: (selected ? "solid" : "dashed") as "solid" | "dashed",
    borderColor: selected ? colors.tint : "#FFFFFF", backgroundColor: selected ? "rgba(31,107,255,0.08)" : "transparent",
    opacity: t, transform: [{ scale: reduced ? 1 : t.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }],
  };
  const badge = (
    <View style={{ position: "absolute", top: -10, left: -10, width: 22, height: 22, borderRadius: 11, backgroundColor: selected ? colors.tint : "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ ...type.caption, fontWeight: "700", color: "#FFFFFF" }}>{index + 1}</Text>
    </View>
  );
  if (!onPress) return <Animated.View pointerEvents="none" style={style}>{badge}</Animated.View>;
  return (
    <Animated.View style={style}>
      <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}
        accessibilityLabel={`Garment ${index + 1}`} style={{ flex: 1 }}>{badge}</Pressable>
    </Animated.View>
  );
}
