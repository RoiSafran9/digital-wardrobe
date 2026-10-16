import { DynamicColorIOS, Platform, type ColorValue } from "react-native";
import type { Tier } from "./api/types";

type Palette = {
  background: string; card: string; tile: string;
  label: string; secondaryLabel: string;
  separator: string; separatorStrong: string;
  tint: string; onTint: string;
  destructive: string; destructiveBg: string;
};

// The category standard, native iOS: grouped backgrounds, white cards, one blue tint.
// Every text pair is held to 4.5:1 in both appearances (see __tests__/theme.test.ts).
export const palettes: { light: Palette; dark: Palette } = {
  light: {
    background: "#F2F2F7", card: "#FFFFFF", tile: "#F5F5F7",
    label: "#000000", secondaryLabel: "#6C6C70",
    separator: "#E5E5EA", separatorStrong: "#C7C7CC",
    tint: "#2563EB", onTint: "#FFFFFF",
    destructive: "#D70015", destructiveBg: "#FFECEC",
  },
  dark: {
    background: "#000000", card: "#1C1C1E", tile: "#2C2C2E",
    label: "#FFFFFF", secondaryLabel: "#AEAEB2",
    separator: "#38383A", separatorStrong: "#48484A",
    tint: "#64A0FF", onTint: "#000000",
    destructive: "#FF6961", destructiveBg: "#3A1D1F",
  },
};

// On iOS a dynamic color follows the system appearance by itself — no re-render needed.
function adaptive(light: string, dark: string): ColorValue {
  return Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : light;
}

export const colors = Object.fromEntries(
  (Object.keys(palettes.light) as (keyof Palette)[]).map((k) => [k, adaptive(palettes.light[k], palettes.dark[k])]),
) as Record<keyof Palette, ColorValue>;

// iOS text styles on the system font (SF Pro).
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: 0.37 },
  title2: { fontSize: 22, fontWeight: "700" },
  headline: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 17 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption: { fontSize: 12 },
} as const;

export const radius = { card: 16, tile: 14, pill: 999 };

// Apple's minimum touch target. Small controls keep their look and get invisible slop.
export const MIN_TOUCH = 44;

export function hitSlopFor(height: number, width: number = MIN_TOUCH) {
  const v = Math.max(0, Math.ceil((MIN_TOUCH - height) / 2));
  const h = Math.max(0, Math.ceil((MIN_TOUCH - width) / 2));
  return { top: v, bottom: v, left: h, right: h };
}

export const tierPalettes: Record<"light" | "dark", Record<Tier, { bg: string; fg: string }>> = {
  light: {
    high: { bg: "#E3EBDD", fg: "#3B5530" },
    medium: { bg: "#F3E8CF", fg: "#7A5A12" },
    low: { bg: "#F6E4DD", fg: "#9A3B26" },
  },
  dark: {
    high: { bg: "#223020", fg: "#B9D4A8" },
    medium: { bg: "#362C14", fg: "#E9CD8A" },
    low: { bg: "#3B221B", fg: "#F2A48F" },
  },
};

const TIER_LABELS: Record<Tier, string> = { high: "Great", medium: "OK", low: "Retake" };

export const TIER_STYLE = Object.fromEntries(
  (["high", "medium", "low"] as Tier[]).map((t) => [t, {
    label: TIER_LABELS[t],
    bg: adaptive(tierPalettes.light[t].bg, tierPalettes.dark[t].bg),
    fg: adaptive(tierPalettes.light[t].fg, tierPalettes.dark[t].fg),
  }]),
) as Record<Tier, { label: string; bg: ColorValue; fg: ColorValue }>;

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

export function swatchFor(color: string): ColorValue {
  return SWATCHES[color.toLowerCase()] ?? colors.separatorStrong;
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
