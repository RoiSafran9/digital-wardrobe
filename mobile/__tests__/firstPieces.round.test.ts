import type { GarmentScan } from "../src/api/types";
import {
  ROUND_CAP, allPieces, defaultSelection, jobKey, jobsFor, photoStateFor, pieceKey, roundQuote, shouldOffer, summarize, toggle,
  type OfferInput, type RoundJob, type RoundPhoto,
} from "../src/firstPieces/round";

const scan = (id: string, sizes: number[], extra: Partial<GarmentScan> = {}): GarmentScan => ({
  id, status: "succeeded", error: null, quality: { status: "ok", reason: null }, reason: null,
  image: { width: 1000, height: 1000 }, expires_at: null,
  pieces: sizes.map((s, index) => ({ index, category: "shirt", colors: ["blue"], box: { x: 0, y: 0, width: s, height: s } })),
  ...extra,
});
const photo = (id: string, sizes: number[]): RoundPhoto => ({ id, uri: `file:///${id}.jpg`, state: "found", scan: scan(`s-${id}`, sizes) });

test("a finished scan sets its photo's state", () => {
  expect(photoStateFor(scan("s", [10]))).toBe("found");
  expect(photoStateFor(scan("s", []))).toBe("none");
  expect(photoStateFor(scan("s", [], { quality: { status: "retake", reason: "too dark" } }))).toBe("unusable");
});

test("pieces are listed photo by photo, skipping photos without pieces", () => {
  const pieces = allPieces([photo("a", [10, 20]), { id: "b", uri: "", state: "unusable", scan: null }, photo("c", [30])]);
  expect(pieces.map((p) => p.key)).toEqual(["a:0", "a:1", "c:0"]);
  expect(pieces[2]).toMatchObject({ scanId: "s-c", index: 0, area: 900 });
});

test("up to five found: all start selected", () => {
  const pieces = allPieces([photo("a", [10, 20]), photo("b", [5, 6, 7])]);
  expect(defaultSelection(pieces)).toEqual(["a:0", "a:1", "b:0", "b:1", "b:2"]);
});

test("more than five found: the five largest start selected, in display order", () => {
  const pieces = allPieces([photo("a", [10, 90, 20]), photo("b", [80, 5, 70, 60])]);
  expect(defaultSelection(pieces)).toEqual(["a:1", "a:2", "b:0", "b:2", "b:3"]);
  expect(defaultSelection(pieces)).toHaveLength(ROUND_CAP);
});

test("a sixth pick is blocked; deselecting frees a place", () => {
  const five = ["a:0", "a:1", "a:2", "b:0", "b:1"];
  expect(toggle(five, "b:2")).toEqual({ selection: five, blocked: true });
  const four = toggle(five, "a:1");
  expect(four).toEqual({ selection: ["a:0", "a:2", "b:0", "b:1"], blocked: false });
  expect(toggle(four.selection, "b:2")).toEqual({ selection: ["a:0", "a:2", "b:0", "b:1", "b:2"], blocked: false });
});

test("picks become one job per photo, in photo and scan order", () => {
  const pieces = allPieces([photo("a", [1, 2, 3]), photo("b", [4]), photo("c", [5, 6])]);
  expect(jobsFor(["c:1", "a:2", "a:0", "c:0"], pieces)).toEqual([
    { photoId: "a", scanId: "s-a", indexes: [0, 2] },
    { photoId: "c", scanId: "s-c", indexes: [0, 1] },
  ]);
  expect(jobsFor([], pieces)).toEqual([]);
});

test("a job's key is stable for its round and scan", () => {
  expect(jobKey("r1", "s-a")).toBe("fp:r1:s-a");
  expect(pieceKey("a", 2)).toBe("a:2");
});

test("the quote uses the server's unit price; billing off shows no amount", () => {
  expect(roundQuote(4, 1, 10)).toEqual({ count: 4, total: 4, affordable: true, leaveOut: 0 });
  expect(roundQuote(5, 2, 7)).toEqual({ count: 5, total: 10, affordable: false, leaveOut: 2 });
  expect(roundQuote(5, undefined, 0)).toEqual({ count: 5, total: null, affordable: true, leaveOut: 0 });
  expect(roundQuote(3, 0, 0)).toEqual({ count: 3, total: 0, affordable: true, leaveOut: 0 });
});

const job = (indexes: number[], status: RoundJob["status"], itemIds?: string[]): RoundJob =>
  ({ plan: { photoId: "p", scanId: "s", indexes }, key: "k", status, itemIds });

test("a round's summary adds up made, not made, running and unsent jobs", () => {
  expect(summarize([job([0, 1], "succeeded", ["i1"]), job([0], "failed"), job([0, 1], "running"), job([2], "unsent")]))
    .toEqual({ requested: 6, made: 1, notMade: 2, running: 1, unsent: 1, settled: false });
  expect(summarize([job([0, 1, 2], "succeeded", ["i1", "i2", "i3"])]))
    .toEqual({ requested: 3, made: 3, notMade: 0, running: 0, unsent: 0, settled: true });
  expect(summarize([])).toMatchObject({ made: 0, settled: true });
});

const fresh: OfferInput = { signedIn: true, named: true, starterDecided: true, generation: true,
                            closetCount: 0, pendingCount: 0, inflight: false, offered: false };

test("offered once to a new account with an empty closet", () => {
  expect(shouldOffer(fresh)).toBe(true);
});

test.each<[string, Partial<OfferInput>]>([
  ["local mode or signed out", { signedIn: false }],
  ["before the name step", { named: false }],
  ["before the starter screen is decided", { starterDecided: false }],
  ["while generation is paused", { generation: false }],
  ["with pieces in the closet (any device)", { closetCount: 2 }],
  ["while the closet is still loading", { closetCount: null }],
  ["with outfit results waiting for review", { pendingCount: 1 }],
  ["while review count is loading", { pendingCount: null }],
  ["while a round is in flight", { inflight: true }],
  ["after it was offered", { offered: true }],
])("not offered %s", (_, change) => {
  expect(shouldOffer({ ...fresh, ...change })).toBe(false);
});
