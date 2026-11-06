import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { g, WORN } from "../data";
import { DetectBox } from "../components/DetectBox";
import { FlipCard } from "../components/FlipCard";
import { StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Pill } from "../components/Pill";
import { ScanBand } from "../components/ScanBand";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, colors, snap } from "../theme";

// S2 · OR JUST WEAR IT (bars 5–7). The worn photo the owner chose (face out of frame), the free scan and its
// three real boxes; each piece lifts out of the photo and turns into its real catalog image, and Review keeps
// all three — exactly what happened with this photo.

type Box = { x: number; y: number; width: number; height: number };

const CARD_W = 520;
const s = CARD_W / WORN.image.width;
const CARD_H = WORN.window.height * s;
const CARD_LEFT = (WIDTH - CARD_W) / 2;
const CARD_TOP = 560;

/** A box clipped to the face-free window, in photo pixels. */
const clip = (b: Box): Box => {
  const top = Math.max(b.y, WORN.window.y);
  return { x: b.x, y: top, width: b.width, height: b.y + b.height - top };
};
const inCard = (b: Box) => ({ x: b.x * s, y: (b.y - WORN.window.y) * s, width: b.width * s, height: b.height * s });

// Where each piece rests once lifted (center, height) and when it turns over (scene beats).
const REST = [
  { cx: 315, cy: 850, h: 430, rot: -3, box: 1.5, flip: 3.5 },
  { cx: 770, cy: 1010, h: 640, rot: 2, box: 1.75, flip: 3.75 },
  { cx: 330, cy: 1330, h: 200, rot: -2, box: 2, flip: 4 },
] as const;
const LIFT = [2.25, 3.25] as const;
const REVIEW = 4.75;
const AWAY = 5.75;

/** The photo itself, showing only `box` (clipped), filling a card of the given size. */
const PhotoRegion: React.FC<{ box: Box; width: number; height: number }> = ({ box, width, height }) => {
  const k = width / box.width;
  return (
    <div style={{ width, height, overflow: "hidden", position: "relative" }}>
      <Img src={WORN.photo} style={{ position: "absolute", width: WORN.image.width * k, height: WORN.image.height * k, left: -box.x * k, top: -box.y * k }} />
    </div>
  );
};

const Piece: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame();
  const piece = g(WORN.pieces[i].garment);
  const box = clip(WORN.pieces[i].box);
  const from = inCard(box);
  const rest = REST[i];
  const p = interpolate(frame, [at("outfit", LIFT[0]), at("outfit", LIFT[1])], [0, 1], { ...clamp, easing: appCurve });
  const width = interpolate(p, [0, 1], [from.width, (rest.h * box.width) / box.height]);
  const height = interpolate(p, [0, 1], [from.height, rest.h]);
  const cx = interpolate(p, [0, 1], [CARD_LEFT + from.x + from.width / 2, rest.cx]);
  const cy = interpolate(p, [0, 1], [CARD_TOP + from.y + from.height / 2, rest.cy]);
  const keep = at("outfit", REVIEW + i * 0.25);
  const keepOn = interpolate(frame, [keep, keep + 5], [0, 1], clamp);
  const awayStart = at("outfit", AWAY) + i * 4;
  const away = interpolate(frame, [awayStart, sceneLength("outfit")], [0, 1], { ...clamp, easing: appCurve });
  return (
    <div style={{ position: "absolute", left: cx - width / 2, top: cy - height / 2, rotate: `${rest.rot * p}deg`,
      translate: `0px ${-1100 * away}px`, scale: String(1 - 0.3 * away),
      filter: `drop-shadow(0 ${24 * p}px ${36 * p}px rgba(20,20,40,${0.2 * p}))` }}>
      <FlipCard width={width} height={height} at={at("outfit", rest.flip)} duration={12}
        front={<div style={{ width: "100%", height: "100%", borderRadius: 20 * p, overflow: "hidden" }}>
          <PhotoRegion box={box} width={width} height={height} /></div>}
        back={<StoneTile garment={piece} width={width} height={height} pad={0.08} />} />
      <div style={{ position: "absolute", left: "50%", top: height + 16, translate: "-50% 0px", opacity: frame >= keep ? 1 : 0 }}>
        <Pill style={{ fontSize: 26, padding: "8px 18px" }}>
          <span>Keep</span>
          <span style={{ width: 52, height: 30, borderRadius: 15, background: `rgba(35,165,90,${keepOn})`, position: "relative" }}>
            <span style={{ position: "absolute", top: 3, left: 3 + 22 * keepOn, width: 24, height: 24, borderRadius: 12, background: "#fff",
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
  const out = interpolate(frame, [at("outfit", LIFT[0]), at("outfit", LIFT[0] + 1)], [0, 1], { ...clamp, easing: appCurve });
  const pill = interpolate(frame, [at("outfit", 0.25), at("outfit", 0.75)], [0, 1], { ...clamp, easing: snap });
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: CARD_LEFT, top: CARD_TOP, width: CARD_W, height: CARD_H, borderRadius: 30, overflow: "hidden",
        boxShadow: "0 30px 70px rgba(20,20,40,0.22)", opacity: enter * (1 - out), scale: String((0.94 + 0.06 * enter) * (1 - 0.06 * out)),
        backgroundColor: colors.tile }}>
        <Img src={WORN.photo} style={{ position: "absolute", left: 0, top: -WORN.window.y * s, width: CARD_W, height: WORN.image.height * s }} />
        <ScanBand from={at("outfit", 0.25)} to={at("outfit", 1.5)} />
        {WORN.pieces.map((piece, i) => {
          const b = inCard(clip(piece.box));
          return <DetectBox key={piece.garment} n={i + 1} x={b.x} y={b.y} width={b.width} height={b.height} at={at("outfit", REST[i].box)} />;
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: CARD_TOP + CARD_H + 24, display: "flex", justifyContent: "center",
        opacity: pill * (1 - out) }}>
        <Pill>Detection is free</Pill>
      </div>
      {frame >= at("outfit", LIFT[0]) ? WORN.pieces.map((piece, i) => <Piece key={piece.garment} i={i} />).reverse() : null}
      <Headline lines={["Or just wear it."]} from={at("outfit", 0.2)} to={at("outfit", 7.6)} />
      {REST.map((r, i) => <Sfx key={i} name={i % 2 ? "tick2" : "tick"} at={at("outfit", r.box)} volume={0.3} />)}
      <Sfx name="land" at={at("outfit", 4) + 10} volume={0.35} />
      <Sfx name="click" at={at("outfit", REVIEW)} volume={0.35} />
    </AbsoluteFill>
  );
};
