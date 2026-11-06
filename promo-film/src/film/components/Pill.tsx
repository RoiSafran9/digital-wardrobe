import React from "react";
import { colors, fontFamily } from "../theme";

// A glass capsule label carrying the app's own words ("Detection is free", "Keep"…).
export const Pill: React.FC<{ children: React.ReactNode; ink?: boolean; style?: React.CSSProperties }> = ({ children, ink, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "14px 26px", borderRadius: 999, fontFamily, fontSize: 32,
    fontWeight: 700, letterSpacing: "-0.01em", color: ink ? "#FFFFFF" : colors.label, background: ink ? colors.label : "rgba(255,255,255,0.82)",
    border: ink ? "none" : "1px solid rgba(255,255,255,0.95)", boxShadow: "0 8px 22px rgba(20,20,40,0.10)", ...style }}>
    {children}
  </div>
);
