import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { at, WIDTH } from "../config";
import { Headline } from "../components/Headline";
import { Sfx } from "../components/Sfx";
import { Icon } from "../components/Icon";
import { appCurve, clamp, snap } from "../theme";

// S8 · THE BRAND (bars 19–21). Icon, wordmark, the line. One blue inverted hit on the beat, then stillness
// while the music resolves. No store badge, link, beta wording or claims.

export const S8Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: snap });
  const word = interpolate(frame, [at("brand", 1), at("brand", 1) + 10], [0, 1], { ...clamp, easing: snap });
  const flashAt = at("brand", 3);
  const inverted = interpolate(frame, [flashAt, flashAt + 1, flashAt + 6, flashAt + 9], [0, 1, 1, 0], clamp);
  const settle = interpolate(frame, [0, 60], [1.03, 1], { ...clamp, easing: appCurve });
  const ICON = 280;
  const WORD_W = 470;
  return (
    <AbsoluteFill style={{ backgroundColor: `rgba(31,107,255,${inverted})` }}>
      <AbsoluteFill style={{ scale: String(settle) }}>
        <div style={{ position: "absolute", left: (WIDTH - ICON) / 2, top: 560, scale: String(0.55 + 0.45 * pop), opacity: pop,
          filter: "drop-shadow(0 24px 40px rgba(31,107,255,0.30))" }}>
          <Icon size={ICON} inverted={inverted} />
        </div>
        <Img src={staticFile("brand/wordmark.png")} style={{ position: "absolute", left: (WIDTH - WORD_W) / 2, top: 920, width: WORD_W,
          opacity: word, translate: `0px ${(1 - word) * 40}px`, filter: inverted > 0.5 ? "brightness(0) invert(1)" : undefined }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, filter: inverted > 0.5 ? "brightness(0) invert(1)" : undefined }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 960 }}>
          <Headline lines={["More looks.", "Same closet."]} from={at("brand", 2)} to={10_000} size={84} align="center" />
        </div>
      </div>
      <Sfx name="hit" at={0} volume={0.55} />
    </AbsoluteFill>
  );
};
