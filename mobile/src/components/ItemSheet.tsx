import React, { useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Icon } from "./Icon";
import { deleteItem } from "../api/client";
import { useAddBack } from "../useAddBack";
import { BACK_STEPS, KEEP_OPEN, ProcessingStatus } from "./ProcessingStatus";
import type { BackView, ClosetItem, RunItem } from "../api/types";
import { addedLabel, asList, capitalize, colors, fonts, radius } from "../theme";
import { ColorSwatches } from "./ColorSwatches";
import { FadeIn } from "./FadeIn";
import { GarmentImage } from "./GarmentImage";
import { ItemEditForm } from "./ItemEditForm";
import { RetakeNote } from "./RetakeNote";
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
  const [editing, setEditing] = useState(false);

  const close = () => {
    setEditing(false);
    onClose();
  };
  // Unsaved edits never vanish silently: swipe-down is off while editing, and the
  // close button / Android back ask first.
  const requestClose = () => {
    if (!editing) return close();
    Alert.alert("Discard changes?", "Your edits to this item haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: close },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal={!editing}
      onRequestClose={requestClose}
    >
      {visible ? (
        <Pager items={items} startIndex={index} onClose={requestClose} onUpdated={onUpdated} onDeleted={onDeleted}
          editing={editing} setEditing={setEditing} />
      ) : null}
    </Modal>
  );
}

type PagerProps = Omit<Props, "index"> & {
  startIndex: number;
  editing: boolean;
  setEditing: (editing: boolean) => void;
};

function Pager({ items, startIndex, onClose, onUpdated, onDeleted, editing, setEditing }: PagerProps) {
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(startIndex);
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
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
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
              hitSlop={8}
              style={({ pressed }) => ({
                height: 36, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 6,
                paddingHorizontal: 14, backgroundColor: colors.sunken, transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <Icon name="pencil" size={15} color={colors.ink} />
              <Text style={{ color: colors.ink, fontSize: 14 }}>Edit</Text>
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
          <Icon name="close" size={20} color={colors.ink} />
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
                <FadeIn duration={180}>
                <ItemEditForm
                  item={item}
                  onCancel={() => setEditing(false)}
                  onSaved={(updated) => {
                    setEditing(false);
                    onUpdated?.(updated);
                  }}
                />
                </FadeIn>
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

// Front and back as small tiles under the garment: tap to switch; an empty back tile adds one.
function SideStrip({ item, back, side, onChange, onAddBack }: {
  item: Item;
  back: BackView | null;
  side: "front" | "back";
  onChange: (s: "front" | "back") => void;
  onAddBack?: () => void;
}) {
  const tile = (selected: boolean) => ({
    width: 60, height: 60, borderRadius: 14, alignItems: "center" as const, justifyContent: "center" as const,
    borderWidth: selected ? 1.5 : 1, borderColor: selected ? colors.ink : colors.line,
  });
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 14 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Front" accessibilityState={{ selected: side === "front" }}
        onPress={() => onChange("front")} style={tile(side === "front")}>
        <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: 48, height: 48 }} />
      </Pressable>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" accessibilityState={{ selected: side === "back" }}
          onPress={() => onChange("back")} style={tile(side === "back")}>
          <GarmentImage path={back.generated_url} cutoutPath={back.cutout_url} style={{ width: 48, height: 48 }} />
        </Pressable>
      ) : onAddBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add back photo" onPress={onAddBack}
          style={({ pressed }) => ({ ...tile(false), borderStyle: "dashed", borderColor: colors.lineStrong, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Icon name="add" size={18} color={colors.ink} />
          <Text style={{ color: colors.ink, fontSize: 11, marginTop: 1 }}>Back</Text>
        </Pressable>
      ) : null}
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
  const closetItem = isClosetItem(item) ? item : null;
  const { ask: askForBack, uploading, error: backError } = useAddBack(
    closetItem,
    onUpdated && ((updated) => { onUpdated(updated); setSide("back"); }),
    onBusy,
  );
  const showBack = side === "back" && back !== null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, paddingBottom: 48 }}>
        {/* Same garment turning over: a quick crossfade, not a hard cut. */}
        <FadeIn key={side} scaleFrom={0.98} duration={200}>
          {showBack ? (
            <GarmentImage path={back.generated_url} cutoutPath={back.cutout_url} style={{ width: "100%", aspectRatio: 1 }} />
          ) : (
            <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", aspectRatio: 1 }} />
          )}
        </FadeIn>
        {back || (onUpdated && closetItem) ? (
          <SideStrip item={item} back={back} side={side} onChange={setSide} onAddBack={!back && onUpdated && closetItem && !uploading ? askForBack : undefined} />
        ) : null}
        {uploading ? (
          <View style={{ paddingVertical: 18 }}>
            <ProcessingStatus steps={BACK_STEPS} note={KEEP_OPEN} estimateSeconds={30} />
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
          <RetakeNote tier={item.tier} text={item.retake_instruction} />
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
