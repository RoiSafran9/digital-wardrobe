// The owner's real closet and the real Build My Look output, as fetched by scripts/fetch_assets.py and
// scripts/compute_looks.py. Nothing here is invented: ids, files, boxes and looks come from the product.
import { staticFile } from "remotion";
import closetJson from "../data/closet.json";
import dimsJson from "../data/dims.json";
import looksJson from "../data/looks.json";

type Files = { generated?: string; cutout?: string; crop?: string } & Record<string, string | undefined>;
type RawItem = { id: string; short: string; category: string | null; colors: string[] | null; has_turn: boolean; files: Files };

const dims = dimsJson as Record<string, number[]>;

export type Garment = {
  id: string;
  short: string;
  category: string;
  /** Transparent cutout (the closet's first choice), else the white generated image. */
  src: string;
  aspect: number; // width / height of src
  crop?: string;
  cropAspect?: number;
  turn?: string[]; // front, right, back, left (AI 360 views)
};

// Garments are sized by category, not by pixels (V15 rule): a pair of trousers stands taller than a tee.
const HEIGHT_FACTOR: Record<string, number> = {
  trousers: 1.32, pants: 1.32, jeans: 1.32, shorts: 0.78, skirt: 0.9, sneaker: 0.42, sandals: 0.42,
  jacket: 1.0, sweatshirt: 0.95, shirt: 0.98, "t-shirt": 0.92, top: 0.92,
};
export const heightFactor = (g: Garment) => HEIGHT_FACTOR[g.category] ?? 0.92;

const toGarment = (raw: RawItem): Garment => {
  const path = raw.files.cutout ?? raw.files.generated!;
  const [w, h] = dims[path];
  const crop = raw.files.crop;
  const turn = ["front", "right", "back", "left"].map((a) => raw.files[`turn_${a}`]).filter((p): p is string => !!p);
  return {
    id: raw.id,
    short: raw.short,
    category: raw.category ?? "",
    src: staticFile(path),
    aspect: w / h,
    crop: crop ? staticFile(crop) : undefined,
    cropAspect: crop ? dims[crop][0] / dims[crop][1] : undefined,
    turn: raw.has_turn && turn.length === 4 ? turn.map((p) => staticFile(p)) : undefined,
  };
};

/** The owner's closet, newest first (the order the app's Closet grid uses). */
export const closet: Garment[] = (closetJson.items as RawItem[]).map(toGarment);
const byShort = new Map(closet.map((g) => [g.short, g]));
const byId = new Map(closet.map((g) => [g.id, g]));
export const g = (short: string): Garment => {
  const found = byShort.get(short);
  if (!found) throw new Error(`garment ${short} is not in the closet`);
  return found;
};
export const gid = (id: string): Garment => {
  const found = byId.get(id);
  if (!found) throw new Error(`garment ${id} is not in the closet`);
  return found;
};

// The flat-lay garment photo: one bed, a lilac tee and black trousers (garment job ff77396e; scan 7a4951d2).
// The original upload is no longer stored; its two real crops are, cut at the scan's own boxes, so the
// photo is shown as those two crops placed back at their boxes — real pixels, real positions.
export const FLATLAY = {
  image: { width: 3024, height: 4032 },
  tee: { garment: "32f79407", box: { x: 0, y: 1389.6288, width: 1638.34272, height: 1474.5024 } },
  pants: { garment: "224e173b", box: { x: 1317.13344, y: 1174.36032, width: 1706.86656, height: 2384.84736 } },
} as const;

// The 360 shot: the blue-and-white striped tee's four AI views (V15 used the same piece).
export const SPIN_GARMENT = "1fdd262c";

// Build My Look for Everyday · Smart Casual · Relaxed · Hot · Dark (scripts/compute_looks.py).
export type Look = { title: string; reason: string; pieces: { slot: string; garment: Garment }[] };
const SLOT_ORDER_TWO_PIECE = ["top", "outerwear", "bottom", "footwear"];
const SLOT_ORDER_ONE_PIECE = ["one_piece", "outerwear", "footwear"];
const toLook = (l: { title: string; reason: string; slots: Record<string, string> }): Look => {
  const order = l.slots.one_piece ? SLOT_ORDER_ONE_PIECE : SLOT_ORDER_TWO_PIECE;
  return {
    title: l.title,
    reason: l.reason,
    pieces: order.filter((s) => l.slots[s]).map((s) => ({ slot: s, garment: gid(l.slots[s]) })),
  };
};
export const LOOKS: Look[] = looksJson.looks.map((l) => toLook(l as { title: string; reason: string; slots: Record<string, string> }));
export const OPEN_LOOK = looksJson.open_look;
export const SWAP = {
  slot: looksJson.swap.slot,
  current: gid(looksJson.swap.current),
  alternatives: looksJson.swap.alternatives.map((a) => ({ garment: gid(a.item_id), reason: a.reason })),
};
// The film's own graphics use only pieces whose source photo is plainly the owner's: laid on the bed, on a
// hanger, or in the owner's mirror. Pieces imported from other people's photos (a game shot, street style, a
// concert) or carrying third-party marks or faces stay out; they may still appear in a look the engine returns.
export const OWN_PHOTO = new Set([
  "32f79407", "224e173b", "009d44e7", "d7b9819d", "858632a0", "7b988d90", "247440bb", "33b1974b", "3b41f435",
  "53dd022e", "2ceb59df", "1fdd262c", "224b3daa", "9317d066", "93f9c85a", "bcbb754e", "0613d692", "abd42b97", "b3fc5e30",
]);

// The worn-outfit import (outfit scan 52e892eb → generate 4a4b8930): the owner's mirror photo, two candidates,
// both generated; in Review the tee was kept and the shorts were not (discarded, not in the closet).
// The window keeps the face out of frame.
const discarded = (short: string, category: string): Garment => {
  const path = `garments/${short}/cutout.png`;
  const [w, h] = dims[path];
  const crop = `garments/${short}/crop.jpg`;
  return { id: short, short, category, src: staticFile(path), aspect: w / h, crop: staticFile(crop), cropAspect: dims[crop][0] / dims[crop][1] };
};
export const WORN = {
  photo: staticFile("photos/52e892eb.jpg"),
  image: { width: 3024, height: 4032 },
  window: { y: 880, height: 2420 },
  tee: { box: { x: 849.744, y: 903.168, width: 1348.704, height: 1741.824 }, kept: true },
  shorts: { box: { x: 1194.48, y: 2487.744, width: 913.248, height: 649.152 }, kept: false },
} as const;
export const wornPiece = (which: "tee" | "shorts"): Garment => (which === "tee" ? g("abd42b97") : discarded("6d10aaa8", "shorts"));

export const ANSWERS = ["Everyday", "Smart Casual", "Relaxed", "Hot", "Dark"] as const;
