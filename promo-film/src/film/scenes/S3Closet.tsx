import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength } from "../config";
import { g, SPIN_GARMENT } from "../data";
import { StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Pill } from "../components/Pill";
import { Sfx } from "../components/Sfx";
import { TapRipple } from "../components/TapRipple";
import { appCurve, clamp, snap } from "../theme";
import { WALL, WALL_TILE, wallCell } from "./wall";
import { STAGE } from "./S4Spin";

// S3 · THE CLOSET (bars 7–9). The owner's pieces drop into a stone-tile wall on sixteenth notes; the Tops group
// (the app's own group name) filters it — the others step out, the tops close ranks — and the striped tee is
// picked up, carrying straight into the 360 stage.

const CHIPS = ["All", "Tops", "Bottoms", "Outerwear"];

export const S3Closet: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("closet");
  const filter = interpolate(frame, [at("closet", 2.75), at("closet", 3.5)], [0, 1], { ...clamp, easing: appCurve });
  const reflow = interpolate(frame, [at("closet", 3), at("closet", 4)], [0, 1], { ...clamp, easing: appCurve });
  const pick = interpolate(frame, [at("closet", 6), len], [0, 1], { ...clamp, easing: appCurve });
  const chipsIn = interpolate(frame, [at("closet", 1.75), at("closet", 2.25)], [0, 1], { ...clamp, easing: snap });
  const tops = WALL.filter((w) => w.top);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 80, top: 520, display: "flex", gap: 12, opacity: chipsIn * (1 - pick),
        translate: `0px ${(1 - chipsIn) * 20}px` }}>
        {CHIPS.map((c) => {
          const active = c === "Tops" ? filter > 0.3 : c === "All" ? filter <= 0.3 : false;
          return <Pill key={c} ink={active} style={{ fontSize: 30, padding: "12px 24px" }}>{c}</Pill>;
        })}
      </div>
      {WALL.map((w, i) => {
        const t = at("closet", i * 0.15);
        const p = interpolate(frame, [t, t + 9], [0, 1], { ...clamp, easing: snap });
        const from = wallCell(i);
        let x = from.x;
        let y = from.y;
        let scale = 0.9 + 0.1 * p;
        let opacity = p;
        let z = 1;
        if (w.top) {
          const to = wallCell(tops.indexOf(w));
          x = from.x + (to.x - from.x) * reflow;
          y = from.y + (to.y - from.y) * reflow;
          if (w.short === SPIN_GARMENT) {
            // Picked up: grows into the 360 stage's position.
            x += (STAGE.left - x) * pick;
            y += (STAGE.top - y) * pick;
            z = 3;
            return (
              <div key={w.short} style={{ position: "absolute", left: x, top: y, zIndex: z, opacity }}>
                <StoneTile garment={g(w.short)} width={WALL_TILE.width + (STAGE.width - WALL_TILE.width) * pick}
                  height={WALL_TILE.height + (STAGE.height - WALL_TILE.height) * pick} r={24 + 10 * pick} />
              </div>
            );
          }
          opacity *= 1 - pick;
        } else {
          scale *= 1 - 0.4 * filter;
          opacity *= 1 - filter;
        }
        return (
          <div key={w.short} style={{ position: "absolute", left: x, top: y, opacity, scale: String(scale), zIndex: z,
            translate: `0px ${(1 - p) * -80}px` }}>
            <StoneTile garment={g(w.short)} width={WALL_TILE.width} height={WALL_TILE.height} />
          </div>
        );
      })}
      <TapRipple x="235px" y="546px" at={at("closet", 2.75) - 2} size={90} />
      <Headline lines={["Your closet.", "Finally organized."]} from={at("closet", 0.2)} to={at("closet", 5.8)} />
      <Sfx name="land" at={at("closet", 0) + 6} volume={0.3} />
      <Sfx name="land" at={at("closet", 1.65) + 6} volume={0.3} />
      <Sfx name="click" at={at("closet", 2.75) - 2} volume={0.35} />
      <Sfx name="whoosh" at={at("closet", 6)} volume={0.3} />
    </AbsoluteFill>
  );
};
