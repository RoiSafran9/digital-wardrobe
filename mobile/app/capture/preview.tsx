import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CameraPill, FadeFromBlack, FlowBar, FlowFooter, PHOTO_BG, Viewfinder } from "../../src/components/capture/FlowChrome";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { useFrontsChoice } from "../../src/credits/useFrontsChoice";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { Button, Glass, GlassScreen, GroupedList, InsufficientCreditsSheet, Row } from "../../src/ui";
import { scanGarments } from "../../src/api/client";
import type { GarmentScan } from "../../src/api/types";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { useCredits } from "../../src/credits/CreditsProvider";
import { pieceLabel } from "../../src/footwear";
import { haptics } from "../../src/haptics";
import { TRY_AS_OUTFIT, isWornRejection } from "../../src/outfit/outfit";
import { useScreenViewed } from "../../src/activity/track";

// The fallback quote (local mode, or when the free pre-scan isn't available): following the approved
// rule (CREDITS §6), the user approves the most front images they'll pay for; the server makes at most
// that many and charges only what it made.
function MaxFrontsPreview({ uri, note }: { uri: string; note?: string | null }) {
  const router = useRouter();
  const { start } = useCaptureJobs();
  const fronts = useFrontsChoice();
  const [short, setShort] = useState(false);
  const [footer, setFooter] = useState(0);
  const { active, fronts: n, max, price, available } = fronts;

  const generate = () => {
    if (fronts.blocked) return setShort(true);
    start(uri, fronts.maxFronts);
    router.replace("/capture/processing");
  };

  const step = (label: string, icon: "add" | "remove", enabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !enabled }} disabled={!enabled}
      onPress={() => fronts.setFronts(next)} hitSlop={hitSlopFor(34, 34)}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: pressed ? colors.tintSoft : colors.fill, alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.4 })}
    >
      <Icon name={icon} size={16} color={colors.tint} />
    </Pressable>
  );

  return (
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <FlowBar left={{ icon: "chevronLeft", label: "Retake", onPress: () => router.back() }} title="Preview" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: footer + 20, gap: 16 }}>
          <Image source={{ uri }} accessibilityLabel="Your photo" style={{ width: "100%", height: 300, borderRadius: radius.feature, backgroundColor: PHOTO_BG }} resizeMode="cover" />

          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>Ready to create</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
              Each piece in the photo becomes its own catalog image. Finding them is free.
            </Text>
            {note ? <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{note}</Text> : null}
          </View>

          {active ? (
            <View style={{ gap: 8 }}>
              <GroupedList>
                <Row label="Pieces in this photo" accessory={
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    {step("Fewer pieces", "remove", n > 1, n - 1)}
                    <Text accessibilityLabel={`${n} pieces`} style={{ ...type.headline, color: colors.label, fontVariant: ["tabular-nums"], minWidth: 22, textAlign: "center" }}>{n}</Text>
                    {step("More pieces", "add", n < max, n + 1)}
                  </View>
                } />
                <Row label={`Front catalog image × ${n}`} value={creditsLabel(n * price)} />
                <Row label="Balance after" value={creditsLabel(Math.max(0, available - n * price))} />
              </GroupedList>
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, paddingHorizontal: 16 }}>
                You pay only for the pieces made, up to this number; extra pieces aren't made.
              </Text>
            </View>
          ) : null}
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
            You can review every piece once it's ready.
          </Text>
        </ScrollView>
        <FlowFooter onHeight={setFooter}>
          <Button
            title={active ? `Generate up to ${n} ${n === 1 ? "Item" : "Items"} · ${creditsLabel(n * price)}` : "Create Catalog Images"}
            onPress={generate}
          />
        </FlowFooter>
      </SafeAreaView>
      <FadeFromBlack />
      <InsufficientCreditsSheet visible={short} needed={price} onClose={() => setShort(false)} />
    </GlassScreen>
  );
}

// The free scan runs on the camera's dark screen: the photo stays in the viewfinder where it was taken
// while a band sweeps over it.
function Scanning({ uri, onBack }: { uri: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#000000", paddingTop: Math.max(insets.top, 54) + 6, paddingBottom: Math.max(insets.bottom, 20) }}>
      <StatusBar style="light" />
      <FlowBar dark left={{ icon: "chevronLeft", label: "Retake", onPress: onBack }} title="Finding the pieces…" live />
      <Viewfinder>
        <Image source={{ uri }} accessibilityLabel="Your photo" style={StyleSheet.absoluteFill} resizeMode="cover" />
        <ScanBand />
      </Viewfinder>
      <View style={{ minHeight: 170, justifyContent: "center" }}>
        <CameraPill text="Finding them is free" />
      </View>
    </View>
  );
}

// One piece the scan found: "1 · White shirt ×" to leave it out, dimmed with a + to bring it back.
function PieceChip({ n, label, on, onPress }: { n: number; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${n}, ${label}`} hitSlop={hitSlopFor(34)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: on ? undefined : colors.fill }}>
        {on ? <Glass radius={radius.pill} level="card" style={StyleSheet.absoluteFill} /> : null}
        <Text style={{ ...type.toast, color: on ? colors.label : colors.secondaryLabel, textDecorationLine: on ? "none" : "line-through" }}>
          <Text style={{ color: on ? colors.tint : colors.secondaryLabel }}>{n}</Text>{` · ${label}`}
        </Text>
        <Icon name={on ? "close" : "add"} size={12} color={colors.secondaryLabel} />
      </View>
    </Pressable>
  );
}

export const SCAN_FALLBACK = "Couldn't find the pieces first — choose how many to create instead.";

// Garment photo preview (spec D6 b): a free pre-scan finds the pieces, the user picks which to create and
// pays only for those. Local mode, or a server without pre-scans, uses the max-fronts quote instead.
export default function PreviewScreen() {
  useScreenViewed("preview");
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { startFromScan } = useCaptureJobs();
  const { billing, prices, credits, outfit } = useCredits();
  const [scan, setScan] = useState<GarmentScan | null>(null);
  const [mode, setMode] = useState<"scanning" | "scanned" | "fallback">("scanning");
  const [note, setNote] = useState<string | null>(null);
  const [off, setOff] = useState<Set<number>>(new Set());
  const [short, setShort] = useState(false);
  const [footer, setFooter] = useState(0);

  useEffect(() => {
    let live = true;
    scanGarments(uri)
      .then((s) => { if (!live) return; if (s) { setScan(s); setMode("scanned"); } else setMode("fallback"); })
      .catch(() => { if (live) { setNote(SCAN_FALLBACK); setMode("fallback"); } });
    return () => { live = false; };
  }, [uri]);

  const pieces = scan?.pieces ?? [];
  const picked = pieces.filter((p) => !off.has(p.index));
  const price = billing ? prices.garment : undefined;
  const total = (price ?? 0) * picked.length;
  const available = credits?.available ?? 0;
  const boxes = useMemo(() => pieces.map((p) => ({ id: `p${p.index}`, box: p.box })), [pieces]);
  const label = pieceLabel;

  if (mode === "fallback") return <MaxFrontsPreview uri={uri} note={note} />;
  if (mode === "scanning") return <Scanning uri={uri} onBack={() => router.back()} />;

  const toggle = (index: number) => {
    haptics.selection();
    setOff((s) => { const n = new Set(s); n.has(index) ? n.delete(index) : n.add(index); return n; });
  };
  const generate = () => {
    if (!scan || picked.length === 0) return;
    if (price !== undefined && total > available) return setShort(true);
    startFromScan(uri, scan.id, picked.map((p) => p.index), price ?? null);
    router.replace("/capture/processing");
  };
  const retake = scan?.quality?.status === "retake";
  const nothing = !retake && pieces.length === 0;
  const deselect = price ? Math.max(0, picked.length - Math.floor(available / price)) : 0;

  return (
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <FlowBar left={{ icon: "chevronLeft", label: "Retake", onPress: () => router.back() }} title="Preview" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: footer + 20, gap: 16 }}>
          <PhotoWithBoxes framed wash={false} uri={uri} candidates={retake ? [] : boxes} photoSize={scan?.image}
            selected={picked.map((p) => `p${p.index}`)} onToggle={(id) => toggle(Number(id.slice(1)))} maxHeight={300} />
          {retake ? (
            <View style={{ gap: 6 }}>
              <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>This photo can't be used</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel }}>{`${scan?.quality?.reason ?? "Try again"}. Lay each piece flat, in good light.`}</Text>
            </View>
          ) : nothing ? (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>No pieces found</Text>
              <Text style={{ ...type.body, color: colors.secondaryLabel }}>{scan?.reason ?? "Try again with each piece laid flat, in good light."}</Text>
              {outfit && isWornRejection(scan?.reason) ? (
                <Button title={TRY_AS_OUTFIT} variant="glass" onPress={() => router.replace({ pathname: "/outfit/detect", params: { uri, flow: "outfit" } })} />
              ) : null}
            </View>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>
                  {pieces.length === 1 ? "1 garment found" : `${pieces.length} garments found`}
                </Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Tap a piece to leave it out. You pay only for the ones you create.</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {pieces.map((p, i) => <PieceChip key={p.index} n={i + 1} label={label(p)} on={!off.has(p.index)} onPress={() => toggle(p.index)} />)}
              </View>
              {price !== undefined ? (
                <GroupedList>
                  <Row label={`Front catalog image × ${picked.length}`} value={creditsLabel(total)} />
                  <Row label="Balance after" value={creditsLabel(Math.max(0, available - total))} />
                </GroupedList>
              ) : null}
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>You'll review every piece once it's ready.</Text>
            </>
          )}
        </ScrollView>
        <FlowFooter onHeight={setFooter}>
          {retake || nothing ? (
            <Button title="Retake" onPress={() => router.back()} />
          ) : (
            <Button
              title={price !== undefined
                ? `Generate ${picked.length} ${picked.length === 1 ? "Item" : "Items"} · ${creditsLabel(total)}`
                : `Create ${picked.length} ${picked.length === 1 ? "Item" : "Items"}`}
              onPress={generate}
              disabled={picked.length === 0}
            />
          )}
        </FlowFooter>
      </SafeAreaView>
      <FadeFromBlack />
      <InsufficientCreditsSheet
        visible={short} needed={total} onClose={() => setShort(false)}
        onAdjust={deselect > 0 ? () => setShort(false) : undefined}
        body={deselect > 0 ? `Leave out ${deselect} ${deselect === 1 ? "piece" : "pieces"} to continue with what you have.` : undefined}
      />
    </GlassScreen>
  );
}
