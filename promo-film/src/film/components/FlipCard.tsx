import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { appCurve, clamp } from "../theme";

// Turns a card over around its vertical axis: the photo crop on the front, the catalog image on the back.
// The faces swap while the card is edge-on, so the garment never morphs from one image into the other.
export const FlipCard: React.FC<{
  width: number; height: number; at: number; duration?: number; front: React.ReactNode; back: React.ReactNode;
}> = ({ width, height, at, duration = 16, front, back }) => {
  const frame = useCurrentFrame();
  const deg = interpolate(frame, [at, at + duration], [0, 180], { ...clamp, easing: appCurve });
  const face: React.CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden" };
  return (
    <div style={{ width, height, position: "relative", transformStyle: "preserve-3d", transform: `perspective(1800px) rotateY(${deg}deg)` }}>
      <div style={face}>{front}</div>
      <div style={{ ...face, transform: "rotateY(180deg)" }}>{back}</div>
    </div>
  );
};
