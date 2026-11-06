import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { appCurve, clamp } from "../theme";

// iOS recordings don't show touches; a soft ring marks each tap on the frame it happens.
export const TapRipple: React.FC<{ x: string; y: string; at: number; size?: number }> = ({ x, y, at, size = 70 }) => {
  const frame = useCurrentFrame();
  if (frame < at - 2 || frame > at + 16) return null;
  const p = interpolate(frame, [at - 2, at + 14], [0, 1], { ...clamp, easing: appCurve });
  const press = interpolate(frame, [at - 2, at, at + 6], [0, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex: 5 }}>
      <div style={{ position: "absolute", width: size, height: size, left: -size / 2, top: -size / 2, borderRadius: size,
        background: `rgba(255,255,255,${0.55 * press})`, border: "2px solid rgba(11,94,255,0.55)", opacity: 1 - p, scale: String(0.6 + 0.9 * p) }} />
    </div>
  );
};
