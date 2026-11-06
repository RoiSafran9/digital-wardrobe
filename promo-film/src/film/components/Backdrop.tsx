import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { WIDTH } from "../config";
import { colors } from "../theme";

// The app's own Glass backdrop: cool grey with its two pre-rendered blobs (mobile/assets/backdrop.png),
// drifting slowly so held frames never look frozen.
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = WIDTH * 1.15;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <Img
        src={staticFile("brand/backdrop.png")}
        style={{
          position: "absolute",
          width: w,
          height: (w * 1311) / 603,
          left: -WIDTH * 0.075,
          top: interpolate(frame, [0, durationInFrames], [-80, -260]),
        }}
      />
    </AbsoluteFill>
  );
};
