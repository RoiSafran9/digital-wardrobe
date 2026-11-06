import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { WORN, wornPiece } from "../data";
import { DetectBox } from "../components/DetectBox";
import { FlipCard } from "../components/FlipCard";
import { StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Pill } from "../components/Pill";
import { ScanBand } from "../components/ScanBand";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, colors, snap } from "../theme";

// S2 · OR JUST WEAR IT (bars 5–7). The owner's real mirror photo (face out of frame), the free scan and its two
// real boxes; both pieces turn into their real catalog images, and Review decides: the tee is kept, the shorts
// are not — exactly what happened with this photo.

const CARD_W = 640;
const CARD_H = (CARD_W * WORN.window.height) / WORN.image.width;
const CARD_LEFT = (WIDTH - CARD_W) / 2;
const CARD_TOP = 580;
const s = CARD_W / WORN.image.width;
const inCard = (b: { x: number; y: number; width: number; height: number }) =>
  ({ x: b.x * s, y: (b.y - WORN.window.y) * s, width: b.width * s, height: b.height * s });

const REST = {
  tee: { cx: 330, cy: 1070, h: 520, rot: -3, flip: 3.25 },
  shorts: { cx: 790, cy: 1120, h: 300, rot: 3, flip: 3.5 },
} as const;

const Piece: React.FC<{ which: "tee" | "shorts" }> = ({ which }) => {
  const frame = useCurrentFrame();
  const piece = wornPiece(which);
  const box = inCard(WORN[which].box);
  const rest = REST[which];
  const p = interpolate(frame, [at("outfit", 2), at("outfit", 3.25)], [0, 1], { ...clamp, easing: appCurve });
  const w = rest.h * piece.cropAspect!;
  const width = interpolate(p, [0, 1], [box.width, w]);
  const height = interpolate(p, [0, 1], [box.height, rest.h]);
  const cx = interpolate(p, [0, 1], [CARD_LEFT + box.x + box.width / 2, rest.cx]);
  const cy = interpolate(p, [0, 1], [CARD_TOP + box.y + box.height / 2, rest.cy]);
  // Review: the tee is kept and leaves for the closet; the shorts were not kept and drop away.
  const review = at("outfit", 4.5);
  const away = interpolate(frame, [review + 10, sceneLength("outfit")], [0, 1], { ...clamp, easing: appCurve });
  const kept = WORN[which].kept;
  const keepOn = interpolate(frame, [review, review + 5], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: cx - width / 2, top: cy - height / 2, rotate: `${rest.rot * p}deg`,
      translate: kept ? `0px ${-900 * away}px` : `0px ${260 * away}px`, opacity: kept ? 1 : 1 - away, scale: kept ? String(1 - 0.3 * away) : "1",
      filter: `drop-shadow(0 ${24 * p}px ${36 * p}px rgba(20,20,40,${0.2 * p}))` }}>
      <FlipCard width={width} height={height} at={at("outfit", rest.flip)} duration={12}
        front={<div style={{ width: "100%", height: "100%", borderRadius: 20 * p, overflow: "hidden" }}>
          <Img src={piece.crop!} style={{ width: "100%", height: "100%", objectFit: "fill" }} /></div>}
        back={<StoneTile garment={piece} width={width} height={height} pad={0.08} />} />
      <div style={{ position: "absolute", left: "50%", top: height + 22, translate: "-50% 0px", opacity: frame >= review ? 1 : 0 }}>
        <Pill style={{ fontSize: 28, padding: "10px 20px" }}>
          <span>Keep</span>
          <span style={{ width: 58, height: 34, borderRadius: 17, background: kept ? `rgba(35,165,90,${keepOn})` : "rgba(120,120,128,0.24)", position: "relative" }}>
            <span style={{ position: "absolute", top: 3, left: kept ? 3 + 24 * keepOn : 3, width: 28, height: 28, borderRadius: 14, background: "#fff",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
          </span>
        </Pill>
      </div>
    </div>
  );
};

export const S2Outfit: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 9], [0, 1], { ...clamp, easing: snap });
  const out = interpolate(frame, [at("outfit", 2), at("outfit", 3)], [0, 1], { ...clamp, easing: appCurve });
  const tee = inCard(WORN.tee.box);
  const shorts = inCard(WORN.shorts.box);
  const pill = interpolate(frame, [at("outfit", 0.25), at("outfit", 0.75)], [0, 1], { ...clamp, easing: snap });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: CARD_LEFT, top: CARD_TOP, width: CARD_W, height: CARD_H, borderRadius: 30, overflow: "hidden",
        boxShadow: "0 30px 70px rgba(20,20,40,0.22)", opacity: enter * (1 - out), scale: String((0.94 + 0.06 * enter) * (1 - 0.06 * out)),
        backgroundColor: colors.tile }}>
        <Img src={WORN.photo} style={{ position: "absolute", left: 0, top: -WORN.window.y * s, width: CARD_W, height: WORN.image.height * s }} />
        <ScanBand from={at("outfit", 0.25)} to={at("outfit", 1.5)} />
        <DetectBox n={1} x={tee.x} y={tee.y} width={tee.width} height={tee.height} at={at("outfit", 1.5)} />
        <DetectBox n={2} x={shorts.x} y={shorts.y} width={shorts.width} height={shorts.height} at={at("outfit", 1.75)} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: CARD_TOP + CARD_H + 28, display: "flex", justifyContent: "center",
        opacity: pill * (1 - out) }}>
        <Pill>Detection is free</Pill>
      </div>
      {frame >= at("outfit", 2) ? (<><Piece which="shorts" /><Piece which="tee" /></>) : null}
      <Headline lines={["Or just wear it."]} from={at("outfit", 0.2)} to={at("outfit", 7.6)} />
      <Sfx name="tick" at={at("outfit", 1.5)} volume={0.3} />
      <Sfx name="tick2" at={at("outfit", 1.75)} volume={0.3} />
      <Sfx name="land" at={at("outfit", 3.5) + 8} volume={0.35} />
      <Sfx name="click" at={at("outfit", 4.5)} volume={0.35} />
    </AbsoluteFill>
  );
};
