import React from "react";
import { Img } from "remotion";
import type { Garment } from "../data";
import { colors, radius, shadow } from "../theme";

// A garment image exactly as the app stores it: contained, never cropped, tinted, filtered or glowed.
export const GarmentImg: React.FC<{ garment: Garment; style?: React.CSSProperties }> = ({ garment, style }) => (
  <Img src={garment.src} style={{ width: "100%", height: "100%", objectFit: "contain", ...style }} />
);

// The stone tile every garment sits on (DESIGN.md: tile #F3F2EF, a lift shadow under the tile and a
// 2pt white border on fans), with the piece contained inside it.
export const StoneTile: React.FC<{
  garment?: Garment;
  width: number;
  height: number;
  pad?: number;
  r?: number;
  border?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ garment, width, height, pad = 0.09, r = radius.tile, border = true, style, children }) => (
  <div
    style={{
      width,
      height,
      borderRadius: r,
      backgroundColor: colors.tile,
      boxShadow: shadow.lift,
      border: border ? "3px solid #FFFFFF" : undefined,
      boxSizing: "border-box",
      overflow: "hidden",
      position: "relative",
      ...style,
    }}
  >
    {garment ? (
      <div style={{ position: "absolute", inset: `${pad * 100}%` }}>
        <GarmentImg garment={garment} />
      </div>
    ) : null}
    {children}
  </div>
);
