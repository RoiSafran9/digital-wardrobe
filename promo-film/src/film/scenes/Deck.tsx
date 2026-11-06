import React from "react";
import { interpolate } from "remotion";
import { WIDTH } from "../config";
import { LOOKS } from "../data";
import { collageRects, LookBoard, type Rect } from "../components/LookBoard";
import { clamp } from "../theme";

// The look deck's geometry, shared by S5 (assembly + swipes) and S6 (swap).
export const BOARD = { width: 760, height: 880, top: 610 } as const;
export const BOARD_LEFT = (WIDTH - BOARD.width) / 2;

/** A board piece's rectangle in film coordinates. */
export const boardPieceRect = (count: number, i: number, scale = 1, top: number = BOARD.top): Rect => {
  const r = collageRects(count, BOARD.width, BOARD.height)[i];
  const cx = WIDTH / 2;
  return {
    x: cx + (BOARD_LEFT + r.x - cx) * scale,
    y: top + r.y * scale,
    width: r.width * scale,
    height: r.height * scale,
  };
};

/**
 * The app's deck behaviour (LookDeck.tsx): the top card, two waiting behind it (lower and smaller), a swipe
 * sends the top card away and the next ones move up. `progress` = looks already swiped (0…2, continuous).
 */
export const Deck: React.FC<{ progress: number; behindOpacity: number; shown?: boolean[] }> = ({ progress, behindOpacity, shown }) => {
  const order = LOOKS.map((look, k) => ({ look, k, rel: k - progress })).filter((c) => c.rel > -1).sort((a, b) => b.rel - a.rel);
  return (
    <>
      {order.map(({ look, k, rel }) => {
        const leaving = rel < 0;
        const depth = Math.max(0, rel);
        return (
          <LookBoard key={k} pieces={look.pieces.map((p) => p.garment)} width={BOARD.width} height={BOARD.height}
            shown={k === 0 ? shown : undefined}
            style={{
              left: BOARD_LEFT,
              top: BOARD.top + 30 * depth,
              scale: String(1 - 0.05 * depth),
              transformOrigin: "50% 100%",
              translate: leaving ? `${rel * 1250}px ${rel * -60}px` : undefined,
              rotate: leaving ? `${rel * 14}deg` : undefined,
              opacity: depth > 0 ? behindOpacity * interpolate(depth, [0, 2], [1, 0.85], clamp) : 1,
            }} />
        );
      })}
    </>
  );
};
