# Home Screen + Native iOS Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editorial look with a native iOS "category standard" world, add a default Home tab (running garments, stats, quick add, just added, categories), and carry purposeful motion through the app.

**Architecture:** One semantic token set (light/dark via `DynamicColorIOS`) and an iOS type scale in `src/theme.ts`; a small motion kit (`Rise`, `PressScale`, `Marquee`, `CountUp`) on React Native `Animated` with the native driver; capture logic extracted into `useCapture` so Home and Add share it; pure `closetStats()` feeds Home.

**Tech Stack:** Expo SDK 57, React Native 0.86, expo-router tabs, TypeScript, Jest (`jest-expo`) + `@testing-library/react-native`, `expo-haptics`.

**Spec:** `docs/superpowers/specs/2026-10-16-home-and-native-redesign-design.md`

**Spec adjustment (deliberate):** the spec names react-native-reanimated for motion. This plan uses React Native's `Animated` with `useNativeDriver: true` instead: transform/opacity animations run on the UI thread the same way, the app already uses it, it needs no Babel plugin, and it works in Jest without a mock layer. Reanimated stays available if a later gesture-driven feature needs it.

## Global Constraints

- All work is in `mobile/`. Run commands from `mobile/`.
- Install native packages only with `npx expo install <pkg> -- --legacy-peer-deps` (the project has a pre-existing react-dom peer conflict).
- Every color comes from `src/theme.ts`; no hex literals in components except fixed garment-swatch colors.
- Every text/background pair used for text must be ≥ 4.5:1 in **both** palettes (enforced by `__tests__/theme.test.ts`).
- Touch targets ≥ 44pt (use `hitSlopFor` from `src/theme.ts` for smaller visuals).
- Motion: only `transform` and `opacity`, `useNativeDriver: true`; every animated component honors `useReducedMotion()` (fades only, no movement, marquee and count-up static).
- Garment images are never tinted, filtered or recolored.
- Typography is the system font (SF Pro); no custom font loading after Task 1.
- Sentence-case UI copy; product name in titles is "Wardrobe".
- After each task: `npx jest` passes and `npx tsc --noEmit` exits 0.

## Review Focus

1. **Empty closet on Home** (0 items): Home must show a friendly empty state with both add buttons, not empty marquee rows or "0 / 0 / 0" tiles alone — tested in Task 5.
2. **Home can't reach the server** (getItems rejects): Home shows the readable error and a retry, still offers adding — tested in Task 5.
3. **Few garments for the marquee** (1–3 items): rows must not show blank gaps or duplicate-looking jumps; items repeat to fill — tested in Task 3 (`Marquee` repeats content to at least 2× width).
4. **Reduce Motion on**: marquee does not move and counters show the final number immediately — tested in Tasks 3 and 4.
5. **Category with odd casing/whitespace** ("t-shirt", "T-Shirt ", "") from Home chips into Closet filter: filtering must match the Closet's own `categoryOf` normalization — tested in Task 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/theme.ts` (modify) | Semantic native palette (light/dark), `type` scale, radii, `hitSlopFor`, tier styles, swatches |
| `src/motion/Rise.tsx` (create) | Entrance: fade + rise 12pt, optional delay; replaces `FadeIn` |
| `src/motion/PressScale.tsx` (create) | Pressable wrapper: 0.97 press-in, spring release |
| `src/motion/Marquee.tsx` (create) | Endless horizontal drift of children; pause on touch; static under Reduce Motion |
| `src/motion/CountUp.tsx` (create) | Number that counts up once; final value under Reduce Motion |
| `src/closetStats.ts` (create) | Pure stats: pieces, categories (with counts), colors, added this week |
| `src/categories.ts` (create) | `categoryOf(item)` normalization shared by Home and Closet |
| `src/useCapture.ts` (create) | Pick → upload → set last run → navigate; loading/error state |
| `src/haptics.ts` (create) | `success()` / `light()` wrappers around expo-haptics, no-ops if unavailable |
| `app/index.tsx` (replace) | **Home** screen |
| `app/add.tsx` (create) | Add screen (old capture UI, restyled), uses `useCapture` |
| `app/closet.tsx` (modify) | Restyle, `category` route param, uses `categoryOf`, motion kit |
| `app/_layout.tsx` (modify) | Tabs Home · Closet · Add, no font loading |
| `src/components/*` (modify) | Restyle to tokens/type; `FadeIn` removed; ItemSheet grouped list + segmented Front/Back |
| `__tests__/*` | New tests per task; renamed expectations where copy changes |

---

### Task 1: Native token set and type scale

**Files:**
- Modify: `src/theme.ts`
- Modify: every file under `app/`, `src/`, `__tests__/` that references old color keys (mechanical rename)
- Modify: `app/_layout.tsx` (drop Fraunces), `package.json` (remove `@expo-google-fonts/fraunces`)
- Test: `__tests__/theme.test.ts`

**Interfaces:**
- Produces: `colors.{background, card, tile, label, secondaryLabel, separator, separatorStrong, tint, onTint, destructive, destructiveBg}` (ColorValue), `palettes.{light,dark}` (same keys, hex strings), `type.{largeTitle,title2,headline,body,subhead,footnote,caption}` (TextStyle), `radius.{card:16, tile:14, pill:999}`, unchanged `hitSlopFor`, `TIER_STYLE`, `tierPalettes`, `swatchFor`, `asList`, `capitalize`, `addedLabel`, `COLOR_NAMES`, `PATTERNS`.

- [ ] **Step 1: Write the failing contrast test for the new palette**

Replace the `PAIRS` block in `__tests__/theme.test.ts` with:

```ts
const PAIRS = [
  ["label", "background"], ["label", "card"], ["label", "tile"],
  ["secondaryLabel", "background"], ["secondaryLabel", "card"], ["secondaryLabel", "tile"],
  ["tint", "background"], ["tint", "card"],
  ["destructive", "card"], ["destructive", "destructiveBg"],
  ["onTint", "tint"],
] as const;
```

Keep the existing `describe.each(["light", "dark"])` loop that checks `contrast(palettes[mode][fg], palettes[mode][bg]) >= 4.5` and the tier-badge test. Add:

```ts
test("type scale follows iOS text styles", () => {
  const { type } = require("../src/theme");
  expect(type.largeTitle).toEqual({ fontSize: 34, fontWeight: "700", letterSpacing: 0.37 });
  expect(type.body).toEqual({ fontSize: 17 });
  expect(type.footnote).toEqual({ fontSize: 13 });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/theme.test.ts`
Expected: FAIL (`palettes.light.label` undefined, `type` undefined).

- [ ] **Step 3: Replace the palette, add the type scale and radii**

In `src/theme.ts` replace the `Palette` type, `palettes`, the `fonts` export and `radius` with:

```ts
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
```

Keep `adaptive()`, `colors`, `MIN_TOUCH`, `hitSlopFor`, `tierPalettes`, `TIER_STYLE`, swatches and helpers as they are. Delete the `fonts` export.

- [ ] **Step 4: Rename old keys everywhere (mechanical)**

Run from `mobile/`:

```bash
for f in $(grep -rlE "colors\.(paper|surface|sunken|ink|inkSoft|muted|line|lineStrong|danger|dangerBg)\b|palettes\.(light|dark)\.ink" app src __tests__); do
  sed -i '' -E \
    -e 's/colors\.inkSoft\b/colors.secondaryLabel/g' \
    -e 's/colors\.lineStrong\b/colors.separatorStrong/g' \
    -e 's/colors\.dangerBg\b/colors.destructiveBg/g' \
    -e 's/colors\.paper\b/colors.background/g' \
    -e 's/colors\.surface\b/colors.card/g' \
    -e 's/colors\.sunken\b/colors.tile/g' \
    -e 's/colors\.muted\b/colors.secondaryLabel/g' \
    -e 's/colors\.line\b/colors.separator/g' \
    -e 's/colors\.danger\b/colors.destructive/g' \
    -e 's/colors\.ink\b/colors.label/g' \
    -e 's/palettes\.light\.ink\b/palettes.light.label/g' "$f"
done
grep -rnE "colors\.(paper|surface|sunken|ink|inkSoft|muted|line|lineStrong|danger|dangerBg)\b" app src __tests__ || echo "rename complete"
```

Expected: `rename complete`.

- [ ] **Step 5: Remove the serif font**

Replace every `fontFamily: fonts.serif` / `fontFamily: fonts.serifItalic` with nothing and drop `fonts` from theme imports:

```bash
grep -rlE "fonts\.serif" app src | xargs sed -i '' -E -e 's/fontFamily: fonts\.serifItalic, ?//g' -e 's/fontFamily: fonts\.serif, ?//g'
grep -rlE "import \{[^}]*\bfonts\b" app src | xargs sed -i '' -E -e 's/, fonts\b//; s/\bfonts, //'
grep -rn "fonts\." app src || echo "serif removed"
```

In `app/_layout.tsx` delete the `useFonts` import line and these lines:

```tsx
  const [fontsLoaded] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic });
  if (!fontsLoaded) {
    return null;  // a blink at launch beats titles reflowing from a fallback face
  }
```

Then: `npm uninstall @expo-google-fonts/fraunces --legacy-peer-deps`

In `src/components/GarmentImage.tsx` change the tile default to `tile = colors.tile` and the radius to `radius.tile`.

- [ ] **Step 6: Run tests and typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites pass, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A mobile
git commit -m "feat(design): native iOS token set and type scale, drop Fraunces"
```

---

### Task 2: Motion kit — `Rise` and `PressScale`

**Files:**
- Create: `src/motion/Rise.tsx`, `src/motion/PressScale.tsx`
- Delete: `src/components/FadeIn.tsx`, `__tests__/FadeIn.test.tsx` (replaced)
- Modify: imports of `FadeIn` in `app/closet.tsx`, `src/components/ItemSheet.tsx`, `src/components/PillButton.tsx`
- Test: `__tests__/motion.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion()` from `src/useReducedMotion.ts`
- Produces: `Rise({children, delay?=0, distance?=12, style?, testID?})`, `PressScale({children, onPress, disabled?, style?, testID?, accessibilityLabel?, accessibilityRole?, hitSlop?})`, `EASE_OUT` (Easing) exported from `src/motion/Rise.tsx`.

- [ ] **Step 1: Write the failing tests**

`__tests__/motion.test.tsx`:

```tsx
import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Rise } from "../src/motion/Rise";
import { PressScale } from "../src/motion/PressScale";

afterEach(() => jest.restoreAllMocks());

test("Rise renders its content", () => {
  render(<Rise><Text>Hello</Text></Rise>);
  expect(screen.getByText("Hello")).toBeTruthy();
});

test("Rise drops movement under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<Rise testID="r"><Text>Hi</Text></Rise>);
  await waitFor(() =>
    expect(screen.getByTestId("r").props.style).toEqual(expect.objectContaining({ transform: [{ translateY: 0 }] }))
  );
});

test("PressScale calls onPress and exposes its role", () => {
  const onPress = jest.fn();
  render(<PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Open"><Text>x</Text></PressScale>);
  fireEvent.press(screen.getByRole("button", { name: "Open" }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/motion.test.tsx`
Expected: FAIL, cannot find module `../src/motion/Rise`.

- [ ] **Step 3: Implement**

`src/motion/Rise.tsx`:

```tsx
import React, { useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// Strong ease-out: moves at once, settles softly.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

type Props = { children: React.ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>; testID?: string };

// Content rises into place. Starts nearly visible (opacity 0.4), never from nothing.
export function Rise({ children, delay = 0, distance = 12, style, testID }: Props) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(t, { toValue: 1, duration: 320, delay, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);
  const move = reduced ? 0 : distance;
  return (
    <Animated.View
      testID={testID}
      style={[style, {
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [{ translateY: move ? t.interpolate({ inputRange: [0, 1], outputRange: [move, 0] }) : 0 }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
```

`src/motion/PressScale.tsx`:

```tsx
import React, { useRef } from "react";
import { Animated, Pressable, type AccessibilityRole, type Insets, type StyleProp, type ViewStyle } from "react-native";
import { EASE_OUT } from "./Rise";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  hitSlop?: Insets;
};

// Every tappable card: lands at 0.97 in 100ms, springs back with only a hint of bounce.
export function PressScale({ children, onPress, disabled, style, testID, accessibilityLabel, accessibilityRole, hitSlop }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 100, easing: EASE_OUT, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, speed: 30, bounciness: 4, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
```

Replace `FadeIn` usages:
- `app/closet.tsx`: `import { FadeIn } from "../src/components/FadeIn";` → `import { Rise } from "../src/motion/Rise";`; `<FadeIn delay={Math.min(index, 8) * 40} offset={8} duration={260} style={{ flex: 1 / 2 }}>` → `<Rise delay={Math.min(index, 8) * 30} style={{ flex: 1 / 2 }}>`; `</FadeIn>` → `</Rise>`.
- `src/components/ItemSheet.tsx`: import `Rise` from `../motion/Rise`; `<FadeIn key={side} scaleFrom={0.98} duration={200}>` → `<Rise key={side} distance={0}>`; `<FadeIn duration={180}>` → `<Rise distance={0}>`; closing tags → `</Rise>`.
- `src/components/PillButton.tsx`: `import { EASE_OUT } from "./FadeIn";` → `import { EASE_OUT } from "../motion/Rise";`.

Then delete the old files: `git rm src/components/FadeIn.tsx __tests__/FadeIn.test.tsx`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A mobile
git commit -m "feat(motion): Rise and PressScale primitives replace FadeIn"
```

---

### Task 3: Motion kit — `Marquee`

**Files:**
- Create: `src/motion/Marquee.tsx`
- Test: `__tests__/marquee.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion()`
- Produces: `Marquee({items: T[], renderItem: (item: T, i: number) => ReactNode, itemWidth: number, gap?: number = 10, speed?: number = 18 /* pt/s */, reverse?: boolean, testID?: string})`

- [ ] **Step 1: Write the failing tests**

`__tests__/marquee.test.tsx`:

```tsx
import React from "react";
import { AccessibilityInfo, Text } from "react-native";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Marquee } from "../src/motion/Marquee";

afterEach(() => jest.restoreAllMocks());

test("repeats a short list so the row never shows a gap", () => {
  render(<Marquee items={["a"]} itemWidth={100} renderItem={(x, i) => <Text key={i}>{x}</Text>} />);
  // 1 item at 100pt + gap must still cover two widths of a 390pt screen.
  expect(screen.getAllByText("a").length).toBeGreaterThanOrEqual(8);
});

test("renders nothing for an empty list", () => {
  render(<Marquee items={[]} itemWidth={100} renderItem={(x: string) => <Text>{x}</Text>} testID="m" />);
  expect(screen.queryByTestId("m")).toBeNull();
});

test("stays still under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<Marquee items={["a", "b"]} itemWidth={100} renderItem={(x, i) => <Text key={i}>{x}</Text>} testID="m" />);
  await waitFor(() =>
    expect(screen.getByTestId("m-track").props.style).toEqual(expect.objectContaining({ transform: [{ translateX: 0 }] }))
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/marquee.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/motion/Marquee.tsx`:

```tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

type Props<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemWidth: number;
  gap?: number;
  speed?: number;      // points per second; slow on purpose
  reverse?: boolean;
  testID?: string;
};

// An endless, slow drift of garments. The list is repeated until one copy is wider than the
// screen, then doubled so the loop wraps seamlessly. Touch pauses it; Reduce Motion keeps it still.
export function Marquee<T>({ items, renderItem, itemWidth, gap = 10, speed = 18, reverse, testID }: Props<T>) {
  const { width: screen } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const x = useRef(new Animated.Value(0)).current;

  const unit = itemWidth + gap;
  const copies = items.length ? Math.max(1, Math.ceil(screen / (unit * items.length))) : 0;
  const one = useMemo(() => Array.from({ length: copies }, () => items).flat(), [items, copies]);
  const span = one.length * unit;

  useEffect(() => {
    if (reduced || paused || !span) return;
    x.setValue(reverse ? -span : 0);
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: reverse ? 0 : -span,
        duration: (span / speed) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, span, speed, reverse, reduced, paused]);

  if (!items.length) return null;
  const track = [...one, ...one];
  return (
    <Pressable testID={testID} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} style={{ overflow: "hidden" }}>
      <Animated.View
        testID={testID ? `${testID}-track` : "marquee-track"}
        style={{ flexDirection: "row", gap, transform: [{ translateX: reduced ? 0 : x }] }}
      >
        {track.map((item, i) => (
          <View key={i} style={{ width: itemWidth }}>{renderItem(item, i % items.length)}</View>
        ))}
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/marquee.test.tsx && npx tsc --noEmit`
Expected: 3 passed, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/motion/Marquee.tsx mobile/__tests__/marquee.test.tsx
git commit -m "feat(motion): Marquee for the running garment rows"
```

---

### Task 4: `CountUp`, `closetStats`, `categoryOf`

**Files:**
- Create: `src/motion/CountUp.tsx`, `src/closetStats.ts`, `src/categories.ts`
- Modify: `app/closet.tsx` (use shared `categoryOf`)
- Test: `__tests__/countUp.test.tsx`, `__tests__/closetStats.test.ts`

**Interfaces:**
- Produces:
  - `CountUp({value: number, duration?: number = 600, style?: StyleProp<TextStyle>, testID?})`
  - `categoryOf(item: {facts: ItemFacts}): string` — first category value, trimmed, capitalized; `"Other"` when empty
  - `closetStats(items: ClosetItem[], now: Date): { pieces: number; categories: {name: string; count: number}[]; colors: number; addedThisWeek: number }` — categories sorted by count desc then name; colors = distinct lowercase color names; addedThisWeek = items whose `run_id` date (YYYYMMDD prefix) is within 7 days before `now`

- [ ] **Step 1: Write the failing tests**

`__tests__/closetStats.test.ts`:

```ts
import { closetStats } from "../src/closetStats";
import { categoryOf } from "../src/categories";

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (run: string, cat: string | string[], colors: string[]) => ({
  run_id: run, photo_name: "p", item_id: "item_0", tier: "high" as const,
  facts: { category: f(cat), colors: f(colors), pattern: f("solid"), visible_text: f(""), trims: f(""),
           visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "", generated_url: "",
});

test("categoryOf normalizes casing and whitespace, falls back to Other", () => {
  expect(categoryOf(item("20261016-1", "t-shirt ", []))).toBe("T-shirt");
  expect(categoryOf(item("20261016-1", ["shorts"], []))).toBe("Shorts");
  expect(categoryOf(item("20261016-1", "", []))).toBe("Other");
});

test("counts pieces, categories, colors and this week's additions", () => {
  const now = new Date(2026, 9, 16);
  const s = closetStats([
    item("20261016-100000", "t-shirt", ["gray", "black"]),
    item("20261015-100000", "T-shirt", ["Navy"]),
    item("20261001-100000", "shorts", ["navy"]),
  ], now);
  expect(s.pieces).toBe(3);
  expect(s.categories).toEqual([{ name: "T-shirt", count: 2 }, { name: "Shorts", count: 1 }]);
  expect(s.colors).toBe(3);           // gray, black, navy
  expect(s.addedThisWeek).toBe(2);
});

test("an empty closet is all zeros", () => {
  expect(closetStats([], new Date())).toEqual({ pieces: 0, categories: [], colors: 0, addedThisWeek: 0 });
});
```

`__tests__/countUp.test.tsx`:

```tsx
import React from "react";
import { AccessibilityInfo } from "react-native";
import { render, screen, act, waitFor } from "@testing-library/react-native";
import { CountUp } from "../src/motion/CountUp";

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test("lands on the final value", async () => {
  jest.useFakeTimers();
  render(<CountUp value={38} testID="c" />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTestId("c")).toHaveTextContent("38");
});

test("shows the final value at once under Reduce Motion", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  render(<CountUp value={12} testID="c" />);
  await waitFor(() => expect(screen.getByTestId("c")).toHaveTextContent("12"));
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/closetStats.test.ts __tests__/countUp.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

`src/categories.ts`:

```ts
import type { ItemFacts } from "./api/types";
import { asList, capitalize } from "./theme";

// One normalization for every place that groups or filters by category.
export function categoryOf(item: { facts: ItemFacts }): string {
  const raw = (asList(item.facts.category.value)[0] ?? "").trim().toLowerCase();
  return raw ? capitalize(raw) : "Other";
}
```

`src/closetStats.ts`:

```ts
import type { ClosetItem } from "./api/types";
import { categoryOf } from "./categories";
import { asList } from "./theme";

export type ClosetStats = {
  pieces: number;
  categories: { name: string; count: number }[];
  colors: number;
  addedThisWeek: number;
};

function runDate(runId: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(runId);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function closetStats(items: ClosetItem[], now: Date): ClosetStats {
  const counts = new Map<string, number>();
  const colors = new Set<string>();
  const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  let addedThisWeek = 0;
  for (const item of items) {
    const name = categoryOf(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
    asList(item.facts.colors.value).forEach((c) => colors.add(c.trim().toLowerCase()));
    const d = runDate(item.run_id);
    if (d && d > weekAgo && d <= now) addedThisWeek += 1;
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { pieces: items.length, categories, colors: colors.size, addedThisWeek };
}
```

`src/motion/CountUp.tsx`:

```tsx
import React, { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useReducedMotion } from "../useReducedMotion";

// A number that counts up once (ease-out), so the closet feels like it's being tallied.
export function CountUp({ value, duration = 600, style, testID }: { value: number; duration?: number; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration, reduced]);
  return <Text testID={testID} style={[{ fontVariant: ["tabular-nums"] }, style]}>{shown}</Text>;
}
```

In `app/closet.tsx` delete the local `categoryOf` function and add `import { categoryOf } from "../src/categories";`.

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A mobile
git commit -m "feat: closet stats, shared category normalization, CountUp"
```

---

### Task 5: `useCapture`, Add tab, Home screen, tab order

**Files:**
- Create: `src/useCapture.ts`, `src/haptics.ts`, `app/add.tsx`
- Replace: `app/index.tsx` (becomes Home)
- Modify: `app/_layout.tsx`, `app/closet.tsx` (remove `JustAdded` from its header), `package.json` (`expo-haptics`)
- Move test: `__tests__/CaptureScreen.test.tsx` → imports `../app/add`
- Test: `__tests__/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `postRun`, `getItems` (`src/api/client`), `pickPhoto` (`src/photoPicker`), `useLastRun`, `closetStats`, `categoryOf`, `Marquee`, `CountUp`, `Rise`, `PressScale`, `JustAdded`, `ProcessingStatus` + `CAPTURE_STEPS`/`KEEP_OPEN`, `GarmentImage`, `ItemSheet`
- Produces: `useCapture(): { capture(fromCamera: boolean): Promise<void>; loading: boolean; error: string | null }` (on success sets last run, fires `haptics.success()`, navigates to `/` (Home), where Just added shows); `haptics.success(): void`, `haptics.light(): void`

- [ ] **Step 1: Install haptics**

Run: `npx expo install expo-haptics -- --legacy-peer-deps`
Expected: `package.json` lists `expo-haptics`.

- [ ] **Step 2: Write the failing Home tests**

`__tests__/HomeScreen.test.tsx`:

```tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../app/index";
import { LastRunProvider } from "../src/store/lastRun";
import { getItems } from "../src/api/client";
import { pickPhoto } from "../src/photoPicker";

const push = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push }),
  useFocusEffect: (cb: () => void) => { const { useEffect } = require("react"); useEffect(() => cb(), [cb]); },
}));
jest.mock("../src/api/client", () => ({ ...jest.requireActual("../src/api/client"), getItems: jest.fn(), postRun: jest.fn() }));
jest.mock("../src/photoPicker", () => ({ pickPhoto: jest.fn() }));

const f = (v: string | string[]) => ({ value: v, confidence: 1, basis: "observed" as const });
const item = (id: string, cat: string, colors: string[]) => ({
  run_id: "20261016-1", photo_name: "p", item_id: id, tier: "high",
  facts: { category: f(cat), colors: f(colors), pattern: f("solid"), visible_text: f(""), trims: f(""),
           visible_parts: f([]), occluded_parts: f([]) },
  crop_url: "/c.png", generated_url: "/g.png", cutout_url: "/x.png", back: null,
});

function renderHome() {
  return render(<LastRunProvider><HomeScreen /></LastRunProvider>);
}

beforeEach(() => jest.clearAllMocks());

test("shows the closet at a glance: title, counts and category chips", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "t-shirt", ["gray"]), item("item_1", "shorts", ["navy"]), item("item_2", "T-shirt", ["navy"])] });
  renderHome();
  expect(screen.getByText("Wardrobe")).toBeTruthy();
  expect(await screen.findByText("3 pieces · 3 added this week")).toBeTruthy();
  expect(screen.getByLabelText("Pieces")).toBeTruthy();
  expect(screen.getByRole("button", { name: "T-shirt, 2" })).toBeTruthy();
});

test("a category chip opens the closet filtered to it", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  fireEvent.press(await screen.findByRole("button", { name: "Shorts, 1" }));
  expect(push).toHaveBeenCalledWith({ pathname: "/closet", params: { category: "Shorts" } });
});

test("an empty closet invites the first photo instead of empty rows", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  renderHome();
  expect(await screen.findByText("Start your closet")).toBeTruthy();
  expect(screen.getByText("Take photo")).toBeTruthy();
  expect(screen.queryByLabelText("Pieces")).toBeNull();
});

test("when the server can't be reached it says so, offers a retry, and still lets you add", async () => {
  (getItems as jest.Mock).mockRejectedValueOnce(new Error("Can't reach your wardrobe server."))
    .mockResolvedValueOnce({ items: [item("item_0", "shorts", ["navy"])] });
  renderHome();
  expect(await screen.findByText(/Can't reach your wardrobe server/)).toBeTruthy();
  expect(screen.getByText("Take photo")).toBeTruthy();
  fireEvent.press(screen.getByText("Try again"));
  expect(await screen.findByText("1 piece · 1 added this week")).toBeTruthy();
});

test("quick add starts the capture right from Home", async () => {
  (getItems as jest.Mock).mockResolvedValue({ items: [] });
  (pickPhoto as jest.Mock).mockResolvedValue(null);
  renderHome();
  fireEvent.press(await screen.findByText("Choose from library"));
  await waitFor(() => expect(pickPhoto).toHaveBeenCalledWith(false));
});
```

Note: the sub-line "3 added this week" depends on today's date. In the test, mock time: add `beforeAll(() => { jest.useFakeTimers({ now: new Date(2026, 9, 16), doNotFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval", "nextTick", "setImmediate", "queueMicrotask"] }); })` and `afterAll(() => jest.useRealTimers());` at the top of the file.

- [ ] **Step 3: Run to verify failure**

Run: `npx jest __tests__/HomeScreen.test.tsx`
Expected: FAIL (Home renders the old capture screen; no "Wardrobe").

- [ ] **Step 4: Implement `haptics` and `useCapture`**

`src/haptics.ts`:

```ts
import * as Haptics from "expo-haptics";

// Confirm what the user did, quietly. Never let a missing haptics engine throw.
export const haptics = {
  success: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  light: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
};
```

`src/useCapture.ts`:

```ts
import { useState } from "react";
import { useRouter } from "expo-router";
import { postRun } from "./api/client";
import { haptics } from "./haptics";
import { pickPhoto } from "./photoPicker";
import { useLastRun } from "./store/lastRun";

// Pick or take a photo, upload it, and land on Home where "Just added" shows the new pieces.
export function useCapture() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setLastRun } = useLastRun();
  const router = useRouter();

  async function capture(fromCamera: boolean) {
    setError(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(fromCamera);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the camera.");
      return;
    }
    if (!uri) return;
    setLoading(true);
    try {
      setLastRun(await postRun(uri));
      haptics.success();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return { capture, loading, error };
}
```

- [ ] **Step 5: Move the capture screen to `app/add.tsx`**

Create `app/add.tsx` with the current contents of `app/index.tsx`, then:
- rename the component to `AddScreen`;
- delete `pickAndUpload`, `useState` for loading/error, `useLastRun`, `useRouter`, `postRun`, `pickPhoto` imports; add `const { capture, loading, error } = useCapture();` and use `capture(true)` / `capture(false)` in the two buttons;
- replace the title style with `title: { ...type.largeTitle, color: colors.label, marginTop: 20 }` and body with `body: { ...type.body, color: colors.secondaryLabel, marginTop: 8 }`; import `type` from theme;
- replace the dashed `stage` style with an inset grouped card: `stage: { flex: 1, marginVertical: 24, borderRadius: radius.card, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", padding: 20 }`;
- tip label/detail styles: `tipLabel: { ...type.headline, color: colors.label }`, `tipDetail: { ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }`.

In `__tests__/CaptureScreen.test.tsx` change `import CaptureScreen from "../app/index";` to `import CaptureScreen from "../app/add";`. Its router mock already provides `push`.

- [ ] **Step 6: Implement Home in `app/index.tsx`**

Replace `app/index.tsx` entirely:

```tsx
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../src/api/client";
import type { ClosetItem } from "../src/api/types";
import { closetStats } from "../src/closetStats";
import { GarmentImage } from "../src/components/GarmentImage";
import { ItemSheet } from "../src/components/ItemSheet";
import { JustAdded } from "../src/components/JustAdded";
import { PillButton } from "../src/components/PillButton";
import { CAPTURE_STEPS, KEEP_OPEN, ProcessingStatus } from "../src/components/ProcessingStatus";
import { CountUp } from "../src/motion/CountUp";
import { Marquee } from "../src/motion/Marquee";
import { PressScale } from "../src/motion/PressScale";
import { Rise } from "../src/motion/Rise";
import { colors, hitSlopFor, radius, type } from "../src/theme";
import { useCapture } from "../src/useCapture";

const TILE = 96;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View accessible accessibilityLabel={label} style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.card, padding: 14 }}>
      <CountUp value={value} style={{ ...type.title2, color: colors.label }} />
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { capture, loading, error: captureError } = useCapture();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ list: ClosetItem[]; index: number } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems((await getItems()).items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your closet.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const stats = useMemo(() => closetStats(items, new Date()), [items]);
  const rowA = items.filter((_, i) => i % 2 === 0);
  const rowB = items.filter((_, i) => i % 2 === 1);
  const empty = loaded && !loadError && items.length === 0;

  const garment = (list: ClosetItem[]) => (item: ClosetItem, index: number) => (
    <PressScale accessibilityRole="button" accessibilityLabel={`Open ${item.facts.category.value}`} onPress={() => setOpen({ list, index })}>
      <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: TILE, height: TILE + 12 }} tile={colors.card} />
    </PressScale>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Wardrobe</Text>
          {items.length > 0 ? (
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
              {stats.pieces === 1 ? "1 piece" : `${stats.pieces} pieces`} · {stats.addedThisWeek} added this week
            </Text>
          ) : null}
        </View>

        {loadError ? (
          <View style={{ margin: 20, padding: 16, borderRadius: radius.card, backgroundColor: colors.destructiveBg, gap: 10 }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
            <PillButton label="Try again" onPress={load} />
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={{ marginTop: 18, gap: 10 }}>
            <Marquee items={rowA} itemWidth={TILE} renderItem={garment(rowA)} testID="row-a" />
            {rowB.length ? <Marquee items={rowB} itemWidth={TILE} renderItem={garment(rowB)} reverse speed={14} testID="row-b" /> : null}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20 }}>
          {empty ? (
            <Rise style={{ marginTop: 28 }}>
              <Text style={{ ...type.title2, color: colors.label }}>Start your closet</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 6 }}>
                Photograph a piece, or a few side by side. Each one becomes a clean catalog shot.
              </Text>
            </Rise>
          ) : null}

          {items.length > 0 ? (
            <Rise style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <Stat label="Pieces" value={stats.pieces} />
              <Stat label="Categories" value={stats.categories.length} />
              <Stat label="Colors" value={stats.colors} />
            </Rise>
          ) : null}

          <View style={{ marginTop: 20, gap: 10 }}>
            {loading ? (
              <View style={{ backgroundColor: colors.card, borderRadius: radius.card, paddingVertical: 24 }}>
                <ProcessingStatus steps={CAPTURE_STEPS} note={KEEP_OPEN} />
              </View>
            ) : (
              <>
                <PillButton label="Take photo" variant="primary" icon="camera" onPress={() => capture(true)} />
                <PillButton label="Choose from library" onPress={() => capture(false)} />
              </>
            )}
            {captureError ? <Text style={{ ...type.footnote, color: colors.destructive }}>{captureError}</Text> : null}
          </View>

          <View style={{ marginTop: 28 }}>
            <JustAdded onClosetChanged={load} />
          </View>

          {stats.categories.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ ...type.headline, color: colors.label, marginBottom: 10 }}>By category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {stats.categories.map(({ name, count }) => (
                  <PressScale
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${count}`}
                    hitSlop={hitSlopFor(34)}
                    onPress={() => router.push({ pathname: "/closet", params: { category: name } })}
                    style={{ flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card }}
                  >
                    <Text style={{ ...type.subhead, color: colors.label }}>{name}</Text>
                    <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{count}</Text>
                  </PressScale>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <ItemSheet items={open?.list ?? []} index={open ? open.index : null} onClose={() => setOpen(null)}
        onUpdated={() => load()} onDeleted={() => { setOpen(null); load(); }} />
    </SafeAreaView>
  );
}
```

In `app/closet.tsx` remove the `JustAdded` import and the `<JustAdded onClosetChanged={load} />` line (it now lives on Home).

In `app/_layout.tsx` replace the two `Tabs.Screen` lines with:

```tsx
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: tabIcon("home") }} />
        <Tabs.Screen name="closet" options={{ title: "Closet", tabBarIcon: tabIcon("closet") }} />
        <Tabs.Screen name="add" options={{ title: "Add", tabBarIcon: tabIcon("camera") }} />
```

and set the tab bar to the new tokens:

```tsx
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.secondaryLabel,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.separator },
```

In `src/components/Icon.tsx` add to `ICONS`: `home: { sf: "house", ion: "home-outline" },`.

`useCapture` navigates to `/` — update `__tests__/CaptureScreen.test.tsx` if it asserts a push target (it currently does not).

- [ ] **Step 7: Run tests and typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (Home, capture, Just added, closet), tsc exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A mobile
git commit -m "feat: Home tab with running garments, stats, quick add and categories"
```

---

### Task 6: Closet restyle and category route param

**Files:**
- Modify: `app/closet.tsx`
- Test: `__tests__/ClosetScreen.test.tsx`

**Interfaces:**
- Consumes: `useLocalSearchParams` from expo-router, `categoryOf`, `Rise`, `PressScale`, `type`, `colors`, `radius`
- Produces: Closet honors `?category=<Name>` (matching via `categoryOf`, case/space-insensitive)

- [ ] **Step 1: Write the failing tests**

In `__tests__/ClosetScreen.test.tsx`, change the expo-router mock to also export params:

```tsx
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require("react");
    focusCallback = cb;
    useEffect(() => cb(), [cb]);
  },
}));
```

Add `beforeEach(() => { mockParams = {}; });` and:

```tsx
test("opens filtered when Home sends a category", async () => {
  mockParams = { category: "shorts " };
  mockedGetItems.mockResolvedValue({ items: [fakeItem, fakeShorts] });
  render(<ClosetScreen />);
  expect(await screen.findByTestId("thumb-r1-item_1")).toBeTruthy();
  expect(screen.queryByTestId("thumb-r1-item_0")).toBeNull();
  expect(screen.getByRole("button", { name: "Shorts" }).props.accessibilityState).toEqual({ selected: true });
});

test("uses the iOS large title", async () => {
  render(<ClosetScreen />);
  expect(await screen.findByRole("header", { name: "Closet" })).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/ClosetScreen.test.tsx`
Expected: FAIL (no filter from params; title is "Your closet").

- [ ] **Step 3: Implement**

In `app/closet.tsx`:
- import `useLocalSearchParams` from `expo-router` and `type` from theme; import `PressScale` from `../src/motion/PressScale`;
- after `const [category, setCategory] = useState(ALL);` add:

```tsx
  const params = useLocalSearchParams<{ category?: string }>();
  useEffect(() => {
    if (!params.category) return;
    const wanted = categoryOf({ facts: { category: { value: params.category } } } as any);
    setCategory(wanted);
  }, [params.category]);
```

  (add `useEffect` to the React import);
- replace the header title and count with:

```tsx
      <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Closet</Text>
      <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2, marginBottom: 12 }}>
        {items.length === 1 ? "1 piece" : `${items.length} pieces`}
      </Text>
```

- filter chips: active background `colors.label` → `colors.tint`, active text `colors.background` → `colors.onTint`, inactive background `"transparent"` → `colors.card`, drop the border (`borderWidth: 0`), text style `{ ...type.subhead, ... }`;
- grid cell: wrap the thumb in `PressScale` instead of the bare `Pressable` (keep `testID` and `onPress`), give the image `tile={colors.card}` and `style={{ width: "100%", aspectRatio: 0.85 }}`, name `{ ...type.subhead, color: colors.label, marginTop: 8 }`, colors line `{ ...type.footnote, color: colors.secondaryLabel }`;
- empty state title `{ ...type.title2, color: colors.label }`, body `{ ...type.body, color: colors.secondaryLabel, textAlign: "center" }`; its button pushes `/add`.

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A mobile
git commit -m "feat(closet): native restyle and category filter from Home"
```

---

### Task 7: Item sheet as an iOS grouped detail view

**Files:**
- Modify: `src/components/ItemSheet.tsx`, `src/components/ItemEditForm.tsx`, `src/components/JustAdded.tsx`, `src/components/PillButton.tsx`, `src/components/TierBadge.tsx`, `src/components/ProcessingStatus.tsx`, `src/components/RetakeNote.tsx`
- Test: `__tests__/ItemSheet.test.tsx`, `__tests__/ItemBack.test.tsx`, `__tests__/ItemEditing.test.tsx`

**Interfaces:**
- Consumes: `type`, `colors`, `radius`, `Rise`, `PressScale`, `haptics`
- Produces: unchanged `ItemSheet` props; accessibility names kept: "Close", "Edit", "Front", "Back", "Add back photo", "Remove from closet" (text), "Discard changes?" alert.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/ItemSheet.test.tsx`:

```tsx
test("facts sit in one grouped card with the title as a header", () => {
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} />);
  expect(screen.getByRole("header", { name: "T-shirt" })).toBeTruthy();
  expect(screen.getByTestId("facts-card")).toBeTruthy();
});
```

Add to `__tests__/ItemEditing.test.tsx`:

```tsx
test("saving confirms with a haptic", async () => {
  const { haptics } = require("../src/haptics");
  const spy = jest.spyOn(haptics, "success").mockImplementation(() => {});
  mockedUpdate.mockResolvedValue(item);
  render(<ItemSheet items={[item]} index={0} onClose={() => {}} onUpdated={() => {}} onDeleted={() => {}} />);
  fireEvent.press(screen.getByLabelText("Edit"));
  fireEvent.press(screen.getByText("Save"));
  await waitFor(() => expect(spy).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/ItemSheet.test.tsx __tests__/ItemEditing.test.tsx`
Expected: FAIL (no header role / testID, no haptic).

- [ ] **Step 3: Implement**

In `src/components/ItemSheet.tsx`:
- title `Text`: add `accessibilityRole="header"` and style `{ ...type.title2, color: colors.label, flexShrink: 1 }`;
- replace `FactRow` and `FactText` with:

```tsx
function FactRow({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16,
        paddingVertical: 12, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator,
      }}
    >
      <Text style={{ ...type.body, color: colors.secondaryLabel }}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

function FactText({ children }: { children: string }) {
  return <Text style={{ ...type.body, color: colors.label, textAlign: "right" }}>{children}</Text>;
}
```

  (add `StyleSheet` to the react-native import), give the first row (`Colors`) the `first` prop, and wrap the rows in `<View testID="facts-card" style={{ marginTop: 20, backgroundColor: colors.card, borderRadius: radius.card, paddingHorizontal: 16 }}>`;
- replace the `SideStrip` thumbnail tiles with an iOS segmented control (same accessibility names, so the existing back tests keep passing):

```tsx
function SideStrip({ back, side, onChange, onAddBack }: {
  item: Item;
  back: BackView | null;
  side: "front" | "back";
  onChange: (s: "front" | "back") => void;
  onAddBack?: () => void;
}) {
  const segment = (label: string, selected: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected }} onPress={onPress}
      hitSlop={hitSlopFor(32, 120)}
      style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: selected ? colors.card : "transparent" }}
    >
      <Text style={{ ...type.subhead, fontWeight: selected ? "600" : "400", color: colors.label }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", marginTop: 14, padding: 2, borderRadius: 10, backgroundColor: colors.tile }}>
      {segment("Front", side === "front", () => onChange("front"), "Front")}
      {back
        ? segment("Back", side === "back", () => onChange("back"), "Back")
        : onAddBack
          ? segment("+ Back", false, onAddBack, "Add back photo")
          : null}
    </View>
  );
}
```

  (import `hitSlopFor` from theme; the `item` prop stays in the signature for the call site but is unused by the segmented style);
- the "Remove from closet" control becomes the last grouped row: `<View style={{ marginTop: 24, backgroundColor: colors.card, borderRadius: radius.card }}><Pressable ... style={{ padding: 16, alignItems: "center" }}><Text style={{ ...type.body, color: colors.destructive }}>Remove from closet</Text></Pressable></View>`;
- header buttons (Edit, Close) background `colors.tile`;
- after a successful delete in `confirmRemove` call `haptics.success()`.

In `src/components/ItemEditForm.tsx`: field labels `{ ...type.footnote, color: colors.secondaryLabel }`, inputs `backgroundColor: colors.card`, `borderWidth: 0`, `borderRadius: 12`, `...type.body`; selected pattern pill `colors.tint` / `colors.onTint`; after `onSaved(...)` succeeds call `haptics.success()`.

In `src/components/PillButton.tsx`: primary background `colors.tint`, primary text `colors.onTint`; secondary background `colors.card`, text `colors.tint`, `borderWidth: 0`; label style `{ ...type.headline }`; radius `radius.card` (14–16pt rounded rect, the iOS button shape) instead of a full pill.

In `src/components/JustAdded.tsx`: heading `{ ...type.title2, color: colors.label }`, "Done" `{ ...type.body, color: colors.tint }`, rows inside one `colors.card` rounded card with hairline separators, row title `{ ...type.headline, color: colors.label }`.

In `src/components/ProcessingStatus.tsx`: stage label `{ ...type.headline, color: colors.label }`; bar fill `colors.tint`, track `colors.separator`.

In `src/components/TierBadge.tsx` and `RetakeNote.tsx`: text `{ ...type.footnote, fontWeight: "600" }` / `{ ...type.subhead }`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A mobile
git commit -m "feat(design): item sheet and shared components in the native world"
```

---

### Task 8: Finish — sweep, reload, DESIGN.md

**Files:**
- Verify: no stale references
- Create: `DESIGN.md` (repo root) via impeccable's documenter
- Modify: `PRODUCT.md` (Brand Commitments)

- [ ] **Step 1: Sweep for leftovers**

```bash
grep -rnE "fonts\.|Fraunces|FadeIn|colors\.(paper|ink|muted|sunken|surface)\b|#[0-9A-Fa-f]{6}" app src | grep -v "src/theme.ts" | grep -vi "swatch\|#FFFFFF\" : \"#" || echo "clean"
```

Expected: only fixed garment-swatch colors (in `ItemEditForm` checkmark) or `clean`.

- [ ] **Step 2: Full verification**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites pass, tsc exit 0.

- [ ] **Step 3: Record the brand decision**

In `PRODUCT.md`, replace the `## Brand Commitments` body with:

```markdown
Standing preference: the category standard, native iOS (system font, grouped backgrounds, one blue tint),
executed at full craft; immersion comes from motion of the garments, not decoration. Chosen in an impeccable
direction round on 2026-10-16. Dark mode follows the system.
```

- [ ] **Step 4: Document the built world**

Run the impeccable documenter on the finished app (`/impeccable document` or the `impeccable-documenter` agent) to write `DESIGN.md` from `mobile/src/theme.ts`, `mobile/src/motion/*` and the screens.

- [ ] **Step 5: Commit and update main**

```bash
git add -A
git commit -m "docs: DESIGN.md for the native world; brand commitment recorded"
git -C ~/Desktop/my_wardrobe merge --ff-only claude/app-work-continue-d4ac84
cd ~/Desktop/my_wardrobe/mobile && npm install --legacy-peer-deps
```

Then restart Expo with `--clear` (new native module `expo-haptics`, removed font package).
