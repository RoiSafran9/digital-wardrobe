// The film's beat grid. Every scene boundary sits on a whole or half bar of the music, every accent on a
// beat, so changing BPM or MUSIC_START moves the whole film coherently.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// alanajordan — "Electro Funk 02" (Pixabay Content Licence). Measured on the file itself (onset grid over the
// whole track, 2026-11-06): exactly 110.00 BPM, downbeats (the strongest kick) at 3.880 s + n × 2.1818 s,
// 8-bar phrases ending on fill bars 13 and 21. The film enters on bar 1, so the bar-13 fill builds into the
// downbeat where Build My Look's closet bursts (film bar 13); the film ends on track bar 20, faded out.
// (V15's 109.68 BPM / 6.354 s grid sat ~0.3 s off the bar and drifted.)
export const BPM = 110;
const TRACK_FIRST_DOWNBEAT = 3.88;
const ENTRY_BAR = 1;
export const MUSIC_START = TRACK_FIRST_DOWNBEAT + (ENTRY_BAR * 4 * 60) / BPM;
export const MUSIC_FILE = "music/electro-funk-02.mp3";

export const BEAT_FRAMES = (FPS * 60) / BPM; // 16.36
/** Absolute frame of beat n (0 = film start). Fractions are allowed (0.5 = an eighth note). */
export const beat = (n: number) => Math.round(n * BEAT_FRAMES);
/** Absolute frame of bar n (4 beats per bar). */
export const bar = (n: number) => beat(n * 4);

// Scene boundaries in bars (19 bars = 1244 frames = 41.5 s).
export const SCENES = {
  opening: [0, 1],
  hook: [1, 3],
  photo: [3, 5],
  outfit: [5, 7],
  closet: [7, 9],
  spin: [9, 10.5],
  looks: [10.5, 15],
  swap: [15, 17],
  brand: [17, 19],
} as const;

export type SceneName = keyof typeof SCENES;
export const sceneFrom = (s: SceneName) => bar(SCENES[s][0]);
export const sceneLength = (s: SceneName) => bar(SCENES[s][1]) - bar(SCENES[s][0]);
export const DURATION = bar(19);

/**
 * Frame of beat n of a scene, relative to the scene's start: inside a scene's Sequence, `at("looks", 8)` is
 * the frame on which that scene's ninth beat lands (beats stay on the film's absolute grid).
 */
export const at = (s: SceneName, n: number) => beat(SCENES[s][0] * 4 + n) - sceneFrom(s);

// Text bands that clear Reels/TikTok overlays (top 220px, bottom ~420px, right ~180px).
export const SAFE = { left: 80, right: 180, topBand: 250, bottomBand: 1250 } as const;
