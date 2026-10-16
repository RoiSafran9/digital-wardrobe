import type { Tier } from "./api/types";

// Direction A — editorial light: warm paper, ink text, serif titles.
export const colors = {
  paper: "#F6F3EE",
  surface: "#FFFFFF",
  sunken: "#F0ECE5",
  ink: "#1D1B18",
  inkSoft: "#5C564D",
  muted: "#6A645A",  // 4.5:1+ on paper, surface and sunken
  line: "#E4DED4",
  lineStrong: "#CFC8BC",
  danger: "#9A3B26",
  dangerBg: "#F6E4DD",
};

// Fraunces, loaded at startup in app/_layout.tsx: a warm editorial serif for titles.
export const fonts = {
  serif: "Fraunces_400Regular",
  serifItalic: "Fraunces_400Regular_Italic",
};

export const radius = { tile: 18, pill: 999 };

export const TIER_STYLE: Record<Tier, { label: string; bg: string; fg: string }> = {
  high: { label: "Great", bg: "#E3EBDD", fg: "#3B5530" },
  medium: { label: "OK", bg: "#F3E8CF", fg: "#7A5A12" },
  low: { label: "Retake", bg: "#F6E4DD", fg: "#9A3B26" },
};

// Swatches for the closed color vocabulary the detection prompt uses.
const SWATCHES: Record<string, string> = {
  black: "#1D1B18",
  white: "#FFFFFF",
  gray: "#8C8C8C",
  navy: "#26325A",
  blue: "#3E6FB0",
  red: "#B8322A",
  pink: "#E59AB3",
  "dusty pink": "#C9A0A0",
  mint: "#A8DCC5",
  green: "#4C7A3A",
  yellow: "#E8C547",
  orange: "#DD7A2E",
  purple: "#6E4C9E",
  brown: "#7A5236",
  beige: "#DCCDB1",
};

export const COLOR_NAMES = Object.keys(SWATCHES);
export const PATTERNS = ["solid", "striped", "floral", "graphic", "plaid", "polka-dot"];

export function swatchFor(color: string): string {
  return SWATCHES[color.toLowerCase()] ?? colors.lineStrong;
}

export function asList(value: string | string[]): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => v.trim() !== "");
}

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// run_id starts with YYYYMMDD (e.g. "20261015-214623-803").
export function addedLabel(runId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(runId);
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `Added ${month} ${Number(match[3])}` : null;
}
