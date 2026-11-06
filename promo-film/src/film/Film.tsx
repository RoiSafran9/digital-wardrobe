import React from "react";
import { Audio } from "@remotion/media";
import { AbsoluteFill, getStaticFiles, interpolate, Sequence, staticFile, useVideoConfig } from "remotion";
import { MUSIC_FILE, MUSIC_START, sceneFrom, sceneLength } from "./config";
import { Backdrop } from "./components/Backdrop";
import { S0Hook } from "./scenes/S0Hook";
import { type Opening, SOpening } from "./scenes/SOpening";
import { S1Pieces } from "./scenes/S1Pieces";
import { S2Outfit } from "./scenes/S2Outfit";
import { S3Closet } from "./scenes/S3Closet";
import { S4Spin } from "./scenes/S4Spin";
import { S5Looks } from "./scenes/S5Looks";
import { S6Swap } from "./scenes/S6Swap";
import { S8Brand } from "./scenes/S8Brand";

// KIPS launch film V16 — "More looks. Same closet." 21 bars, 1379 frames, 9:16, no voiceover.
const Music: React.FC = () => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!getStaticFiles().some((f) => f.name === MUSIC_FILE)) return null;
  return (
    <Audio src={staticFile(MUSIC_FILE)} trimBefore={Math.round(MUSIC_START * fps)}
      volume={(f) => interpolate(f, [0, 3, durationInFrames - 60, durationInFrames], [0, 0.72, 0.72, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
  );
};

export const Film: React.FC<{ opening: Opening }> = ({ opening }) => (
  <AbsoluteFill>
    <Backdrop />
    <Sequence name="Opening" from={sceneFrom("opening")} durationInFrames={sceneLength("opening")}><SOpening variant={opening} /></Sequence>
    <Sequence name="S0 Hook" from={sceneFrom("hook")} durationInFrames={sceneLength("hook")}><S0Hook /></Sequence>
    <Sequence name="S1 Clean catalog" from={sceneFrom("photo")} durationInFrames={sceneLength("photo")}><S1Pieces /></Sequence>
    <Sequence name="S2 Outfit photo" from={sceneFrom("outfit")} durationInFrames={sceneLength("outfit")}><S2Outfit /></Sequence>
    <Sequence name="S3 Closet" from={sceneFrom("closet")} durationInFrames={sceneLength("closet")}><S3Closet /></Sequence>
    <Sequence name="S4 AI 360" from={sceneFrom("spin")} durationInFrames={sceneLength("spin")}><S4Spin /></Sequence>
    <Sequence name="S5 Build My Look" from={sceneFrom("looks")} durationInFrames={sceneLength("looks")}><S5Looks /></Sequence>
    <Sequence name="S6 Swap" from={sceneFrom("swap")} durationInFrames={sceneLength("swap")}><S6Swap /></Sequence>
    <Sequence name="S8 Brand" from={sceneFrom("brand")} durationInFrames={sceneLength("brand")}><S8Brand /></Sequence>
    <Music />
  </AbsoluteFill>
);
