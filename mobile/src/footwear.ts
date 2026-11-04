import type { GarmentPiece, ItemFacts } from "./api/types";
import { groupFor, groupOf } from "./categoryGroups";
import { garmentName } from "./garmentName";

// Shoes are one closet group with the server's own word list (pipeline/footwear.py). One pair is one piece.
export const isFootwear = (category: string) => groupFor(category) === "Shoes";
export const isFootwearItem = (item: { facts: ItemFacts }) => groupOf(item) === "Shoes";

// Back and 360 are garment features (a flat back, a ghost mannequin); the server refuses them for shoes too.
export const NO_SIDE_VIEWS = "Back and 360° views aren't available for shoes yet.";

// A pre-scan piece as the pick screens name it. Shoes say whether the scan saw a pair or one shoe, so a
// wrong grouping is caught before anything is charged.
export function pieceLabel(piece: Pick<GarmentPiece, "category" | "colors" | "shoes">): string {
  const name = garmentName({ facts: { category: { value: piece.category }, colors: { value: piece.colors } } } as never);
  if (piece.shoes === "pair") return `${name} · pair`;
  if (piece.shoes === "single") return `${name} · single shoe`;
  return name;
}
