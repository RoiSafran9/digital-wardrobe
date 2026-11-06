import React from "react";
import { Img } from "remotion";
import { FLATLAY, g } from "../data";

// The flat-lay photo as its two real crops placed back at the scan's own boxes. The band shown is the
// tee's box height, where the two crops cover the full width — real pixels at their real positions.
export const BAND = { top: FLATLAY.tee.box.y, height: FLATLAY.tee.box.height, width: FLATLAY.image.width } as const;

/** A box in photo pixels → a rectangle inside a band rendered `width` px wide. */
export const bandRect = (box: { x: number; y: number; width: number; height: number }, width: number) => {
  const s = width / BAND.width;
  return { x: box.x * s, y: (box.y - BAND.top) * s, width: box.width * s, height: box.height * s };
};

export const PhotoCrop: React.FC<{ which: "tee" | "pants"; style?: React.CSSProperties }> = ({ which, style }) => (
  <Img src={g(FLATLAY[which].garment).crop!} style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", ...style }} />
);

export const PhotoBand: React.FC<{ width: number; hide?: boolean; style?: React.CSSProperties; children?: React.ReactNode }> = ({ width, hide, style, children }) => {
  const height = (BAND.height * width) / BAND.width;
  const tee = bandRect(FLATLAY.tee.box, width);
  const pants = bandRect(FLATLAY.pants.box, width);
  return (
    <div style={{ position: "absolute", width, height, borderRadius: 30, overflow: "hidden", background: "#d9d6cf", ...style }}>
      {hide ? null : (
        <>
          <div style={{ position: "absolute", left: pants.x, top: pants.y, width: pants.width, height: pants.height }}><PhotoCrop which="pants" /></div>
          <div style={{ position: "absolute", left: tee.x, top: tee.y, width: tee.width, height: tee.height }}><PhotoCrop which="tee" /></div>
        </>
      )}
      {children}
    </div>
  );
};
