import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ClosetItem, RunItem } from "../api/types";
import { addedLabel, asList, capitalize, colors, fonts } from "../theme";
import { ColorSwatches } from "./ColorSwatches";
import { GarmentImage } from "./GarmentImage";
import { TierBadge } from "./TierBadge";

type Item = RunItem | ClosetItem;

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16,
        paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

function FactText({ children }: { children: string }) {
  return <Text style={{ color: colors.ink, fontSize: 14, textAlign: "right" }}>{children}</Text>;
}

export function ItemSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Modal visible={item !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {item ? <SheetContent item={item} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetContent({ item, onClose }: { item: Item; onClose: () => void }) {
  const { facts } = item;
  const trims = asList(facts.trims.value).filter((t) => t.toLowerCase() !== "not visible");
  const text = asList(facts.visible_text.value);
  const added = "run_id" in item ? addedLabel(item.run_id) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
            backgroundColor: colors.sunken, transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <Ionicons name="close" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 48 }}>
        <GarmentImage path={item.generated_url} tile={colors.paper} style={{ width: "100%", aspectRatio: 1 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.ink, flexShrink: 1 }}>
            {capitalize(asList(facts.category.value)[0] ?? "Item")}
          </Text>
          <TierBadge tier={item.tier} />
        </View>
        {added ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{added}</Text> : null}

        <View style={{ marginTop: 20 }}>
          <FactRow label="Colors">
            <ColorSwatches value={facts.colors.value} />
          </FactRow>
          <FactRow label="Pattern">
            <FactText>{capitalize(asList(facts.pattern.value).join(", "))}</FactText>
          </FactRow>
          {trims.length > 0 ? (
            <FactRow label="Details">
              <FactText>{capitalize(trims.join(", "))}</FactText>
            </FactRow>
          ) : null}
          {text.length > 0 ? (
            <FactRow label="Text">
              <FactText>{`“${text.join(" ")}”`}</FactText>
            </FactRow>
          ) : null}
        </View>

        {"retake_instruction" in item && item.retake_instruction ? (
          <View style={{ marginTop: 20, backgroundColor: colors.dangerBg, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: colors.danger, fontSize: 14 }}>{item.retake_instruction}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
