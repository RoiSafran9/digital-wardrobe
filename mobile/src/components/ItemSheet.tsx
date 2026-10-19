import React, { useEffect, useState } from "react";
import { creditsLabel } from "../credits/credits";
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Icon } from "./Icon";
import { deleteItem } from "../api/client";
import { useAddBack } from "../useAddBack";
import { BACK_STEPS, KEEP_OPEN, ProcessingStatus, TURN_NOTE, TURN_STEPS } from "./ProcessingStatus";
import { PillButton } from "./PillButton";
import { TurnView } from "./TurnView";
import { TURN_LABELS, useTurn } from "../useTurn";
import type { BackView, ClosetItem, RunItem } from "../api/types";
import { addedLabel, asList, capitalize, colors, hitSlopFor, radius, type } from "../theme";
import { haptics } from "../haptics";
import { ColorSwatches } from "./ColorSwatches";
import { Rise } from "../motion/Rise";
import { GarmentImage } from "./GarmentImage";
import { ItemEditForm } from "./ItemEditForm";
import { RetakeNote } from "./RetakeNote";
import { TierBadge } from "./TierBadge";

type Item = RunItem | ClosetItem;

function FactRow({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16,
        paddingVertical: 12, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.separator,
      }}
    >
      <Text style={{ ...type.body, color: colors.secondaryLabel }}>{label}</Text>
      <View style={{ flexShrink: 1, alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

function FactText({ children }: { children: string }) {
  return <Text style={{ ...type.body, color: colors.label, textAlign: "right" }}>{children}</Text>;
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
            haptics.success();
            onDeleted?.(item);
          } catch (e) {
            Alert.alert("Couldn't remove it", e instanceof Error ? e.message : "Try again.");
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: 20, paddingTop: 16,
        }}
      >
        <Text style={{ color: colors.secondaryLabel, fontSize: 13, fontVariant: ["tabular-nums"] }}>
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
                paddingHorizontal: 14, backgroundColor: colors.tile, transform: [{ scale: pressed ? 0.95 : 1 }],
              })}
            >
              <Icon name="pencil" size={15} color={colors.label} />
              <Text style={{ color: colors.label, fontSize: 14 }}>Edit</Text>
            </Pressable>
          ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
            backgroundColor: colors.tile, transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <Icon name="close" size={20} color={colors.label} />
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
                <Rise distance={0}>
                <ItemEditForm
                  item={item}
                  onCancel={() => setEditing(false)}
                  onSaved={(updated) => {
                    setEditing(false);
                    onUpdated?.(updated);
                  }}
                />
                </Rise>
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

// Front and back as an iOS segmented control; when there's no back, the second segment adds one.
type Side = "front" | "back" | "360";

function SideStrip({ back, side, onChange, onAddBack, has360 }: {
  item: Item;
  back: BackView | null;
  side: Side;
  onChange: (s: Side) => void;
  has360: boolean;
  onAddBack?: () => void;
}) {
  const segment = (label: string, selected: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ selected }} onPress={onPress}
      hitSlop={hitSlopFor(32, 120)}
      style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center", backgroundColor: selected ? colors.grouped : "transparent" }}
    >
      <Text style={{ ...type.subhead, fontWeight: selected ? "600" : "400", color: colors.label }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", marginTop: 14, padding: 2, borderRadius: 10, backgroundColor: colors.tile }}>
      {segment("Front", side === "front", () => onChange("front"), "Front")}
      {back
        ? segment("Back", side === "back", () => onChange("back"), "Back")
        : onAddBack
          ? segment("+ Back", false, onAddBack, "Add back photo")
          : null}
      {has360 ? segment("360", side === "360", () => onChange("360"), "360") : null}
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
  const closetItem = isClosetItem(item) ? item : null;
  const { start: start360, turn, error: turnError, price: turnPrice } = useTurn(closetItem, onUpdated);
  const turnViews = turn?.state === "done" && turn.views.length > 0
    ? turn.views.map((v) => ({ label: TURN_LABELS[v.angle], path: v.url, cutoutPath: v.cutout_url }))
    : null;
  // A finished 360 is the most complete view of the garment, so the sheet opens on it.
  const [side, setSide] = useState<Side>(turnViews ? "360" : "front");
  useEffect(() => {
    if (turnViews) setSide("360");
  }, [turn?.state]);
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
        {side === "360" && turnViews ? (
          <TurnView views={turnViews} label="360 · AI view" onDragActive={onBusy} />
        ) : (
          <Rise key={side} distance={0}>
            {showBack ? (
              <GarmentImage path={back.generated_url} cutoutPath={back.cutout_url} style={{ width: "100%", aspectRatio: 1 }} />
            ) : (
              <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", aspectRatio: 1 }} />
            )}
          </Rise>
        )}
        {back || turnViews || (onUpdated && closetItem) ? (
          <SideStrip item={item} back={back} side={side} onChange={setSide} has360={!!turnViews} onAddBack={!back && onUpdated && closetItem && !uploading ? askForBack : undefined} />
        ) : null}
        {uploading ? (
          <View style={{ paddingVertical: 18 }}>
            <ProcessingStatus steps={BACK_STEPS} note={KEEP_OPEN} estimateSeconds={30} />
          </View>
        ) : null}
        {backError ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: 10, textAlign: "center" }}>{backError}</Text> : null}

        {closetItem && onUpdated && !turnViews ? (
          <View style={{ marginTop: 16 }}>
            {turn?.state === "running" ? (
              <ProcessingStatus steps={TURN_STEPS} note={TURN_NOTE} estimateSeconds={60} />
            ) : (
              <>
                {turn?.state === "failed" && turn.error ? (
                  <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center", marginBottom: 10 }}>{turn.error}</Text>
                ) : null}
                <PillButton
                  label={turn?.state === "failed" ? "Try again" : "View in 360"}
                  icon="turn"
                  onPress={start360}
                />
                {turn?.state !== "failed" ? (
                  <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 8 }}>
                    See it on an invisible body from every side. AI-made, about a minute{turnPrice ? ` · ${creditsLabel(turnPrice)}` : ""}.
                  </Text>
                ) : null}
              </>
            )}
            {turnError ? (
              <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center", marginTop: 10 }}>{turnError}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label, flexShrink: 1 }}>
            {capitalize(asList(facts.category.value)[0] ?? "Item")}
          </Text>
          <TierBadge tier={item.tier} />
        </View>
        {added ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 4 }}>{added}</Text> : null}

        <View testID="facts-card" style={{ marginTop: 20, backgroundColor: colors.grouped, borderRadius: radius.card, paddingHorizontal: 16 }}>
          <FactRow label="Colors" first>
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
          <View style={{ marginTop: 24, backgroundColor: colors.grouped, borderRadius: radius.card }}>
            <Pressable accessibilityRole="button" onPress={onRemove} style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ ...type.body, color: colors.destructive }}>Remove from closet</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
