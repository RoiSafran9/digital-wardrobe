import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp, colors, fontFamily, snap } from "../theme";

// A detection box like the pre-scan's: accent outline and a numbered badge, popping in on its frame.
export const DetectBox: React.FC<{
  x: number; y: number; width: number; height: number; n: number; at: number; fadeAt?: number;
}> = ({ x, y, width, height, n, at, fadeAt }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 7], [0, 1], { ...clamp, easing: snap });
  const out = fadeAt === undefined ? 0 : interpolate(frame, [fadeAt, fadeAt + 6], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        border: `5px solid ${colors.tint}`,
        borderRadius: 18,
        boxSizing: "border-box",
        opacity: p * (1 - out),
        scale: String(1.06 - 0.06 * p),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 14,
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: colors.tint,
          color: "#FFFFFF",
          fontFamily,
          fontWeight: 700,
          fontSize: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </div>
    </div>
  );
};
