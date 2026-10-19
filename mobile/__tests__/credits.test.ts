import { affordableFronts, canAfford, creditsLabel, entryLabel, entrySign, visibleEntries } from "../src/credits/credits";
import type { CreditEntry, Credits } from "../src/api/types";

const entry = (kind: CreditEntry["kind"], extra: Partial<CreditEntry> = {}): CreditEntry =>
  ({ id: 1, kind, amount: 2, action: "garment", job_id: "j", note: null, created_at: "2026-10-18T00:00:00Z", ...extra });

test("fronts are limited by what the user can afford and the server's cap", () => {
  expect(affordableFronts(5, 1)).toBe(5);
  expect(affordableFronts(5, 2)).toBe(2);
  expect(affordableFronts(0, 1)).toBe(0);
  expect(affordableFronts(500, 1)).toBe(20);
  expect(affordableFronts(0, 0)).toBe(20);  // a free action
});

test("affordability: no price means nothing to pay", () => {
  const credits = { available: 2 } as Credits;
  expect(canAfford(credits, undefined)).toBe(true);
  expect(canAfford(credits, 2)).toBe(true);
  expect(canAfford(credits, 3)).toBe(false);
  expect(canAfford(null, 1)).toBe(false);
});

test("labels", () => {
  expect(creditsLabel(1)).toBe("1 credit");
  expect(creditsLabel(3)).toBe("3 credits");
  expect(entryLabel(entry("grant", { note: "F&F pilot", action: null }))).toBe("F&F pilot");
  expect(entryLabel(entry("charge", { action: "back" }))).toBe("Back image");
  expect(entrySign(entry("grant"))).toBe("+2");
  expect(entrySign(entry("charge"))).toBe("−2");
  expect(visibleEntries([entry("hold"), entry("charge"), entry("release"), entry("grant")]).map((e) => e.kind)).toEqual(["charge", "grant"]);
});

test("quote totals the lines at server prices and says what is left", () => {
  const { quote } = require("../src/credits/credits");
  const q = quote([{ label: "Front image", action: "garment", count: 4 }], { garment: 1 }, 18);
  expect(q).toEqual({ lines: [{ label: "Front image × 4", credits: 4 }], total: 4, after: 14, affordable: true });
  expect(quote([{ label: "Front image", action: "garment", count: 4 }], { garment: 1 }, 2)).toMatchObject({ total: 4, after: -2, affordable: false });
  expect(quote([{ label: "360° view", action: "turn", count: 1 }], { turn: 3 }, null)).toMatchObject({ total: 3, after: null, affordable: false });
  // An action without a server price costs nothing.
  expect(quote([{ label: "Back image", action: "back", count: 1 }], {}, 0)).toMatchObject({ total: 0, affordable: true });
});
