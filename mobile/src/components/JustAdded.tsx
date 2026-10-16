import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClosetItem, RunItem, RunResponse } from "../api/types";
import { useLastRun } from "../store/lastRun";
import { useAddBack } from "../useAddBack";
import { asList, capitalize, colors, fonts, radius } from "../theme";
import { GarmentImage } from "./GarmentImage";
import { ItemSheet } from "./ItemSheet";
import { BACK_STEPS, KEEP_OPEN, ProcessingStatus } from "./ProcessingStatus";
import { RetakeNote } from "./RetakeNote";
import { TierBadge } from "./TierBadge";

type NewItem = ClosetItem & Pick<RunItem, "reason" | "retake_instruction">;

function sameItem(a: { item_id: string; photo_name: string }, b: { item_id: string; photo_name: string }) {
  return a.item_id === b.item_id && a.photo_name === b.photo_name;
}

function NewRow({ item, onOpen, onUpdated }: { item: NewItem; onOpen: () => void; onUpdated: (i: ClosetItem) => void }) {
  const { ask, uploading, error } = useAddBack(item, onUpdated);
  return (
    <View style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Pressable onPress={onOpen} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: 72, height: 72 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: colors.ink }}>
              {capitalize(asList(item.facts.category.value)[0] ?? "Item")}
            </Text>
            <View style={{ flexDirection: "row" }}>
              <TierBadge tier={item.tier} />
            </View>
          </View>
        </Pressable>
        {item.back ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Ionicons name="checkmark-circle" size={16} color={colors.inkSoft} />
            <Text style={{ color: colors.inkSoft, fontSize: 13 }}>Back added</Text>
          </View>
        ) : uploading ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add back photo"
            onPress={ask}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8,
              borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <Ionicons name="add" size={15} color={colors.ink} />
            <Text style={{ color: colors.ink, fontSize: 13 }}>Back</Text>
          </Pressable>
        )}
      </View>
      {uploading ? (
        <View style={{ paddingTop: 16 }}>
          <ProcessingStatus steps={BACK_STEPS} note={KEEP_OPEN} estimateSeconds={30} />
        </View>
      ) : null}
      {item.retake_instruction ? <RetakeNote tier={item.tier} text={item.retake_instruction} /> : null}
      {error ? <Text style={{ color: colors.danger, fontSize: 14, marginTop: 8 }}>{error}</Text> : null}
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
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.ink }}>Just added</Text>
        <Pressable accessibilityRole="button" onPress={() => setLastRun(null)} hitSlop={10}>
          <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Done</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={{ color: colors.inkSoft, fontSize: 14, lineHeight: 20, paddingVertical: 12 }}>
          No pieces found in that photo. Try again with each piece laid flat, in good light.
        </Text>
      ) : (
        items.map((item, index) => (
          <NewRow key={`${item.photo_name}-${item.item_id}`} item={item} onOpen={() => setSelectedIndex(index)} onUpdated={replaceItem} />
        ))
      )}
      {run.failed.length > 0 ? (
        <Text style={{ color: colors.inkSoft, fontSize: 13, marginTop: 8 }}>
          {run.failed.length === 1 ? "One piece couldn't be processed." : `${run.failed.length} pieces couldn't be processed.`}
        </Text>
      ) : null}

      <ItemSheet items={items} index={selectedIndex} onClose={() => setSelectedIndex(null)} onUpdated={replaceItem} onDeleted={removeItem} />
    </View>
  );
}
