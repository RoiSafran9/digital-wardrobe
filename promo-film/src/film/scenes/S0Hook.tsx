import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { at } from "../config";
import { FLATLAY, g } from "../data";
import { DetectBox } from "../components/DetectBox";
import { FlipCard } from "../components/FlipCard";
import { StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { bandRect, PhotoBand, PhotoCrop } from "../components/PhotoBand";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, snap } from "../theme";

// S0 · THE HOOK (bars 0–2). The real flat-lay photo, a shutter, the scan's two boxes; each real crop lifts
// out of the photo and turns over to show its real catalog image; more of the closet arrives behind them.

const BAND_W = 960;
const BAND_LEFT = 60;
const BAND_TOP = 790;

// Where each crop rests once lifted (center x/y, height), and its slight tilt.
const LIFT = {
  tee: { cx: 300, cy: 1010, h: 440, rot: -4, flipAt: at("hook", 2.5), landAt: at("hook", 3.5) },
  pants: { cx: 785, cy: 1040, h: 700, rot: 3, flipAt: at("hook", 3), landAt: at("hook", 4) },
} as const;

// Six more of the owner's pieces, landing from beat 4.
const WARDROBE = [
  { short: "009d44e7", x: 175, y: 640 },
  { short: "247440bb", x: 905, y: 630 },
  { short: "3b41f435", x: 120, y: 1520 },
  { short: "858632a0", x: 540, y: 1560 },
  { short: "7b988d90", x: 960, y: 1500 },
  { short: "d7b9819d", x: 540, y: 600 },
] as const;

const Lifted: React.FC<{ which: "tee" | "pants" }> = ({ which }) => {
  const frame = useCurrentFrame();
  const lift = LIFT[which];
  const start = bandRect(FLATLAY[which].box, BAND_W);
  const startCx = BAND_LEFT + start.x + start.width / 2;
  const startCy = BAND_TOP + start.y + start.height / 2;
  const p = interpolate(frame, [at("hook", 1), at("hook", 2.5)], [0, 1], { ...clamp, easing: appCurve });
  const w = (start.width / start.height) * lift.h;
  const width = interpolate(p, [0, 1], [start.width, w]);
  const height = interpolate(p, [0, 1], [start.height, lift.h]);
  const garment = g(FLATLAY[which].garment);
  const outline = interpolate(frame, [lift.flipAt - 4, lift.flipAt + 2], [1, 0], clamp);
  return (
    <div style={{
      position: "absolute",
      left: interpolate(p, [0, 1], [startCx, lift.cx]) - width / 2,
      top: interpolate(p, [0, 1], [startCy, lift.cy]) - height / 2,
      rotate: `${lift.rot * p}deg`,
      filter: `drop-shadow(0 ${30 * p}px ${40 * p}px rgba(20,20,40,${0.22 * p}))`,
    }}>
      <FlipCard width={width} height={height} at={lift.flipAt} duration={14}
        front={
          <div style={{ width: "100%", height: "100%", borderRadius: 22 * p, overflow: "hidden", outline: `5px solid rgba(11,94,255,${outline})`, outlineOffset: -5 }}>
            <PhotoCrop which={which} />
          </div>
        }
        back={<StoneTile garment={garment} width={width} height={height} pad={0.07} />}
      />
    </div>
  );
};

export const S0Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 2, 8], [0, 0.75, 0], clamp);
  const punch = interpolate(frame, [0, 7], [1.05, 1], { ...clamp, easing: snap });
  const bandOut = interpolate(frame, [at("hook", 1.25), at("hook", 2.25)], [0, 1], { ...clamp, easing: appCurve });
  const camera = interpolate(frame, [0, at("hook", 8)], [1.05, 1], { ...clamp, easing: appCurve });
  const tee = bandRect(FLATLAY.tee.box, BAND_W);
  const pants = bandRect(FLATLAY.pants.box, BAND_W);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(camera) }}>
        {WARDROBE.map((w, i) => {
          const t = at("hook", 4 + i * 0.4);
          const p = interpolate(frame, [t, t + 10], [0, 1], { ...clamp, easing: snap });
          const piece = g(w.short);
          const h = 250;
          const width = 210;
          return (
            <div key={w.short} style={{ position: "absolute", left: w.x - width / 2, top: w.y - h / 2, opacity: p,
              translate: `0px ${(1 - p) * 60}px`, scale: String(0.85 + 0.15 * p), rotate: `${(i % 2 ? 3 : -3) * (1 - p)}deg` }}>
              <StoneTile garment={piece} width={width} height={h} />
            </div>
          );
        })}
        <PhotoBand width={BAND_W} hide={frame >= at("hook", 1)} style={{
          left: BAND_LEFT, top: BAND_TOP, scale: String(punch * (1 - 0.08 * bandOut)), opacity: 1 - bandOut,
          boxShadow: "0 30px 70px rgba(20,20,40,0.22)",
        }}>
          <DetectBox n={1} x={tee.x} y={tee.y} width={tee.width} height={tee.height} at={at("hook", 0.5)} />
          <DetectBox n={2} x={pants.x} y={pants.y} width={pants.width} height={pants.height} at={at("hook", 1) - 4} />
        </PhotoBand>
        {frame >= at("hook", 1) ? (<><Lifted which="pants" /><Lifted which="tee" /></>) : null}
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: flash }} />
      <Headline lines={["You own more outfits", "than you think."]} size={84} from={10} to={at("hook", 7.6)} />
      <Sfx name="shutter" at={0} volume={0.6} />
      <Sfx name="tick" at={at("hook", 0.5)} volume={0.35} />
      <Sfx name="tick2" at={at("hook", 1) - 4} volume={0.35} />
      <Sfx name="land" at={LIFT.tee.landAt - 4} volume={0.45} />
      <Sfx name="land" at={LIFT.pants.landAt - 4} volume={0.45} />
    </AbsoluteFill>
  );
};
