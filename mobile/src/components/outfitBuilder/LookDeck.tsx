import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Text, View, useWindowDimensions } from "react-native";
import type { ClosetItem, OutfitLook } from "../../api/types";
import { haptics } from "../../haptics";
import { SHEET_EASE } from "../../ui/Sheet";
import { useReducedMotion } from "../../useReducedMotion";
import { colors, radius, shadow, type, weight } from "../../theme";
import { Button, Glass } from "../../ui";
import { LOOK_CARD_RADIUS, LookCard } from "./LookCard";

const THRESHOLD = 90;  // pt sideways before a release sends the card away
const STACK = [2, 1] as const;  // the cards waiting behind, deepest first

type Props = {
  looks: OutfitLook[];
  items: Map<string, ClosetItem>;
  index: number;
  onIndexChange: (index: number) => void;
  onOpen: (index: number) => void;
  height: number;
  onDragging?: (dragging: boolean) => void;  // the screen stops scrolling while a card is held
};

// The looks as a deck: the top card follows a sideways drag and flies off past 90pt, showing the next
// look; two cards wait behind it (12/24pt lower, 95/90% size) and move up as it leaves. There is no
// saved-looks list (02-UX-FLOWS.md U4), so both directions just go to the next look, and the deck goes
// round. The visible Next Look button does the same for Reduce Motion, VoiceOver and anyone who'd
// rather tap; under Reduce Motion the card changes without flying.
export function LookDeck({ looks, items, index, onIndexChange, onOpen, height, onDragging }: Props) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const flying = useRef(false);
  const latest = useRef({ index, n: looks.length, reduced, width, onIndexChange, onDragging });
  latest.current = { index, n: looks.length, reduced, width, onIndexChange, onDragging };
  const n = looks.length;

  // The new top card is on screen before the deck snaps back under it.
  useLayoutEffect(() => {
    pan.setValue({ x: 0, y: 0 });
    flying.current = false;
  }, [index, looks, pan]);

  const responder = useMemo(() => {
    const away = (dir: number) => {
      const { index: i, n: count, reduced: still, width: w, onIndexChange: change } = latest.current;
      if (flying.current || count < 2) return;
      flying.current = true;
      haptics.selection();
      if (still) { change((i + 1) % count); return; }
      Animated.timing(pan, { toValue: { x: dir * (w + 120), y: 0 }, duration: 300, easing: SHEET_EASE, useNativeDriver: true })
        .start(({ finished }) => { if (finished) change((i + 1) % count); else flying.current = false; });
    };
    const settle = () => Animated.spring(pan, { toValue: { x: 0, y: 0 }, speed: 16, bounciness: 6, useNativeDriver: true }).start();
    const release = (dx: number, vx: number) => {
      latest.current.onDragging?.(false);
      if (Math.abs(dx) > THRESHOLD || Math.abs(vx) > 0.8) away(dx > 0 ? 1 : -1);
      else settle();
    };
    return {
      next: () => away(-1),
      handlers: PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => latest.current.n > 1 && !flying.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => latest.current.onDragging?.(true),
        onPanResponderMove: (_, g) => pan.setValue({ x: g.dx, y: g.dy * 0.3 }),
        onPanResponderRelease: (_, g) => release(g.dx, g.vx),
        onPanResponderTerminate: () => { latest.current.onDragging?.(false); settle(); },
        onPanResponderTerminationRequest: () => false,
      }).panHandlers,
    };
  }, [pan]);

  if (!n) return null;
  const at = (k: number) => looks[(index + k) % n];
  const progress = pan.x.interpolate({ inputRange: [-THRESHOLD, 0, THRESHOLD], outputRange: [1, 0, 1], extrapolate: "clamp" });
  const far = width + 120;
  const rotate = reduced ? "0deg" : pan.x.interpolate({ inputRange: [-far, 0, far], outputRange: ["-30deg", "0deg", "30deg"], extrapolate: "clamp" });
  const behind = STACK.filter((k) => k < n);

  return (
    <View>
      <View style={{ height: height + 8 }}>
        {behind.map((k) => (
          <Animated.View
            key={k}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height,
              transform: [
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [k * 12, (k - 1) * 12] }) },
                { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1 - k * 0.05, 1 - (k - 1) * 0.05] }) },
              ],
            }}
          >
            {k === 1 ? <LookCard look={at(1)} items={items} height={height} peek /> : (
              <View style={{ height, backgroundColor: colors.card, borderRadius: LOOK_CARD_RADIUS, ...shadow.tile }} />
            )}
          </Animated.View>
        ))}
        <Animated.View
          {...responder.handlers}
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height, transformOrigin: "50% 90%",
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
          }}
        >
          <LookCard look={at(0)} items={items} height={height} onPress={() => onOpen(index)}>
            {n > 1 ? (
              <Animated.View pointerEvents="none" style={{ position: "absolute", top: 12, alignSelf: "center", opacity: progress }}>
                <Glass radius={radius.pill} level="sheet" flat style={{ paddingVertical: 7, paddingHorizontal: 12 }}>
                  <Text style={{ ...type.toast, ...weight(700), color: colors.secondaryLabel }}>Next look</Text>
                </Glass>
              </Animated.View>
            ) : null}
          </LookCard>
        </Animated.View>
      </View>
      {n > 1 ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"], paddingLeft: 4 }}>{`${index + 1} of ${n}`}</Text>
          <Button title="Next Look" variant="glass" size="medium" icon="arrowRight" onPress={responder.next} />
        </View>
      ) : null}
    </View>
  );
}
