import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { g, SPIN_GARMENT } from "../data";
import { Headline } from "../components/Headline";
import { Sfx } from "../components/Sfx";
import { clamp, colors, fontFamily } from "../theme";

// S4 · AI 360° (bars 9–10.5). The striped tee's four real AI views turning on the stone stage, one angle per
// eighth note, with the app's own disclosure kept legible the whole time.
const STAGE_W = 900;
const STAGE_H = 1000;
const STAGE_TOP = 560;
export const STAGE = { left: (WIDTH - STAGE_W) / 2, top: STAGE_TOP, width: STAGE_W, height: STAGE_H } as const;

export const S4Spin: React.FC = () => {
  const frame = useCurrentFrame();
  const views = g(SPIN_GARMENT).turn!;
  const len = sceneLength("spin");
  // One and a half turns, starting after a short front hold.
  const steps = 10;
  const t0 = at("spin", 0.5);
  const t1 = at("spin", 5.5);
  const pos = interpolate(frame, [t0, t1], [0, steps], clamp);
  const step = Math.floor(pos);
  const frac = pos - step;
  const fade = interpolate(frac, [0, 0.35], [0, 1], clamp); // short crossfade into each new angle, like the app's scrub
  const current = views[step % 4];
  const previous = views[(step + 3) % 4];
  const sway = Math.sin(pos * Math.PI) * 6;
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: (WIDTH - STAGE_W) / 2, top: STAGE_TOP, width: STAGE_W, height: STAGE_H, borderRadius: 34,
        backgroundColor: colors.tile, boxShadow: "0 30px 80px rgba(20,20,40,0.16)", overflow: "hidden",
        
      }}>
        <div style={{ position: "absolute", inset: "9% 10% 17%", translate: `${sway}px 0px` }}>
          {step > 0 ? <Img src={previous} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "contain", opacity: 1 - fade }} /> : null}
          <Img src={current} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "contain", opacity: step > 0 ? fade : 1 }} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, display: "flex", justifyContent: "center" }}>
          <div style={{ padding: "14px 26px", borderRadius: 999, background: "rgba(255,255,255,0.78)", border: "1px solid rgba(255,255,255,0.9)",
            fontFamily, fontSize: 30, fontWeight: 600, color: colors.label, boxShadow: "0 6px 16px rgba(20,20,40,0.08)" }}>
            Drag to rotate · AI view
          </div>
        </div>
      </div>
      <Headline lines={["Spin it", "in AI 360°."]} from={at("spin", 0.3)} to={len - 2} />
      <Sfx name="swipe" at={t0} volume={0.25} />
    </AbsoluteFill>
  );
};
