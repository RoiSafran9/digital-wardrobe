import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { at, sceneLength, WIDTH } from "../config";
import { LOOKS, OPEN_LOOK, SWAP } from "../data";
import { GarmentImg } from "../components/Garment";
import { Headline } from "../components/Headline";
import { LookBoard } from "../components/LookBoard";
import { Sfx } from "../components/Sfx";
import { TapRipple } from "../components/TapRipple";
import { appCurve, clamp, colors, fontFamily, snap } from "../theme";
import { BOARD, BOARD_LEFT, boardPieceRect } from "./Deck";

// S6 · SWAP (bars 16–18). The third look (shirt, the flat-lay trousers, sandals). "Swap Top" offers the
// server's ranked owned alternatives; the first is the lilac tee from the very same photo. Only that one
// piece changes — and the look is now the photo's own pair, which then gathers into the app icon.

const look = LOOKS[OPEN_LOOK];
const pieces = look.pieces.map((p) => p.garment);
const slotIndex = look.pieces.findIndex((p) => p.slot === SWAP.slot);
const choice = SWAP.alternatives[0].garment;
// The current piece and the first two alternatives, in the server's order (a true prefix of the list).
const tray = [SWAP.current, ...SWAP.alternatives.slice(0, 2).map((a) => a.garment)];

const SHRINK = 0.8;
const BOARD_TOP = 500;
const TRAY = { top: 1250, height: 330, tileW: 190, tileH: 200, gap: 22 } as const;
const trayLeft = (WIDTH - (tray.length * TRAY.tileW + (tray.length - 1) * TRAY.gap)) / 2;

export const S6Swap: React.FC = () => {
  const frame = useCurrentFrame();
  const len = sceneLength("swap");
  const make = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: appCurve });
  const scale = 1 - (1 - SHRINK) * make;
  const top = BOARD.top + (BOARD_TOP - BOARD.top) * make;
  const trayIn = interpolate(frame, [4, 18], [0, 1], { ...clamp, easing: snap });
  const trayOut = interpolate(frame, [at("swap", 3.25), at("swap", 4)], [0, 1], { ...clamp, easing: appCurve });
  const tap = at("swap", 1.25);
  const flyStart = at("swap", 1.5);
  const land = at("swap", 2.75);
  const out = interpolate(frame, [flyStart, flyStart + 12], [0, 1], { ...clamp, easing: appCurve });
  const fly = interpolate(frame, [flyStart, land], [0, 1], { ...clamp, easing: appCurve });
  const swapped = frame >= land;
  const shown = pieces.map((_, i) => i !== slotIndex || frame < flyStart || swapped);
  const boardPieces = pieces.map((p, i) => (i === slotIndex && swapped ? choice : p));
  const target = boardPieceRect(pieces.length, slotIndex, scale, top);
  const fromTile = { x: trayLeft + 1 * (TRAY.tileW + TRAY.gap), y: TRAY.top + 92 };
  const settle = interpolate(frame, [land, land + 10], [0, 1], { ...clamp, easing: snap });
  const gather = interpolate(frame, [at("swap", 7), len], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      {/* The swapped look — the photo's own pair — gathers into the app icon for the brand. */}
      <AbsoluteFill style={{ scale: String(1 - 0.78 * gather), opacity: interpolate(frame, [len - 5, len], [1, 0], clamp), transformOrigin: "540px 700px" }}>
        <LookBoard pieces={boardPieces} width={BOARD.width} height={BOARD.height} shown={shown}
          pieceStyle={(i) => (i === slotIndex && swapped ? { outline: `5px solid rgba(11,94,255,${1 - settle})`, outlineOffset: -5 } : undefined)}
          style={{ left: BOARD_LEFT, top, scale: String(scale), transformOrigin: "50% 0%" }} />

        {/* The piece being replaced leaves its slot. */}
        {frame >= flyStart && out < 1 ? (
          <div style={{ position: "absolute", left: target.x, top: target.y, width: target.width, height: target.height,
            opacity: 1 - out, translate: `${-160 * out}px ${-120 * out}px`, rotate: `${-10 * out}deg` }}>
            <div style={{ position: "absolute", inset: "8%" }}><GarmentImg garment={SWAP.current} /></div>
          </div>
        ) : null}

        {/* "Swap Top": the current piece outlined, then the owned alternatives, best first. */}
        <div style={{ position: "absolute", left: 50, right: 50, top: TRAY.top, height: TRAY.height, borderRadius: 34,
          background: "rgba(255,255,255,0.86)", border: "1px solid rgba(255,255,255,0.9)", boxShadow: "0 24px 60px rgba(20,20,40,0.16)",
          translate: `0px ${(1 - trayIn) * 420 + trayOut * 760}px`, opacity: trayOut < 1 ? 1 : 0, fontFamily }}>
          <div style={{ position: "absolute", left: 36, top: 26, fontSize: 38, fontWeight: 800, letterSpacing: "-0.02em", color: colors.label }}>
            Swap Top
          </div>
        </div>
        {tray.map((garment, i) => {
          const isChoice = i === 1;
          if (isChoice && frame >= flyStart) return null;
          const x = trayLeft + i * (TRAY.tileW + TRAY.gap);
          const ring = i === 0 ? 1 : isChoice ? interpolate(frame, [tap, tap + 4], [0, 1], clamp) : 0;
          return (
            <div key={garment.id} style={{ position: "absolute", left: x, top: TRAY.top + 92, width: TRAY.tileW, height: TRAY.tileH,
              borderRadius: 20, backgroundColor: colors.tile, overflow: "hidden", outline: ring ? `5px solid rgba(11,94,255,${ring})` : undefined,
              outlineOffset: -5, translate: `0px ${(1 - trayIn) * 420 + trayOut * 760}px`, opacity: trayOut < 1 ? 1 : 0 }}>
              <div style={{ position: "absolute", inset: "8%" }}><GarmentImg garment={garment} /></div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: 1920 }}>
          <TapRipple x={`${((fromTile.x + TRAY.tileW / 2) / WIDTH) * 100}%`} y={`${((fromTile.y + TRAY.tileH / 2) / 1920) * 100}%`} at={tap} size={110} />
        </div>

        {/* The chosen piece clicks into the one slot that changes. */}
        {frame >= flyStart && !swapped ? (
          <div style={{ position: "absolute",
            left: interpolate(fly, [0, 1], [fromTile.x, target.x]), top: interpolate(fly, [0, 1], [fromTile.y, target.y]),
            width: interpolate(fly, [0, 1], [TRAY.tileW, target.width]), height: interpolate(fly, [0, 1], [TRAY.tileH, target.height]),
            borderRadius: 20, backgroundColor: colors.tile, overflow: "hidden", boxShadow: "0 24px 50px rgba(20,20,40,0.2)", zIndex: 3 }}>
            <div style={{ position: "absolute", inset: "8%" }}><GarmentImg garment={choice} /></div>
          </div>
        ) : null}

      </AbsoluteFill>
      <Headline lines={["Don't love it?", "Swap it."]} from={4} to={at("swap", 6.75)} />
      <Sfx name="click" at={tap} volume={0.6} />
      <Sfx name="land" at={land - 3} volume={0.45} />
    </AbsoluteFill>
  );
};
