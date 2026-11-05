import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { GarmentImage } from "./GarmentImage";
import { colors, radius, type, weight } from "../theme";
import { Glass, IconButton } from "../ui";
import { useReducedMotion } from "../useReducedMotion";
import { Rise } from "../motion/Rise";
import { dragPosition, faceFor, flingTarget, wrap } from "../turn";

export type TurnFrame = { label: string; path: string; cutoutPath?: string | null };

type Props = {
  views: TurnFrame[];
  label?: string;
  // True while a finger is turning the garment; the item swipe stays off meanwhile.
  onDragActive?: (active: boolean) => void;
  // Room the stage's own controls take at the top and bottom; the garment turns between them.
  inset?: { top: number; bottom: number };
};

// The angle pill's height and its gap above the garment.
const PILL = 26;
const PILL_GAP = 8;

// Less movement than this on release is a tap, not a drag.
const TAP_SLOP = 8;

// The garment on an invisible body, on a turntable that fills the item's image stage: drag sideways and
// it turns with the finger, flick and it keeps spinning, tap to turn one side; the arrows at the sides
// do the same without a gesture. Every view stays mounted (stacked) so turning never waits on the
// network. A glass pill names the side and labels the views as AI.
export function TurnView({ views, label, onDragActive, inset = { top: 0, bottom: 0 } }: Props) {
  const n = views.length;
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(0);          // fractional, unwrapped turn position
  const spin = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);
  const start = useRef(0);

  // One source of truth for the turn: the finger and the settle spring both move `spin`.
  // Turning is silent: the owner found a haptic per side distracting.
  useEffect(() => {
    const id = spin.addListener(({ value }) => setPos(value));
    return () => {
      spin.stopAnimation();
      spin.removeListener(id);
    };
  }, [spin]);

  // Turn to an (unwrapped) position: the label and dots update at once, the garment follows.
  const turnTo = (target: number, from: number) => {
    const i = wrap(target, n);
    setIndex(i);
    if (reduced) {
      spin.setValue(i);
      return;
    }
    spin.setValue(from);
    Animated.spring(spin, { toValue: target, useNativeDriver: false, speed: 12, bounciness: 3 }).start(({ finished }) => {
      if (!finished) return;
      spin.setValue(i);   // back on the circle, so positions never drift far from 0..n
    });
  };

  const go = (next: number) => turnTo(next, index);

  const settle = (dx: number, vx: number) => {
    dragging.current = false;
    onDragActive?.(false);
    if (Math.abs(dx) < TAP_SLOP) return go(start.current + 1);
    // Reduce Motion: no scrub or spin; a swipe steps one view with a short fade.
    if (reduced) return go(start.current + (dx < 0 ? 1 : -1));
    const now = dragPosition(start.current, dx);
    turnTo(flingTarget(now, vx), now);
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
          spin.stopAnimation();
          start.current = index;
          onDragActive?.(true);
        },
        onPanResponderMove: (_, g) => {
          if (!reduced) spin.setValue(dragPosition(start.current, g.dx));
        },
        onPanResponderRelease: (_, g) => settle(g.dx, g.vx),
        onPanResponderTerminate: (_, g) => settle(g.dx, g.vx),
      }),
    [index, n, reduced, onDragActive],
  );

  // The garment turns between the arrows (32pt each, 12pt from the edges), never under them.
  const band = { position: "absolute" as const, top: inset.top, bottom: inset.bottom + PILL + PILL_GAP };
  const garment = { ...band, left: 52, right: 52 };
  return (
    <View style={{ flex: 1 }}>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="360 view"
        accessibilityHint="Swipe up or down to turn the garment"
        accessibilityValue={{ text: views[index].label }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => go(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
        style={StyleSheet.absoluteFill}
      >
        <View pointerEvents="none" style={garment}>
          {reduced ? (
            <Rise key={index} distance={0} style={{ flex: 1 }}>
              <GarmentImage path={views[index].path} cutoutPath={views[index].cutoutPath} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
            </Rise>
          ) : (
            views.map((v, i) => {
              const face = faceFor(i, pos, n);
              return (
                <View
                  key={v.path}
                  style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: face.opacity,
                    transform: [{ perspective: 900 }, { rotateY: `${face.rotateY}deg` }],
                  }}
                >
                  <GarmentImage path={v.path} cutoutPath={v.cutoutPath} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
                </View>
              );
            })
          )}
        </View>
      </View>
      <View pointerEvents="box-none" style={{ ...band, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="chevronLeft" label="Turn left" size={32} onPress={() => go(index - 1)} />
        <IconButton icon="chevron" label="Turn right" size={32} onPress={() => go(index + 1)} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: inset.bottom, alignItems: "center" }}>
        <Glass testID="turn-angle" radius={radius.pill} level="sheet" style={{ height: PILL, paddingHorizontal: 10, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ ...type.caption, ...weight(600), color: colors.label }}>
            {`${views[index].label} · Drag to rotate${label ? ` · ${label}` : ""}`}
          </Text>
        </Glass>
      </View>
    </View>
  );
}
