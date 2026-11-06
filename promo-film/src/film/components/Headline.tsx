import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SAFE, WIDTH } from "../config";
import { clamp, colors, fontFamily, snap } from "../theme";

type Props = {
  lines: string[];
  /** Local frame the first word starts rising. */
  from: number;
  /** Local frame the line is gone. */
  to: number;
  zone?: "top" | "bottom";
  size?: number;
  sub?: string;
  align?: "left" | "center";
};

const STAGGER = 3;
const RISE = 9;
const EXIT = 7;

// The film's one headline style: Bricolage Grotesque 800, tight tracking, each word rising out of its
// line on a short stagger, then the whole block lifting away. Stays inside the platform-safe bands.
export const Headline: React.FC<Props> = ({ lines, from, to, zone = "top", size = 92, sub, align = "left" }) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [to - EXIT, to], [0, 1], clamp);
  let index = 0;
  const top = zone === "top" ? SAFE.topBand : SAFE.bottomBand;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        // The right-hand reserve is for the platforms' lower button rail; the top band may use the full width.
        width: zone === "top" || align === "center" ? WIDTH - SAFE.left * 2 : WIDTH - SAFE.left - SAFE.right,
        top,
        textAlign: align,
        fontFamily,
        opacity: 1 - exit,
        translate: `0px ${-18 * exit}px`,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.1 }}>
          {line.split(" ").map((word, wi) => {
            const start = from + index++ * STAGGER;
            const p = interpolate(frame, [start, start + RISE], [0, 1], { ...clamp, easing: snap });
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  fontSize: size,
                  fontWeight: 800,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.04,
                  color: colors.label,
                  marginRight: size * 0.24,
                  translate: `0px ${(1 - p) * size * 1.1}px`,
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      ))}
      {sub ? (
        <div
          style={{
            marginTop: size * 0.28,
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: colors.secondaryLabel,
            opacity: interpolate(frame, [from + index * STAGGER + 4, from + index * STAGGER + 14], [0, 1], clamp),
            translate: `0px ${interpolate(frame, [from + index * STAGGER + 4, from + index * STAGGER + 14], [16, 0], { ...clamp, easing: snap })}px`,
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};
