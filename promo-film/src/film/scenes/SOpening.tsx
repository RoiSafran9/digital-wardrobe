import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { g, heightFactor } from "../data";
import { GarmentImg } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Icon } from "../components/Icon";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, snap } from "../theme";

export type Opening = "question" | "logo";

// OPENING (bar 0), before the flat-lay photo. Two versions:
// "logo" (the owner's choice, the main film) — the KIPS icon on the downbeat, the wordmark rising, then the shutter.
// "question" (alternate) — the owner's own clothes tumble into a heap under "Nothing to wear?"; the next scene's
//   shutter snaps the answer: the photo, "You own more outfits than you think."

// Own-photo pieces only (data.ts OWN_PHOTO); the flat-lay pair is kept back for the photo that follows.
const PILE = [
  "247440bb", "858632a0", "009d44e7", "53dd022e", "d7b9819d", "3b41f435", "7b988d90", "224b3daa", "2ceb59df",
  "93f9c85a", "33b1974b", "bcbb754e", "1fdd262c", "9317d066", "abd42b97", "b3fc5e30", "0613d692",
];

// Deterministic scatter: a loose heap around the lower middle of the frame.
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const Pile: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("opening");
  return (
    <>
      {PILE.map((short, i) => {
        const piece = g(short);
        const h = 330 * heightFactor(piece);
        const w = h * piece.aspect;
        const tx = WIDTH / 2 + (rand(i, 1) - 0.5) * 700;
        const ty = 1230 + (rand(i, 2) - 0.5) * 420 - i * 6;
        const r1 = (rand(i, 3) - 0.5) * 50;
        const start = 2 + i * 2.6;
        const p = interpolate(frame, [start, start + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.3)) });
        const settle = interpolate(frame, [len - 8, len], [1, 1.03], clamp);
        return (
          <div key={short} style={{ position: "absolute", left: tx - w / 2, top: interpolate(p, [0, 1], [-h - 120, ty - h / 2]),
            width: w, height: h, rotate: `${r1 + (1 - p) * (i % 2 ? 40 : -40)}deg`, scale: String(settle),
            filter: "drop-shadow(0 14px 18px rgba(20,20,40,0.18))" }}>
            <GarmentImg garment={piece} />
          </div>
        );
      })}
    </>
  );
};

const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("opening");
  const pop = interpolate(frame, [0, 10], [0, 1], { ...clamp, easing: snap });
  const word = interpolate(frame, [at("opening", 1), at("opening", 1) + 10], [0, 1], { ...clamp, easing: snap });
  const out = interpolate(frame, [at("opening", 3), len], [0, 1], { ...clamp, easing: appCurve });
  const ICON = 300;
  const WORD_W = 470;
  return (
    <AbsoluteFill style={{ scale: String(1 + 0.18 * out) }}>
      <div style={{ position: "absolute", left: (WIDTH - ICON) / 2, top: 640, scale: String(0.55 + 0.45 * pop), opacity: pop,
        filter: "drop-shadow(0 24px 40px rgba(31,107,255,0.30))" }}>
        <Icon size={ICON} inverted={0} />
      </div>
      <Img src={staticFile("brand/wordmark.png")} style={{ position: "absolute", left: (WIDTH - WORD_W) / 2, top: 1020, width: WORD_W,
        opacity: word, translate: `0px ${(1 - word) * 40}px` }} />
    </AbsoluteFill>
  );
};

export const SOpening: React.FC<{ variant: Opening }> = ({ variant }) =>
  variant === "logo" ? (
    <AbsoluteFill>
      <Logo />
      <Sfx name="hit" at={0} volume={0.35} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill>
      <Pile />
      <Headline lines={["Nothing to wear?"]} size={104} from={3} to={sceneLength("opening") - 1} />
      <Sfx name="whoosh" at={0} volume={0.3} />
      <Sfx name="land" at={14} volume={0.3} />
      <Sfx name="land" at={34} volume={0.3} />
      <Sfx name="land" at={50} volume={0.3} />
    </AbsoluteFill>
  );
