import { Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/BricolageGrotesque";

// KIPS Glass tokens (DESIGN.md / mobile/src/theme.ts), light appearance only.
export const colors = {
  background: "#F2F2F6",
  card: "#FFFFFF",
  tile: "#F3F2EF",
  label: "#131315",
  secondaryLabel: "#6E6E73",
  tint: "#0B5EFF",
  tintSoft: "rgba(31,107,255,0.10)",
  brandBlue: "#1F6BFF", // the blue inside the icon and wordmark files
  hanger: "#EFE8DB",
  glass: "rgba(255,255,255,0.58)",
  glassBorder: "rgba(255,255,255,0.80)",
} as const;

export const shadow = {
  // A shadow under a garment's tile, never a glow on its pixels (DESIGN.md "Elevation & Depth").
  lift: "0 18px 40px rgba(20,20,30,0.14), 0 4px 10px rgba(20,20,30,0.06)",
  tile: "0 10px 30px rgba(20,20,30,0.10)",
  card: "0 24px 60px rgba(20,20,30,0.16)",
} as const;

export const radius = { garment: 20, tile: 24, card: 30, hero: 28, pill: 999 } as const;

export const { fontFamily } = loadFont("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] });

// The app's own curve, cubic-bezier(.2,.8,.2,1), and a snappier one for cuts.
export const appCurve = Easing.bezier(0.2, 0.8, 0.2, 1);
export const snap = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
