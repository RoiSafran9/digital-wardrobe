# KIPS — launch film V16 · "More looks. Same closet."

41.5 s · 1080×1920 · 30 fps · 19 bars at 110 BPM (1244 frames) · −14.5 LUFS, −1.3 dBTP · no voiceover · Remotion (`src/film/`).

## Story
2026-11-06: 21 bars (46 s) → 17 bars (37 s) for faster transitions, then 19 bars (41.5 s) at the owner's request ("a bit too fast"): sharp cuts kept, slightly longer holds; five questions at 1.8 beats each; the closet burst lands on film bar 12. The owner's new worn photo (3 pieces, closet 35) replaced the earlier mirror photo and re-shaped the looks. Then the full-circle scene (photo → pieces → wall → look again) was cut as a repeat of the opening, and a one-bar opening was added before the photo, in two versions; the owner chose the logo opening: 19 bars (41.5 s).

Real clothes, real results: a flat-lay photo → its catalog pieces → a worn outfit photo → the closet →
Build My Look → one Swap that rebuilds that worn outfit from the user's own pieces, which gathers into the KIPS icon.

| Scene | Bars | Frames | Line | What is on screen (all real data) |
|---|---|---|---|---|
| Opening | 0–1 | 0–65 | — | **KipsLaunchV16 (chosen):** the KIPS icon on the downbeat, the wordmark rising, then the shutter. Alternate `KipsLaunchV16-Question`: the owner's clothes tumble into a heap under "Nothing to wear?" |
| S0 Hook | 1–3 | 65–196 | You own more outfits than you think. | Flat-lay photo (its two real crops at the scan's boxes), shutter, boxes 1–2, crops lift and flip to their catalog images, six more of the owner's pieces land |
| S1 Clean catalog | 3–5 | 196–327 | Real clothes in. Clean catalog out. | Six real photo crops flip to their catalog images, one per eighth note; the app's processing stages tick |
| S2 Outfit photo | 5–7 | 327–458 | Or just wear it. | The worn photo the owner chose (face out of frame), scan band, "Detection is free", three boxes; each piece lifts out of the photo and turns into its catalog image; Review keeps all three (red tee, ripped jeans, sneakers) |
| S3 Closet | 7–9 | 458–589 | Your closet. Finally organized. | Twelve pieces drop into a stone wall; the Tops group filters it; the striped tee is picked up |
| S4 AI 360° | 9–10.5 | 589–687 | Spin it in AI 360°. | The tee's four real AI views turning, "Drag to rotate · AI view" |
| S5 Build My Look | 10.5–15 | 687–982 | Build My Look / Made with clothes you already own. | The five real questions (Going Out · Streetwear · Bold · Hot · Colorful), "Putting your looks together…", the closet bursts, look 1 assembles, the deck swipes through looks 1–3 |
| S6 Swap | 15–17 | 982–1113 | Don't love it? Swap it. | Look 3 (sweatshirt, the worn photo's jeans and sneakers); "Swap Top" with the server's first alternatives; the photo's red tee replaces the sweatshirt — only that slot changes — and the look gathers into the icon |
| S8 Brand | 17–19 | 1113–1244 | More looks. Same closet. | Icon, wordmark, one blue inverted hit on its fourth beat, hold |

## Where the data comes from
- `KIPS_FILM_OWNER_EMAIL=… python3 -I scripts/fetch_assets.py` — the owner's 32 active closet items (own account only) and surviving source photos,
  copied byte for byte into `public/` (gitignored). `src/data/closet.json`, `dims.json`.
- `scripts/compute_looks.py` — runs the real engine (`api/outfit_builder`) on that closet for
  Going Out · Streetwear · Bold · Hot · Colorful → `src/data/looks.json`: three looks, and for look 3's top the
  ranked swap list whose first entry is the worn photo's tee. **If the closet changes, re-run it; the film follows.**
- `scripts/make_sfx.py` — original synthesized micro-sounds (no samples, no licences).

## The worn photo
Outfit scan `1fc3d8bb` (2026-11-06), chosen by the owner. It carries its photographer's "@filmyboi" mark, which
is left untouched; the frame starts below the chin so no face is shown, and the pieces lift out as the photo
clipped to each scan box. **Confirm the right to use this photo before publishing.** Its tee print reads mirrored
(a mirror selfie, faithfully kept) and its sneakers carry a swoosh-like mark.

## Rules this cut follows
- No app screens are shown: there are no screen recordings, and none are reconstructed. Every app element is
  the app's own copy ("Build My Look · 1 of 5", "Putting your looks together…", "Swap Top", "Keep",
  "Detection is free", "Drag to rotate · AI view") on film graphics in the KIPS Glass language.
- Garment images are never edited: contained, moved, scaled, flipped (a card turn, never a morph). Shadows sit
  under tiles, never on pixels. 360 is labelled AI.
- Film graphics use only pieces from the owner's own photos (`OWN_PHOTO` in `data.ts`); pieces imported from
  other people's photos, with third-party marks or printed faces, stay out. The engine's looks are shown as returned.
- No credits, prices, store badges, beta wording, users or metrics. No person's face. Generic name: Alex (unused here).

## Music
alanajordan — "Electro Funk 02", Pixabay Content License (page: pixabay.com/music/upbeat-electro-funk-02-257143,
file `alanajordan-electro-funk-02-257143.mp3`, downloaded 2026-11-06 to `public/music/electro-funk-02.mp3`, gitignored).
Measured on the file: **110.00 BPM**, first downbeat 3.880 s, 8-bar phrases with fill bars 13 and 21, breakdown
from 51.9 s. The film enters on bar 1 (6.06 s): the bar-13 fill builds into the downbeat of the closet burst
(film bar 13); the film ends on track bar 20 with a 2 s fade. V15's 109.68 BPM / 6.354 s grid was ~0.3 s
off the bar and drifted; this one lines up (onset score on the film's beats 2.6 vs 0.7 half a beat off).

## Commands
`npm run dev` (Studio) · `npx remotion render KipsLaunchV16 out/kips-launch-v16.mp4` (alternate opening: `KipsLaunchV16-Question`) · `npm run lint`
