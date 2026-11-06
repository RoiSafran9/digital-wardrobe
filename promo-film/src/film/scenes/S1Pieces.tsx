import React from "react";
import { AbsoluteFill, interpolate, Img, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { g } from "../data";
import { FlipCard } from "../components/FlipCard";
import { StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, colors, fontFamily, snap } from "../theme";

// S1 · REAL CLOTHES IN, CLEAN CATALOG OUT (bars 2–5). Six more of the owner's own photos — on the bed, on a
// hanger — each turning over to its real catalog image, one per eighth note, while the app's own processing
// stages tick by underneath.

const PIECES = ["009d44e7", "d7b9819d", "858632a0", "7b988d90", "247440bb", "33b1974b"];
const COLS = 3;
const W = 290;
const H = 350;
const GAP = 24;
const LEFT = (WIDTH - (COLS * W + (COLS - 1) * GAP)) / 2;
const TOP = 600;
const STAGES = ["Finding each garment", "Separating the pieces", "Laying them flat", "Adding final details"];

export const S1Pieces: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("photo");
  const push = interpolate(frame, [0, len], [1, 1.04], { ...clamp, easing: appCurve });
  const exit = interpolate(frame, [len - 9, len], [0, 1], { ...clamp, easing: appCurve });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(push * (1 - 0.1 * exit)), opacity: 1 - exit }}>
        {PIECES.map((short, i) => {
          const piece = g(short);
          const x = LEFT + (i % COLS) * (W + GAP);
          const y = TOP + Math.floor(i / COLS) * (H + GAP);
          const t = at("photo", i * 0.18);
          const p = interpolate(frame, [t, t + 8], [0, 1], { ...clamp, easing: snap });
          return (
            <div key={short} style={{ position: "absolute", left: x, top: y, opacity: p, translate: `0px ${(1 - p) * 50}px`,
              filter: "drop-shadow(0 18px 28px rgba(20,20,40,0.16))" }}>
              <FlipCard width={W} height={H} at={at("photo", 1.25 + i * 0.6)} duration={12}
                front={<div style={{ width: "100%", height: "100%", borderRadius: 24, overflow: "hidden", background: "#ddd" }}>
                  <Img src={piece.crop!} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
                back={<StoneTile garment={piece} width={W} height={H} />} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: LEFT, top: TOP + 2 * H + GAP + 56, fontFamily, display: "flex", flexDirection: "column", gap: 14,
          opacity: interpolate(frame, [0, 8], [0, 1], clamp) }}>
          {STAGES.map((s, i) => {
            const on = at("photo", 1.25 + i * 0.9);
            const p = interpolate(frame, [on, on + 6], [0, 1], { ...clamp, easing: snap });
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 16, opacity: 0.25 + 0.75 * p, fontSize: 34, fontWeight: 600, color: colors.label }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, background: p > 0.5 ? colors.tint : "rgba(120,120,128,0.18)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, scale: String(0.8 + 0.2 * p) }}>{p > 0.5 ? "✓" : ""}</div>
                {s}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <Headline lines={["Real clothes in.", "Clean catalog out."]} from={at("photo", 0.4)} to={at("photo", 7.6)} />
      {[0, 2, 4].map((i) => <Sfx key={i} name="land" at={at("photo", 1.25 + i * 0.6) + 10} volume={0.25} />)}
    </AbsoluteFill>
  );
};
