import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { ANSWERS, closet, g, LOOKS, OWN_PHOTO } from "../data";
import { GarmentImg, StoneTile } from "../components/Garment";
import { Headline } from "../components/Headline";
import { Pill } from "../components/Pill";
import { Sfx } from "../components/Sfx";
import { appCurve, clamp, colors, fontFamily, snap } from "../theme";
import { boardPieceRect, Deck } from "./Deck";

// S5 · BUILD MY LOOK (bars 10.5–16), the film's payoff. The five real questions with the answers given
// (the app's own copy), "Putting your looks together…" as the closet gathers; then the closet bursts and the
// engine's first look assembles from those very pieces, and the deck swipes through all three real looks.

const QUESTIONS = [
  { q: "What are you dressing for?", a: ANSWERS[0], at: 0 },
  { q: "Which style feels right?", a: ANSWERS[1], at: 1.8 },
  { q: "What's the vibe?", a: ANSWERS[2], at: 3.6 },
  { q: "What's the weather like?", a: ANSWERS[3], at: 5.4 },
  { q: "Any colors in mind?", a: ANSWERS[4], at: 7.2 },
];
const ASSEMBLE = 10; // the scene's beat 10 — film bar 13's downbeat, right after the track's bar-13 fill
const LAND_GAP = 5;

const first = LOOKS[0].pieces.map((p) => p.garment);
const others = closet.filter((c) => !first.some((f) => f.id === c.id) && OWN_PHOTO.has(c.short)).slice(0, 12);

// Burst positions around the center, deterministic (golden angle), then each tile's way out.
const CENTER = { x: WIDTH / 2, y: 1060 };
const burst = (i: number, n: number) => {
  const a = i * 2.39996 + 0.6;
  const r = 300 + 170 * ((i * 7) % n) / n;
  return { x: CENTER.x + Math.cos(a) * r * 1.05, y: CENTER.y + Math.sin(a) * r * 1.25, a };
};

// Three of the owner's pieces floating under the questions (the Home card's own motif, Float: −8pt over
// 2.6 s, staggered), joining the gather when the looks are put together.
const FLOAT = [
  { short: "1fdd262c", x: 240, y: 1120, h: 330 },
  { short: "344468a5", x: 560, y: 1060, h: 480 },
  { short: "1b187a9d", x: 850, y: 1230, h: 170 },
];
const Floating: React.FC<{ gather: number }> = ({ gather }) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [at("looks", 0.25), at("looks", 1)], [0, 1], { ...clamp, easing: snap });
  return (
    <>
      {FLOAT.map((f, i) => {
        const piece = g(f.short);
        const w = f.h * piece.aspect;
        const bob = Math.sin(((frame - i * 9) / (2.6 * 30)) * Math.PI) * 8;
        const x = f.x + (CENTER.x - f.x) * gather;
        const y = f.y + (CENTER.y - f.y) * gather;
        return (
          <div key={f.short} style={{ position: "absolute", left: x - w / 2, top: y - f.h / 2 + bob, width: w, height: f.h,
            opacity: enter * (1 - gather), scale: String((0.9 + 0.1 * enter) * (1 - 0.6 * gather)) }}>
            <GarmentImg garment={piece} />
            <div style={{ position: "absolute", left: "15%", right: "15%", bottom: -18, height: 22, borderRadius: "50%",
              background: "radial-gradient(closest-side, rgba(20,20,40,0.18), rgba(20,20,40,0))" }} />
          </div>
        );
      })}
    </>
  );
};

const Question: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const q = QUESTIONS[index];
  const start = at("looks", q.at);
  const end = index < QUESTIONS.length - 1 ? at("looks", QUESTIONS[index + 1].at) : at("looks", 9);
  if (frame < start - 1 || frame > end + 8) return null;
  const inP = interpolate(frame, [start, start + 9], [0, 1], { ...clamp, easing: snap });
  const outP = interpolate(frame, [end - 2, end + 6], [0, 1], { ...clamp, easing: appCurve });
  const answer = at("looks", q.at + 0.9);
  const aP = interpolate(frame, [answer, answer + 7], [0, 1], { ...clamp, easing: snap });
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 260, fontFamily, opacity: inP * (1 - outP),
      translate: `0px ${(1 - inP) * 60 - outP * 80}px` }}>
      <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: 0.5, color: colors.secondaryLabel }}>{`Build My Look · ${index + 1} of 5`}</div>
      <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.04, color: colors.label, marginTop: 14 }}>{q.q}</div>
      <div style={{ marginTop: 44, display: "inline-flex", padding: "22px 40px", borderRadius: 999, backgroundColor: colors.label, color: "#FFFFFF",
        fontSize: 56, fontWeight: 700, letterSpacing: "-0.015em", opacity: aP, scale: String(0.75 + 0.25 * aP), transformOrigin: "0% 50%" }}>{q.a}</div>
    </div>
  );
};

export const S5Looks: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("looks");
  const A = at("looks", ASSEMBLE);
  const G = at("looks", 9); // "Putting your looks together…"
  const gather = interpolate(frame, [G, A], [0, 1], { ...clamp, easing: appCurve });
  const waitText = interpolate(frame, [G, G + 6, A - 4, A + 2], [0, 1, 1, 0], clamp);
  const boardIn = interpolate(frame, [A + 6, A + 18], [0, 1], { ...clamp, easing: snap });
  const landAt = (k: number) => A + 16 + k * LAND_GAP + 12;
  const shown = first.map((_, k) => frame >= landAt(k));
  const swipe1 = interpolate(frame, [at("looks", 14), at("looks", 14.75)], [0, 1], { ...clamp, easing: appCurve });
  const swipe2 = interpolate(frame, [at("looks", 15.5), at("looks", 16.25)], [0, 1], { ...clamp, easing: appCurve });
  const behind = interpolate(frame, [at("looks", 13.25), at("looks", 13.75)], [0, 1], clamp);
  const summary = interpolate(frame, [at("looks", 12.5), at("looks", 13)], [0, 1], { ...clamp, easing: snap });
  const all = [...first, ...others];
  return (
    <AbsoluteFill>
      {QUESTIONS.map((q, i) => <Question key={q.q} index={i} />)}
      <Floating gather={gather} />

      {/* "Putting your looks together…": the closet gathers in from the edges toward the center. */}
      {frame >= G && frame < A
        ? all.map((garment, i) => {
            const b = burst(i, all.length);
            const far = { x: CENTER.x + Math.cos(b.a) * 900, y: CENTER.y + Math.sin(b.a) * 1100 };
            const x = far.x + (CENTER.x - far.x) * gather;
            const y = far.y + (CENTER.y - far.y) * gather;
            return (
              <div key={garment.id + i} style={{ position: "absolute", left: x - 60, top: y - 66, rotate: `${(1 - gather) * 40 * (i % 2 ? 1 : -1)}deg`,
                scale: String(1 - 0.5 * gather) }}>
                <StoneTile garment={garment} width={120} height={132} r={18} border={false} />
              </div>
            );
          })
        : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1420, textAlign: "center", fontFamily, fontSize: 40, fontWeight: 600,
        color: colors.secondaryLabel, opacity: waitText }}>Putting your looks together…</div>

      {/* The deck: board 1 assembles, then the real three looks swipe through. */}
      {frame >= A + 6 ? (
        <div style={{ position: "absolute", inset: 0, opacity: boardIn, scale: String(0.9 + 0.1 * boardIn) }}>
          <Deck progress={swipe1 + swipe2} behindOpacity={behind} shown={shown} />
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 80, top: 486, opacity: summary, translate: `0px ${(1 - summary) * 16}px` }}>
        <Pill style={{ fontSize: 30, padding: "12px 24px" }}>{ANSWERS.join(" · ")}</Pill>
      </div>

      {/* The burst: the closet flies out from the center; look 1's own pieces fly into their places. */}
      {frame >= A && frame < landAt(first.length - 1) + 2
        ? all.map((garment, i) => {
            const b = burst(i, all.length);
            const out = interpolate(frame, [A, A + 16], [0, 1], { ...clamp, easing: snap });
            const isLook = i < first.length;
            const tileW = 170;
            const tileH = 190;
            let x = CENTER.x + (b.x - CENTER.x) * out;
            let y = CENTER.y + (b.y - CENTER.y) * out;
            let w = tileW;
            let h = tileH;
            let opacity = Math.min(1, out * 3);
            if (isLook) {
              if (frame >= landAt(i)) return null;
              const start = A + 16 + i * LAND_GAP;
              const f = interpolate(frame, [start, landAt(i)], [0, 1], { ...clamp, easing: appCurve });
              const target = boardPieceRect(first.length, i);
              x = interpolate(f, [0, 1], [x, target.x + target.width / 2]);
              y = interpolate(f, [0, 1], [y, target.y + target.height / 2]);
              w = interpolate(f, [0, 1], [tileW, target.width]);
              h = interpolate(f, [0, 1], [tileH, target.height]);
            } else {
              const leave = interpolate(frame, [A + 18, A + 34], [0, 1], { ...clamp, easing: appCurve });
              x += Math.cos(b.a) * 700 * leave;
              y += Math.sin(b.a) * 700 * leave;
              opacity *= 1 - leave;
            }
            return (
              <div key={garment.id + i} style={{ position: "absolute", left: x - w / 2, top: y - h / 2, opacity, zIndex: isLook ? 2 : 1 }}>
                {isLook ? (
                  <div style={{ width: w, height: h, borderRadius: 20, backgroundColor: colors.tile, overflow: "hidden", position: "relative",
                    boxShadow: "0 18px 40px rgba(20,20,30,0.16)" }}>
                    <div style={{ position: "absolute", inset: "8%" }}><GarmentImg garment={garment} /></div>
                  </div>
                ) : (
                  <StoneTile garment={garment} width={w} height={h} r={20} />
                )}
              </div>
            );
          })
        : null}

      <Headline lines={["Build My Look"]} size={112} sub="Made with clothes you already own." from={A + 2} to={len - 3} />
      <Sfx name="whoosh" at={A - 4} volume={0.45} />
      {first.map((_, k) => <Sfx key={k} name="land" at={landAt(k) - 3} volume={0.4} />)}
      {QUESTIONS.map((q) => <Sfx key={q.q} name="tick" at={at("looks", q.at + 0.9)} volume={0.25} />)}
      <Sfx name="swipe" at={at("looks", 14)} volume={0.35} />
      <Sfx name="swipe" at={at("looks", 15.5)} volume={0.35} />
    </AbsoluteFill>
  );
};
