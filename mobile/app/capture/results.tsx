import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { deleteItem } from "../../src/api/client";
import type { ClosetItem, RunItem } from "../../src/api/types";
import { groupOf } from "../../src/categoryGroups";
import { GarmentTile } from "../../src/components/GarmentTile";
import { Icon } from "../../src/components/Icon";
import { RetakeNote } from "../../src/components/RetakeNote";
import { TierBadge } from "../../src/components/TierBadge";
import { useCredits } from "../../src/credits/CreditsProvider";
import { garmentName } from "../../src/garmentName";
import { haptics } from "../../src/haptics";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { asList, capitalize, colors, radius, type } from "../../src/theme";
import { Button } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

type Made = ClosetItem & Pick<RunItem, "reason" | "retake_instruction">;
const key = (i: { photo_name: string; item_id: string }) => `${i.photo_name}/${i.item_id}`;

// The pieces the photo produced. They are already saved (and the fronts made were charged); anything
// deselected here is removed on "Add N to Closet".
export default function ResultsScreen() {
  useScreenViewed("results");
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { current, clear, setSaved } = useCaptureJobs();
  const { billing, prices } = useCredits();
  const run = current?.result;
  const items: Made[] = run ? run.items.map((i) => ({ ...i, run_id: run.run_id })) : [];
  const [off, setOff] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keep = items.filter((i) => !off.has(key(i)));
  const tile = (width - 40 - 12) / 2;

  if (!run) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="secondary" onPress={() => router.replace("/")} />
      </SafeAreaView>
    );
  }

  const toggle = (i: Made) => {
    haptics.selection();
    setOff((s) => { const n = new Set(s); n.has(key(i)) ? n.delete(key(i)) : n.add(key(i)); return n; });
  };

  async function add() {
    setSaving(true);
    setError(null);
    try {
      for (const i of items) if (off.has(key(i))) await deleteItem(i);
      haptics.success();
      const made = items.length;
      setSaved({ items: keep, creditsUsed: billing && prices.garment !== undefined ? made * prices.garment : null });
      clear();
      router.replace("/capture/saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update your closet. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const retake = run.quality.status === "retake";
  const nothing = items.length === 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ gap: 6, marginTop: 8 }}>
          {nothing ? null : <Text style={{ ...type.eyebrow, color: colors.successText }}>✓ Ready</Text>}
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>
            {nothing ? "No pieces found" : `${items.length} ${items.length === 1 ? "piece" : "pieces"} created`}
          </Text>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
            {retake
              ? `This photo couldn't be used: ${run.quality.reason ?? "try again"}. Lay each piece flat, in good light.`
              : nothing
                ? "No pieces found in that photo. Try again with each piece laid flat, in good light."
                : "Tap to deselect anything you don't want to keep."}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {items.map((i) => {
            const on = !off.has(key(i));
            return (
              <View key={key(i)} style={{ width: tile, gap: 8, opacity: on ? 1 : 0.4 }}>
                <Pressable onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityLabel={garmentName(i)} accessibilityState={{ checked: on }}>
                  <GarmentTile item={i} width={tile} height={tile * 1.25} label={garmentName(i)} />
                  <View style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.tint : colors.card, borderWidth: on ? 0 : 1.5, borderColor: colors.separatorStrong }}>
                    {on ? <Icon name="checkmark" size={13} color={colors.onTint} /> : null}
                  </View>
                </Pressable>
                <View style={{ gap: 4 }}>
                  <Text numberOfLines={1} style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{garmentName(i)}</Text>
                  <Text numberOfLines={1} style={{ ...type.footnote, color: colors.secondaryLabel }}>
                    {[groupOf(i), capitalize(asList(i.facts.colors.value)[0] ?? "")].filter(Boolean).join(" · ")}
                  </Text>
                  <View style={{ flexDirection: "row" }}><TierBadge tier={i.tier} /></View>
                </View>
                {i.retake_instruction ? <RetakeNote tier={i.tier} text={i.retake_instruction} /> : null}
              </View>
            );
          })}
        </View>

        {run.over_limit ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
            {run.over_limit === 1
              ? "1 more piece in the photo wasn't made (over your limit). Take another photo to add it."
              : `${run.over_limit} more pieces in the photo weren't made (over your limit). Take another photo to add them.`}
          </Text>
        ) : null}
        {run.failed.length > 0 ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>
            {run.failed.length === 1 ? "One piece couldn't be processed." : `${run.failed.length} pieces couldn't be processed.`}
          </Text>
        ) : null}
        {billing && off.size > 0 ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>Credits for removed pieces are not returned.</Text>
        ) : null}
        {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
        {nothing ? (
          <Button title="Take Another Garment Photo" onPress={() => { clear(); router.replace("/capture/camera"); }} />
        ) : (
          <Button title={`Add ${keep.length} to Closet`} onPress={add} disabled={keep.length === 0} loading={saving} />
        )}
        <Button title="Done" variant="text" onPress={() => { clear(); router.replace("/"); }} />
      </View>
    </SafeAreaView>
  );
}
