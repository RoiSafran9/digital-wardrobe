import { DynamicColorIOS, Platform, type ColorValue, type TextStyle } from "react-native";
import type { Tier } from "./api/types";

type Palette = {
  background: string; grouped: string; card: string; tile: string;
  label: string; secondaryLabel: string; tertiaryLabel: string;
  separator: string; separatorStrong: string; fill: string;
  tint: string; tintSoft: string; onTint: string;
  success: string; successText: string;
  destructive: string; destructiveBg: string;
  warning: string; warningText: string;
  tabBar: string; tabInactive: string;
  glass: string; glassCard: string; glassSheet: string; glassBorder: string; glassHighlight: string; glassTint: string;
};

// The KIPS Glass handoff (docs/design/design_handoff_glass_redesign): a cool grey screen with two soft
// color blobs, frosted-glass cards over it, one blue accent. Every text pair is held to 4.5:1 in both appearances (see
// __tests__/theme.test.ts). Where a handoff value failed that as text on the grey cards, the shipped
// value is the nearest darker one that passes: accent #1F6BFF → #0B5EFF, danger #E5484D → #D61E24,
// success text #23A55A → #1B7F45, warning text #C27C12 → #98610E. tertiaryLabel (#A1A1A6) fails, so it
// is only for glyphs, placeholders and disabled states — never text.
export const palettes: { light: Palette; dark: Palette } = {
  light: {
    background: "#F2F2F6", grouped: "#F4F4F2", card: "#FFFFFF", tile: "#F3F2EF",
    label: "#131315", secondaryLabel: "#6E6E73", tertiaryLabel: "#A1A1A6",
    separator: "rgba(20,20,25,0.08)", separatorStrong: "#C7C7CC", fill: "rgba(120,120,128,0.12)",
    tint: "#0B5EFF", tintSoft: "rgba(31,107,255,0.10)", onTint: "#FFFFFF",
    success: "#23A55A", successText: "#1B7F45",
    destructive: "#D61E24", destructiveBg: "#FFECEC",
    warning: "#E8A33D", warningText: "#98610E",
    tabBar: "rgba(250,250,250,0.94)", tabInactive: "#3A3A3F",
    glass: "rgba(255,255,255,0.58)", glassCard: "rgba(255,255,255,0.68)", glassSheet: "rgba(255,255,255,0.9)",
    glassBorder: "rgba(255,255,255,0.8)", glassHighlight: "rgba(255,255,255,0.9)", glassTint: "rgba(11,94,255,0.9)",
  },
  dark: {
    background: "#000000", grouped: "#1C1C1E", card: "#1C1C1E", tile: "#1B1B1D",
    label: "#F5F5F7", secondaryLabel: "#98989F", tertiaryLabel: "#636366",
    separator: "rgba(255,255,255,0.10)", separatorStrong: "#48484A", fill: "rgba(120,120,128,0.26)",
    tint: "#3D86FF", tintSoft: "rgba(61,134,255,0.18)", onTint: "#000000",
    success: "#30C26A", successText: "#30C26A",
    destructive: "#FF5A5F", destructiveBg: "#3A1D1F",
    warning: "#E8A33D", warningText: "#E8A33D",
    tabBar: "rgba(28,28,30,0.94)", tabInactive: "#C7C7CC",
    glass: "rgba(44,44,46,0.55)", glassCard: "rgba(44,44,46,0.62)", glassSheet: "rgba(36,36,38,0.92)",
    glassBorder: "rgba(255,255,255,0.12)", glassHighlight: "rgba(255,255,255,0.10)", glassTint: "rgba(61,134,255,0.9)",
  },
};

// On iOS a dynamic color follows the system appearance by itself — no re-render needed.
function adaptive(light: string, dark: string): ColorValue {
  return Platform.OS === "ios" ? DynamicColorIOS({ light, dark }) : light;
}

export const colors = Object.fromEntries(
  (Object.keys(palettes.light) as (keyof Palette)[]).map((k) => [k, adaptive(palettes.light[k], palettes.dark[k])]),
) as Record<keyof Palette, ColorValue>;

// Bricolage Grotesque, one family for everything (loaded in app/_layout.tsx). React Native picks a
// custom face by name, not by weight, so every weight is its own family: use weight(n), never a bare
// fontWeight.
export const FONT = {
  400: "BricolageGrotesque_400Regular",
  500: "BricolageGrotesque_500Medium",
  600: "BricolageGrotesque_600SemiBold",
  700: "BricolageGrotesque_700Bold",
  800: "BricolageGrotesque_800ExtraBold",
} as const;
export type Weight = keyof typeof FONT;

export function weight(w: Weight): TextStyle {
  return { fontFamily: FONT[w], fontWeight: String(w) as TextStyle["fontWeight"] };
}

const TABULAR: TextStyle["fontVariant"] = ["tabular-nums"];

// Titles: 800, tracked −0.03em, tight leading (a touch looser than the handoff's 1.04 so iOS never clips
// the tall ascenders).
function display(size: number): TextStyle {
  return { ...weight(800), fontSize: size, letterSpacing: Math.round(-0.03 * size * 100) / 100, lineHeight: Math.round(size * 1.1) };
}

// Text styles, sized per the handoff.
export const type = {
  hero: { ...display(64), fontVariant: TABULAR },
  largeTitle: display(34),
  screenTitle: display(32),
  pageTitle: display(28),
  title2: display(24),
  title3: display(21),
  section: { ...weight(700), fontSize: 22 },
  headline: { ...weight(600), fontSize: 17 },
  cardTitle: { ...weight(700), fontSize: 19 },
  body: { ...weight(400), fontSize: 17 },
  callout: { ...weight(400), fontSize: 16 },
  subhead: { ...weight(400), fontSize: 15 },
  footnote: { ...weight(400), fontSize: 13 },
  caption: { ...weight(400), fontSize: 12 },
  toast: { ...weight(600), fontSize: 14 },
  tag: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, fontFamily: "Menlo" },
  tabLabel: { ...weight(600), fontSize: 10.5 },
  eyebrow: { ...weight(600), fontSize: 13, textTransform: "uppercase", letterSpacing: 0.6 },
  balance: { ...display(54), fontVariant: TABULAR },
  stat: { ...weight(700), fontSize: 26, fontVariant: TABULAR },
  display,
} as const satisfies Record<string, TextStyle | ((size: number) => TextStyle)>;

export const radius = {
  segment: 8, input: 14, button: 14, primary: 16, image: 14, garment: 20, list: 22, tile: 24, feature: 26, hero: 28, stage: 28, sheet: 34, pill: 999,
  card: 16,  // legacy name, same as primary
};

// iOS shadows from the handoff's CSS (blur radius ≈ half the CSS blur).
export const shadow = {
  tile: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 15 },
  sheet: { shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.12, shadowRadius: 20 },
  cutout: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 5 },
  glass: { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15 },
  lift: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.13, shadowRadius: 8 },
  camera: { shadowColor: "#0B5EFF", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 13 },
} as const;

// The tab bar is a glass capsule floating 26pt above the bottom edge, its camera raised above it. Tab
// screens end their scroll this far above the bottom edge (add ~28 for breathing room).
export const TAB_BAR_HEIGHT = 122;

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
