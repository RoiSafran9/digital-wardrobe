import React from "react";
import type { Garment } from "../data";
import { colors, radius, shadow } from "../theme";
import { GarmentImg } from "./Garment";

// A look laid out the way the app's LookCard lays it out (mobile/src/components/outfitBuilder/LookCard.tsx):
// a white card, the first piece large on the left (flex 1.35), the rest stacked on the right, each on its
// stone tile. Separate catalog images side by side — never a composite or a person wearing them.
export const CARD_PAD = 14;
const GAP = 8;

export type Rect = { x: number; y: number; width: number; height: number };

/** Each piece's tile rectangle inside a card of the given size, in the app's collage order. */
export const collageRects = (count: number, width: number, height: number): Rect[] => {
  const w = width - CARD_PAD * 2;
  const h = height - CARD_PAD * 2;
  if (count <= 1) return [{ x: CARD_PAD, y: CARD_PAD, width: w, height: h }];
  const left = ((w - GAP) * 1.35) / 2.35;
  const right = w - GAP - left;
  const rows = count - 1;
  const rowH = (h - GAP * (rows - 1)) / rows;
  return [
    { x: CARD_PAD, y: CARD_PAD, width: left, height: h },
    ...Array.from({ length: rows }, (_, i) => ({ x: CARD_PAD + left + GAP, y: CARD_PAD + i * (rowH + GAP), width: right, height: rowH })),
  ];
};

export const PieceTile: React.FC<{ garment?: Garment; rect: Rect; style?: React.CSSProperties }> = ({ garment, rect, style }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: radius.garment,
    backgroundColor: colors.tile, overflow: "hidden", ...style }}>
    {garment ? <div style={{ position: "absolute", inset: "8%" }}><GarmentImg garment={garment} /></div> : null}
  </div>
);

export const LookBoard: React.FC<{
  pieces: Garment[];
  width: number;
  height: number;
  /** Per piece: false hides its image (the tile stays), e.g. while that piece is still flying in. */
  shown?: boolean[];
  pieceStyle?: (i: number) => React.CSSProperties | undefined;
  style?: React.CSSProperties;
}> = ({ pieces, width, height, shown, pieceStyle, style }) => {
  const rects = collageRects(pieces.length, width, height);
  return (
    <div style={{ position: "absolute", width, height, borderRadius: radius.card + 6, backgroundColor: colors.card, boxShadow: shadow.card, ...style }}>
      {pieces.map((p, i) => (
        <PieceTile key={p.id + i} garment={shown && !shown[i] ? undefined : p} rect={rects[i]} style={pieceStyle?.(i)} />
      ))}
    </div>
  );
};
