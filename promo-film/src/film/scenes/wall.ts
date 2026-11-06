import { WIDTH } from "../config";

// The closet wall in S3: twelve of the owner's own pieces; `top` marks the app's "Tops" group.
export const WALL: { short: string; top: boolean }[] = [
  { short: "32f79407", top: true }, { short: "224e173b", top: false }, { short: "d7b9819d", top: true },
  { short: "858632a0", top: false }, { short: "7b988d90", top: true }, { short: "3b41f435", top: false },
  { short: "009d44e7", top: true }, { short: "247440bb", top: false }, { short: "1fdd262c", top: true },
  { short: "53dd022e", top: false }, { short: "33b1974b", top: true }, { short: "2ceb59df", top: false },
];
export const WALL_COLS = 3;
export const WALL_TILE = { width: 282, height: 262, gap: 22 } as const;
export const WALL_LEFT = (WIDTH - (WALL_COLS * WALL_TILE.width + (WALL_COLS - 1) * WALL_TILE.gap)) / 2;
export const WALL_TOP = 640;
export const wallCell = (i: number) => ({
  x: WALL_LEFT + (i % WALL_COLS) * (WALL_TILE.width + WALL_TILE.gap),
  y: WALL_TOP + Math.floor(i / WALL_COLS) * (WALL_TILE.height + WALL_TILE.gap),
});
