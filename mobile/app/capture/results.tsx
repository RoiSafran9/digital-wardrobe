import React, { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { deleteItem } from "../../src/api/client";
import type { ClosetItem, RunItem } from "../../src/api/types";
import { groupOf } from "../../src/categoryGroups";
import { FlowFooter } from "../../src/components/capture/FlowChrome";
import { GarmentTile } from "../../src/components/GarmentTile";
import { Icon } from "../../src/components/Icon";
import { RetakeNote } from "../../src/components/RetakeNote";
import { TierBadge } from "../../src/components/TierBadge";
import { useCredits } from "../../src/credits/CreditsProvider";
import { garmentName } from "../../src/garmentName";
import { haptics } from "../../src/haptics";
import { PopIn } from "../../src/motion/PopIn";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { asList, capitalize, colors, radius, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen } from "../../src/ui";
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
  const [footer, setFooter] = useState(0);
  const keep = items.filter((i) => !off.has(key(i)));
  const tile = (width - 40 - 10) / 2;

  if (!run) {
    return (
      <GlassScreen style={{ alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Button title="Back to Home" variant="glass" onPress={() => router.replace("/")} />
      </GlassScreen>
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
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: footer + 20, gap: 16 }}>
          <View style={{ gap: 4 }}>
            {nothing ? null : <Text style={{ ...type.eyebrow, ...weight(700), color: colors.successText }}>✓ Ready</Text>}
            <Text accessibilityRole="header" style={{ ...type.display(30), color: colors.label }}>
              {nothing ? "No pieces found" : `${items.length} ${items.length === 1 ? "piece" : "pieces"} created`}
            </Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
              {retake
                ? `This photo couldn't be used: ${run.quality.reason ?? "try again"}. Lay each piece flat, in good light.`
                : nothing
                  ? "No pieces found in that photo. Try again with each piece laid flat, in good light."
                  : "Tap to deselect anything you don't want to keep."}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {items.map((i, k) => {
              const on = !off.has(key(i));
              return (
                <PopIn key={key(i)} delay={k * 90} style={{ width: tile, gap: 6 }}>
                  <Pressable onPress={() => toggle(i)} accessibilityRole="checkbox" accessibilityLabel={garmentName(i)} accessibilityState={{ checked: on }}>
                    <View style={{ opacity: on ? 1 : 0.4 }}>
                      <GarmentTile item={i} width={tile} height={tile * 1.25} rounded={radius.garment} label={garmentName(i)} />
                    </View>
                    {on ? (
                      <View style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.tint }}>
                        <Icon name="checkmark" size={18} color={colors.onTint} />
                      </View>
                    ) : (
                      <Glass radius={15} level="card" style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30 }} />
                    )}
                  </Pressable>
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text numberOfLines={1} style={{ ...type.subhead, ...weight(600), color: colors.label, flex: 1 }}>{garmentName(i)}</Text>
                      <TierBadge tier={i.tier} />
                    </View>
                    <Text numberOfLines={1} style={{ ...type.footnote, color: colors.secondaryLabel }}>
                      {[groupOf(i), capitalize(asList(i.facts.colors.value)[0] ?? "")].filter(Boolean).join(" · ")}
                    </Text>
                  </View>
                  {i.retake_instruction ? <RetakeNote tier={i.tier} text={i.retake_instruction} /> : null}
                </PopIn>
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
          {error ? <Text style={{ ...type.footnote, color: colors.destructive }}>{error}</Text> : null}
        </ScrollView>
        <FlowFooter onHeight={setFooter}>
          {nothing ? (
            <Button title="Take Another Garment Photo" onPress={() => { clear(); router.replace({ pathname: "/capture/camera", params: { mode: "garments" } }); }} />
          ) : (
            <Button title={`Add ${keep.length} to Closet`} onPress={add} disabled={keep.length === 0} loading={saving} />
          )}
          {billing && off.size > 0 ? (
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 2 }}>Credits for removed pieces are not returned.</Text>
          ) : null}
          <Button title="Done" variant="text" onPress={() => { clear(); router.replace("/"); }} />
        </FlowFooter>
      </SafeAreaView>
    </GlassScreen>
  );
}
