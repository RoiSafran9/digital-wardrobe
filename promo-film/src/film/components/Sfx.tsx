import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, staticFile } from "remotion";

export type SfxName = "shutter" | "tick" | "tick2" | "land" | "swipe" | "click" | "hit" | "whoosh";

// One original micro-sound (scripts/make_sfx.py), placed on its frame and ducked under the music.
export const Sfx: React.FC<{ name: SfxName; at: number; volume?: number }> = ({ name, at, volume = 0.5 }) => (
  <Sequence from={at} durationInFrames={60} layout="none" name={`sfx ${name}`}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
