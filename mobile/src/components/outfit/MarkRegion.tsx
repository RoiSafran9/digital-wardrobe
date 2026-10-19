import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Text, View, type LayoutChangeEvent } from "react-native";
import { colors, radius, type } from "../../theme";

export type PhotoBox = { x: number; y: number; width: number; height: number };

// Drag across the photo to mark a garment the scan missed. Reports the box in photo pixels.
export function MarkRegion({ uri, onBox, maxHeight = 340 }: { uri: string; onBox: (box: PhotoBox | null) => void; maxHeight?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useEffect(() => {
    try {
      Image.getSize(uri, (w, h) => setSize({ w, h }), () => setSize(null));
    } catch {
      setSize(null);
    }
  }, [uri]);
  const aspect = size ? size.w / size.h : 0.75;
  const width = Math.min(frame, maxHeight * aspect);
  const height = width / aspect;
  const scale = size && width ? size.w / width : 1;
  const latest = useRef({ width, height, scale, onBox });
  latest.current = { width, height, scale, onBox };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      setDrag({ x0: x, y0: y, x1: x, y1: y });
    },
    onPanResponderMove: (_, g) => {
      setDrag((d) => {
        if (!d) return d;
        const { width: w, height: h } = latest.current;
        return { ...d, x1: Math.max(0, Math.min(w, d.x0 + g.dx)), y1: Math.max(0, Math.min(h, d.y0 + g.dy)) };
      });
    },
    onPanResponderRelease: () => {
      setDrag((d) => {
        const { scale: s, onBox: report } = latest.current;
        if (!d) return d;
        const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
        const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
        report(w < 12 || h < 12 ? null : { x: x * s, y: y * s, width: w * s, height: h * s });
        return d;
      });
    },
  }), []);

  const box = drag ? { left: Math.min(drag.x0, drag.x1), top: Math.min(drag.y0, drag.y1), width: Math.abs(drag.x1 - drag.x0), height: Math.abs(drag.y1 - drag.y0) } : null;
  return (
    <View testID="mark-region-frame" onLayout={(e: LayoutChangeEvent) => setFrame(e.nativeEvent.layout.width)} style={{ alignItems: "center", gap: 8 }}>
      <View
        {...pan.panHandlers}
        testID="mark-region"
        accessible
        accessibilityLabel="Your photo. Drag across the garment that was missed."
        style={{ width, height, borderRadius: radius.list, overflow: "hidden", backgroundColor: colors.tile }}
      >
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        {box ? (
          <View pointerEvents="none" style={{ position: "absolute", ...box, borderRadius: 8, borderWidth: 2, borderColor: colors.tint, backgroundColor: "rgba(31,107,255,0.12)" }} />
        ) : null}
      </View>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>Drag across the garment that was missed.</Text>
    </View>
  );
}
