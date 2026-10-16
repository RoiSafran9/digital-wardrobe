import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addBack, deleteItem } from "../api/client";
import { pickPhoto } from "../photoPicker";
import { PillButton } from "./PillButton";
import type { ClosetItem, RunItem } from "../api/types";
import { addedLabel, asList, capitalize, colors, fonts, radius } from "../theme";
import { ColorSwatches } from "./ColorSwatches";
import { GarmentImage } from "./GarmentImage";
import { ItemEditForm } from "./ItemEditForm";
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

type Props = {
  items: Item[];
  index: number | null;
  onClose: () => void;
  // Closet only: when given, the sheet offers editing and removing the item.
  onUpdated?: (item: ClosetItem) => void;
  onDeleted?: (item: ClosetItem) => void;
};

function isClosetItem(item: Item): item is ClosetItem {
  return "photo_name" in item;
}

// Opens on items[index]; swipe left/right to page through the rest of the list.
export function ItemSheet({ items, index, onClose, onUpdated, onDeleted }: Props) {
  const visible = index !== null && index >= 0 && index < items.length;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {visible ? (
        <Pager items={items} startIndex={index} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      ) : null}
    </Modal>
  );
}

function Pager({ items, startIndex, onClose, onUpdated, onDeleted }: Omit<Props, "index"> & { startIndex: number }) {
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(startIndex);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const currentItem = items[current];
  const canEdit = !!onUpdated && !!currentItem && isClosetItem(currentItem);

  function confirmRemove(item: ClosetItem) {
    Alert.alert("Remove this item?", "It leaves your closet. You can restore it from the server's trash.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(item);
            onDeleted?.(item);
          } catch (e) {
            Alert.alert("Couldn't remove it", e instanceof Error ? e.message : "Try again.");
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View
        style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 20, paddingTop: 16,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>
          {editing ? "Editing" : items.length > 1 ? `${current + 1} / ${items.length}` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {canEdit && !editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit"
              onPress={() => setEditing(true)}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
                backgroundColor: colors.sunken, transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            >
              <Ionicons name="pencil" size={17} color={colors.ink} />
            </Pressable>
          ) : null}
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
      </View>

      <FlatList
        testID="item-pager"
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!editing && !busy}
        extraData={editing}
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(item, i) => ("run_id" in item ? `${item.run_id}-${item.item_id}` : `${item.item_id}-${i}`)}
        onMomentumScrollEnd={(e) => {
          const { contentOffset, layoutMeasurement } = e.nativeEvent;
          setCurrent(Math.round(contentOffset.x / layoutMeasurement.width));
        }}
        renderItem={({ item, index }) => (
          <View style={{ width }}>
            {editing && index === current && isClosetItem(item) ? (
              <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
                <ItemEditForm
                  item={item}
                  onCancel={() => setEditing(false)}
                  onSaved={(updated) => {
                    setEditing(false);
                    onUpdated?.(updated);
                  }}
                />
              </ScrollView>
            ) : (
              <SheetContent
                item={item}
                onRemove={onDeleted && isClosetItem(item) ? () => confirmRemove(item) : undefined}
                onUpdated={onUpdated}
                onBusy={setBusy}
              />
            )}
          </View>
        )}
      />
    </View>
  );
}

function SideToggle({ side, onChange }: { side: "front" | "back"; onChange: (s: "front" | "back") => void }) {
  return (
    <View style={{ flexDirection: "row", alignSelf: "center", marginTop: 12, backgroundColor: colors.sunken, borderRadius: radius.pill, padding: 3 }}>
      {(["front", "back"] as const).map((name) => {
        const on = name === side;
        return (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={capitalize(name)}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(name)}
            style={{ paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: on ? colors.surface : "transparent" }}
          >
            <Text style={{ color: on ? colors.ink : colors.muted, fontSize: 13 }}>{capitalize(name)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type SheetContentProps = {
  item: Item;
  onRemove?: () => void;
  onUpdated?: (item: ClosetItem) => void;
  onBusy?: (busy: boolean) => void;
};

function SheetContent({ item, onRemove, onUpdated, onBusy }: SheetContentProps) {
  const { facts } = item;
  const trims = asList(facts.trims.value).filter((t) => t.toLowerCase() !== "not visible");
  const text = asList(facts.visible_text.value);
  const added = "run_id" in item ? addedLabel(item.run_id) : null;
  const back = isClosetItem(item) ? item.back ?? null : null;
  const [side, setSide] = useState<"front" | "back">("front");
  const [uploading, setUploading] = useState(false);
  const [backError, setBackError] = useState<string | null>(null);
  const showBack = side === "back" && back !== null;

  async function uploadBack(fromCamera: boolean) {
    if (!isClosetItem(item) || !onUpdated) return;
    setBackError(null);
    let uri: string | null;
    try {
      uri = await pickPhoto(fromCamera);
    } catch (e) {
      setBackError(e instanceof Error ? e.message : "couldn't open the camera");
      return;
    }
    if (!uri) return;
    setUploading(true);
    onBusy?.(true);
    try {
      onUpdated(await addBack(item, uri));
      setSide("back");
    } catch (e) {
      setBackError(e instanceof Error ? e.message : "couldn't add the back");
    } finally {
      setUploading(false);
      onBusy?.(false);
    }
  }

  function askForBack() {
    Alert.alert("Add the back", "Lay the item flat, back side up, with all of it in the frame.", [
      { text: "Take photo", onPress: () => uploadBack(true) },
      { text: "Choose from library", onPress: () => uploadBack(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 48 }}>
        {showBack ? (
          <GarmentImage key="back" path={back.generated_url} cutoutPath={back.cutout_url} tile={colors.paper} style={{ width: "100%", aspectRatio: 1 }} />
        ) : (
          <GarmentImage key="front" path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} tile={colors.paper} style={{ width: "100%", aspectRatio: 1 }} />
        )}
        {back ? <SideToggle side={side} onChange={setSide} /> : null}
        {!back && onUpdated && isClosetItem(item) ? (
          <View style={{ marginTop: 14 }}>
            {uploading ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14 }}>
                <ActivityIndicator color={colors.ink} />
                <Text style={{ color: colors.inkSoft, fontSize: 14 }}>Pressing the back… up to a minute</Text>
              </View>
            ) : (
              <PillButton label="Add back photo" icon="camera-reverse-outline" onPress={askForBack} />
            )}
          </View>
        ) : null}
        {backError ? <Text style={{ color: colors.danger, fontSize: 14, marginTop: 10, textAlign: "center" }}>{backError}</Text> : null}

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
          {back && back.visible_text ? (
            <FactRow label="Back text">
              <FactText>{`“${back.visible_text}”`}</FactText>
            </FactRow>
          ) : null}
        </View>

        {"retake_instruction" in item && item.retake_instruction ? (
          <View style={{ marginTop: 20, backgroundColor: colors.dangerBg, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: colors.danger, fontSize: 14 }}>{item.retake_instruction}</Text>
          </View>
        ) : null}

        {onRemove ? (
          <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8} style={{ alignSelf: "center", marginTop: 36, padding: 8 }}>
            <Text style={{ color: colors.danger, fontSize: 15 }}>Remove from closet</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
