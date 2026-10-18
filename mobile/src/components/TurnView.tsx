import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Text, View } from "react-native";
import { GarmentImage } from "./GarmentImage";
import { colors, type } from "../theme";
import { useReducedMotion } from "../useReducedMotion";
import { Rise } from "../motion/Rise";
import { dragPosition, faceFor, flingTarget, wrap } from "../turn";

export type TurnFrame = { label: string; path: string; cutoutPath?: string | null };

type Props = {
  views: TurnFrame[];
  label?: string;
  // True while a finger is turning the garment; the sheet's pager stops scrolling meanwhile.
  onDragActive?: (active: boolean) => void;
};

// Less movement than this on release is a tap, not a drag.
const TAP_SLOP = 8;

// The garment on an invisible body, on a turntable: drag sideways and it turns with the finger,
// flick and it keeps spinning, tap to turn one side. Every view stays mounted (stacked) so
// turning never waits on the network.
export function TurnView({ views, label, onDragActive }: Props) {
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
          views.map((v, i) => {
            const face = faceFor(i, pos, n);
            return (
              <View
                key={v.path}
                pointerEvents="none"
                style={{
                  position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: face.opacity,
                  transform: [{ perspective: 900 }, { rotateY: `${face.rotateY}deg` }],
                }}
              >
                <GarmentImage path={v.path} cutoutPath={v.cutoutPath} style={{ width: "100%", height: "100%" }} />
              </View>
            );
          })
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
