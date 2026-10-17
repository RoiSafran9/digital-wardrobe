import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import { GarmentImage } from "./GarmentImage";
import { colors, type } from "../theme";
import { useReducedMotion } from "../useReducedMotion";
import { Rise } from "../motion/Rise";
import { dragPosition, opacityFor, snap, wrap } from "../turn";
import { haptics } from "../haptics";

export type TurnFrame = { label: string; path: string; cutoutPath?: string | null };

type Props = {
  views: TurnFrame[];
  label?: string;
  // True while a finger is turning the garment; the sheet's pager stops scrolling meanwhile.
  onDragActive?: (active: boolean) => void;
};

// Less movement than this on release is a tap, not a drag.
const TAP_SLOP = 8;

// The garment on an invisible body: drag sideways to turn it, tap to step one view.
// Every view stays mounted (stacked) so turning is instant; drag progress crossfades neighbours.
export function TurnView({ views, label, onDragActive }: Props) {
  const n = views.length;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(0);          // fractional position while dragging
  const dragging = useRef(false);
  const start = useRef(0);

  const go = (next: number) => {
    const i = wrap(next, n);
    if (i !== index) haptics.selection();
    setIndex(i);
    setPos(i);
  };

  const settle = (dx: number) => {
    dragging.current = false;
    onDragActive?.(false);
    if (Math.abs(dx) < TAP_SLOP) return go(start.current + 1);
    // Reduce Motion: no scrub; a swipe steps one view with a short fade.
    go(reduced ? start.current + (dx < 0 ? 1 : -1) : snap(dragPosition(start.current, dx), n));
  };

  // A plain View owns the touch (a Pressable would replace these handlers with its own).
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > TAP_SLOP && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = true;
          start.current = index;
          onDragActive?.(true);
        },
        onPanResponderMove: (_, g) => {
          if (!reduced) setPos(dragPosition(start.current, g.dx));
        },
        onPanResponderRelease: (_, g) => settle(g.dx),
        onPanResponderTerminate: (_, g) => settle(g.dx),
      }),
    [index, n, reduced, onDragActive],
  );

  return (
    <View>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="360 view"
        accessibilityHint="Swipe up or down to turn the garment"
        accessibilityValue={{ text: views[index].label }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => go(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
        style={{ width: "100%", aspectRatio: 1 }}
      >
        {reduced ? (
          <Rise key={index} distance={0} style={{ flex: 1 }}>
            <GarmentImage path={views[index].path} cutoutPath={views[index].cutoutPath} style={{ width: "100%", height: "100%" }} />
          </Rise>
        ) : (
          views.map((v, i) => (
            <View key={v.path} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: opacityFor(i, pos, n) }}>
              <GarmentImage path={v.path} cutoutPath={v.cutoutPath} style={{ width: "100%", height: "100%" }} />
            </View>
          ))
        )}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 10 }}>
        {views.map((v, i) => (
          <View
            key={v.path}
            testID={`turn-dot-${i}`}
            style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === index ? colors.label : colors.separatorStrong }}
          />
        ))}
      </View>
      {label ? (
        <Text style={{ ...type.caption, color: colors.secondaryLabel, textAlign: "center", marginTop: 6 }}>{label}</Text>
      ) : null}
    </View>
  );
}
