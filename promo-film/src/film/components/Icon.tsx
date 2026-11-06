import React from "react";
import { colors } from "../theme";

// The KIPS app icon (docs/design/app-icon/kips-icon-3a-rounded.svg), drawn as vector; `inverted` adds the
// white edge used on the blue flash.
export const Icon: React.FC<{ size: number; inverted: number }> = ({ size, inverted }) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024">
    <rect width="1024" height="1024" rx="229" fill={colors.brandBlue} />
    <rect width="1024" height="1024" rx="229" fill="none" stroke={`rgba(255,255,255,${0.9 * inverted})`} strokeWidth="18" />
    <g transform="translate(133 180) scale(7.58)">
      <path d="M42 26a8 8 0 1 1 8 8v6L86 64q4 4-2 6H16q-6-2-2-6l36-24" fill="none" stroke={colors.hanger} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
);
