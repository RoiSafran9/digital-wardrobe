import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../theme";

// The app's free-scan band: a soft accent sweep down the photo with a bright leading edge.
export const ScanBand: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to + 4) return null;
  const p = interpolate(frame, [from, to], [0, 1], clamp);
  const fade = interpolate(frame, [to - 4, to + 4], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: `${-22 + p * 122}%`, height: "22%", opacity: fade, pointerEvents: "none",
      background: "linear-gradient(180deg, rgba(11,94,255,0) 0%, rgba(11,94,255,0.16) 82%, rgba(255,255,255,0.9) 99%, rgba(11,94,255,0.5) 100%)" }} />
  );
};
