import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "./Icon";
import type { ClosetItem, RunItem, RunResponse } from "../api/types";
import { useLastRun } from "../store/lastRun";
import { useAddBack } from "../useAddBack";
import { asList, capitalize, colors, radius, type } from "../theme";
import { GarmentImage } from "./GarmentImage";
import { ItemSheet } from "./ItemSheet";
import { BACK_STEPS, KEEP_OPEN, ProcessingStatus } from "./ProcessingStatus";
import { RetakeNote } from "./RetakeNote";
import { TierBadge } from "./TierBadge";

type NewItem = ClosetItem & Pick<RunItem, "reason" | "retake_instruction">;

function sameItem(a: { item_id: string; photo_name: string }, b: { item_id: string; photo_name: string }) {
  return a.item_id === b.item_id && a.photo_name === b.photo_name;
}

function NewRow({ item, onOpen, onUpdated, first }: { item: NewItem; onOpen: () => void; onUpdated: (i: ClosetItem) => void; first?: boolean }) {
  const { ask, uploading, error } = useAddBack(item, onUpdated);
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={onOpen} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: 72, height: 72 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ ...type.headline, color: colors.label }}>
              {capitalize(asList(item.facts.category.value)[0] ?? "Item")}
            </Text>
            <View style={{ flexDirection: "row" }}>
              <TierBadge tier={item.tier} />
            </View>
          </View>
        </Pressable>
        {item.back ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="check" size={16} color={colors.secondaryLabel} />
            <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>Back added</Text>
          </View>
        ) : uploading ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add back photo"
            onPress={ask}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
              borderRadius: radius.pill, backgroundColor: colors.tile,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Icon name="add" size={15} color={colors.label} />
            <Text style={{ ...type.footnote, color: colors.tint }}>Back</Text>
          </Pressable>
        )}
      </View>
      {uploading ? (
        <View style={{ paddingTop: 16 }}>
          <ProcessingStatus steps={BACK_STEPS} note={KEEP_OPEN} estimateSeconds={30} />
        </View>
      ) : null}
      {item.retake_instruction ? <RetakeNote tier={item.tier} text={item.retake_instruction} /> : null}
      {error ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: 8 }}>{error}</Text> : null}
    </View>
  );
}

// The latest capture, shown at the top of the closet until dismissed. Replaces the old
// "New" tab: new pieces live in the closet, this just keeps them in reach for a moment.
export function JustAdded({ onClosetChanged }: { onClosetChanged: () => void }) {
  const { lastRun, setLastRun } = useLastRun();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  if (!lastRun) return null;

  const run: RunResponse = lastRun;
  const items: NewItem[] = run.items.map((item) => ({ ...item, run_id: run.run_id }));
  const replaceItem = (updated: ClosetItem) => {
    setLastRun({ ...run, items: run.items.map((i) => (sameItem(i, updated) ? { ...i, ...updated } : i)) });
    onClosetChanged();
  };
  const removeItem = (removed: ClosetItem) => {
    setSelectedIndex(null);
    setLastRun({ ...run, items: run.items.filter((i) => !sameItem(i, removed)) });
    onClosetChanged();
  };

  return (
    <View style={{ marginBottom: 28 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <Text style={{ ...type.title2, color: colors.label }}>Just added</Text>
        <Pressable accessibilityRole="button" onPress={() => setLastRun(null)} hitSlop={10}>
          <Text style={{ ...type.body, color: colors.tint }}>Done</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, padding: 14 }}>
          No pieces found in that photo. Try again with each piece laid flat, in good light.
        </Text>
      ) : (
        <View style={{ backgroundColor: colors.card, borderRadius: radius.card, overflow: "hidden" }}>
          {items.map((item, index) => (
            <NewRow key={`${item.photo_name}-${item.item_id}`} item={item} first={index === 0} onOpen={() => setSelectedIndex(index)} onUpdated={replaceItem} />
          ))}
        </View>
      )}
      {run.over_limit ? (
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 8 }}>
          {run.over_limit === 1
            ? "1 more piece in the photo wasn't made (over your limit). Take another photo to add it."
            : `${run.over_limit} more pieces in the photo weren't made (over your limit). Take another photo to add them.`}
        </Text>
      ) : null}
      {run.failed.length > 0 ? (
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 8 }}>
          {run.failed.length === 1 ? "One piece couldn't be processed." : `${run.failed.length} pieces couldn't be processed.`}
        </Text>
      ) : null}

      <ItemSheet items={items} index={selectedIndex} onClose={() => setSelectedIndex(null)} onUpdated={replaceItem} onDeleted={removeItem} />
    </View>
  );
}
