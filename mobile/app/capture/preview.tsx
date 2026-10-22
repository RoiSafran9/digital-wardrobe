import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { creditsLabel } from "../../src/credits/credits";
import { useFrontsChoice } from "../../src/credits/useFrontsChoice";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { colors, hitSlopFor, radius, type } from "../../src/theme";
import { BackButton, Button, InsufficientCreditsSheet } from "../../src/ui";
import { scanGarments } from "../../src/api/client";
import type { GarmentScan } from "../../src/api/types";
import { PhotoWithBoxes } from "../../src/components/outfit/PhotoWithBoxes";
import { ScanBand } from "../../src/components/outfit/ScanBand";
import { useCredits } from "../../src/credits/CreditsProvider";
import { garmentName } from "../../src/garmentName";
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
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.4 }}
    >
      <Icon name={icon} size={16} color={colors.tint} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <BackButton label="Retake" onPress={() => router.back()} />
        <Text style={{ ...type.headline, color: colors.label }}>Preview</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Image source={{ uri }} accessibilityLabel="Your photo" style={{ width: "100%", aspectRatio: 1, borderRadius: radius.feature, backgroundColor: colors.tile }} resizeMode="cover" />

        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Ready to create</Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
            Each piece in the photo becomes its own catalog image. Finding them is free.
          </Text>
          {note ? <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{note}</Text> : null}
        </View>

        {active ? (
          <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...type.body, color: colors.label }}>Pieces in this photo</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {step("Fewer pieces", "remove", n > 1, n - 1)}
                <Text accessibilityLabel={`${n} pieces`} style={{ ...type.headline, color: colors.label, fontVariant: ["tabular-nums"], minWidth: 22, textAlign: "center" }}>{n}</Text>
                {step("More pieces", "add", n < max, n + 1)}
              </View>
            </View>
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingTop: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.body, color: colors.label }}>{`Front catalog image × ${n}`}</Text>
                <Text style={{ ...type.body, color: colors.label }}>{creditsLabel(n * price)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Balance after</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{creditsLabel(Math.max(0, available - n * price))}</Text>
              </View>
            </View>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
              You pay only for the pieces made, up to this number; extra pieces aren't made.
            </Text>
          </View>
        ) : null}
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
          You can review every piece once it's ready.
        </Text>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        <Button
          title={active ? `Generate up to ${n} ${n === 1 ? "Item" : "Items"} · ${creditsLabel(n * price)}` : "Create Catalog Images"}
          onPress={generate}
        />
      </View>
      <InsufficientCreditsSheet visible={short} needed={price} onClose={() => setShort(false)} />
    </SafeAreaView>
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
  const label = (p: (typeof pieces)[number]) =>
    garmentName({ facts: { category: { value: p.category }, colors: { value: p.colors } } } as never);

  if (mode === "fallback") return <MaxFrontsPreview uri={uri} note={note} />;

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
  const nothing = mode === "scanned" && !retake && pieces.length === 0;
  const deselect = price ? Math.max(0, picked.length - Math.floor(available / price)) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
        <BackButton label="Retake" onPress={() => router.back()} />
        <Text style={{ ...type.headline, color: colors.label }}>Preview</Text>
        <View style={{ width: 70 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <PhotoWithBoxes uri={uri} candidates={retake ? [] : boxes} photoSize={scan?.image}
          selected={picked.map((p) => `p${p.index}`)} onToggle={(id) => toggle(Number(id.slice(1)))}
          overlay={mode === "scanning" ? <ScanBand /> : null} maxHeight={380} />
        {mode === "scanning" ? (
          <View style={{ alignItems: "center", gap: 8 }}>
            <Text accessibilityLiveRegion="polite" style={{ ...type.section, color: colors.label }}>Finding the pieces…</Text>
            <Text style={{ ...type.footnote, fontWeight: "600", color: colors.successText }}>Finding them is free</Text>
          </View>
        ) : retake ? (
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>This photo can't be used</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel }}>{`${scan?.quality?.reason ?? "Try again"}. Lay each piece flat, in good light.`}</Text>
          </View>
        ) : nothing ? (
          <View style={{ gap: 10 }}>
            <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>No pieces found</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel }}>{scan?.reason ?? "Try again with each piece laid flat, in good light."}</Text>
            {outfit && isWornRejection(scan?.reason) ? (
              <Button title={TRY_AS_OUTFIT} variant="secondary" onPress={() => router.replace({ pathname: "/outfit/detect", params: { uri, flow: "outfit" } })} />
            ) : null}
          </View>
        ) : (
          <>
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>
                {pieces.length === 1 ? "1 garment found" : `${pieces.length} garments found`}
              </Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Tap a piece to leave it out. You pay only for the ones you create.</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {pieces.map((p, i) => {
                const on = !off.has(p.index);
                return (
                  <Pressable key={p.index} onPress={() => toggle(p.index)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    accessibilityLabel={`${i + 1}, ${label(p)}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.pill,
                      backgroundColor: on ? colors.tintSoft : colors.fill, borderWidth: 1.5, borderColor: on ? colors.tint : "transparent" }}>
                    <Text style={{ ...type.footnote, fontWeight: "700", color: on ? colors.tint : colors.secondaryLabel }}>{i + 1}</Text>
                    <Text style={{ ...type.subhead, color: on ? colors.label : colors.secondaryLabel }}>{label(p)}</Text>
                  </Pressable>
                );
              })}
            </View>
            {price !== undefined ? (
              <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, padding: 16, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...type.body, color: colors.label }}>{`Front catalog image × ${picked.length}`}</Text>
                  <Text style={{ ...type.body, color: colors.label }}>{creditsLabel(total)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Balance after</Text>
                  <Text style={{ ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{creditsLabel(Math.max(0, available - total))}</Text>
                </View>
              </View>
            ) : null}
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>You'll review every piece once it's ready.</Text>
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        {retake || nothing ? (
          <Button title="Retake" onPress={() => router.back()} />
        ) : (
          <Button
            title={price !== undefined
              ? `Generate ${picked.length} ${picked.length === 1 ? "Item" : "Items"} · ${creditsLabel(total)}`
              : `Create ${picked.length} ${picked.length === 1 ? "Item" : "Items"}`}
            onPress={generate}
            disabled={mode !== "scanned" || picked.length === 0}
          />
        )}
      </View>
      <InsufficientCreditsSheet
        visible={short} needed={total} onClose={() => setShort(false)}
        onAdjust={deselect > 0 ? () => setShort(false) : undefined}
        body={deselect > 0 ? `Leave out ${deselect} ${deselect === 1 ? "piece" : "pieces"} to continue with what you have.` : undefined}
      />
    </SafeAreaView>
  );
}
