import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Icon } from "./Icon";
import { deleteItem } from "../api/client";
import { useAddBack } from "../useAddBack";
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
import { garmentName } from "../garmentName";
import { groupOf } from "../categoryGroups";
import { useCredits } from "../credits/CreditsProvider";
import { creditsLabel } from "../credits/credits";
import { Button, CostSheet, GroupedList, InsufficientCreditsSheet, Row, Segmented, Sheet, Shimmer, useToast } from "../ui";
import { track } from "../activity/track";

type Item = RunItem | ClosetItem;

function FactRow({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, minHeight: 48,
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
  const opened = visible ? items[index!] : null;
  useEffect(() => {
    if (opened && isClosetItem(opened)) track("item_opened", { has_back: !!opened.back, has_turn: opened.turn?.state === "done" });
  }, [opened?.item_id]);  // eslint-disable-line react-hooks/exhaustive-deps
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
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(startIndex);
  const [busy, setBusy] = useState(false);
  const currentItem = items[current];
  const canEdit = !!onUpdated && !!currentItem && isClosetItem(currentItem);

  const { billing } = useCredits();
  const [removing, setRemoving] = useState<ClosetItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function remove(item: ClosetItem) {
    setRemoveError(null);
    try {
      await deleteItem(item);
      haptics.success();
      setRemoving(null);
      onDeleted?.(item);
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Couldn't remove it. Try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={hitSlopFor(32, 32)}
          style={({ pressed }) => ({
            width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
            backgroundColor: colors.fill, transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <Icon name="close" size={15} color={colors.label} />
        </Pressable>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
          {editing ? "Editing" : items.length > 1 ? `${current + 1} / ${items.length}` : ""}
        </Text>
        {canEdit && !editing ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => setEditing(true)} hitSlop={hitSlopFor(28, 44)}>
            <Text style={{ ...type.body, fontWeight: "600", color: colors.tint }}>Edit</Text>
          </Pressable>
        ) : <View style={{ width: 32 }} />}
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
                    toast.show("Changes saved");
                  }}
                />
                </Rise>
              </ScrollView>
            ) : (
              <SheetContent
                item={item}
                onRemove={onDeleted && isClosetItem(item) ? () => { setRemoveError(null); setRemoving(item); } : undefined}
                onUpdated={onUpdated}
                onBusy={setBusy}
              />
            )}
          </View>
        )}
      />
      <Sheet visible={!!removing} onClose={() => setRemoving(null)} title="Remove from closet?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 20 }}>
          {`It leaves your closet. You can't undo this in the app.${billing ? " Credits used for its images are not returned." : ""}`}
        </Text>
        {removeError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{removeError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Remove" variant="destructive" onPress={() => removing && remove(removing)} />
          <Button title="Cancel" variant="text" onPress={() => setRemoving(null)} />
        </View>
      </Sheet>
    </View>
  );
}

type Side = "front" | "back" | "360";

const STAGE = 372;

// The image stage: the garment on the stone tile, or the empty/working states of Back and 360°.
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ height: STAGE, borderRadius: radius.stage, backgroundColor: colors.tile, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  );
}

function Working({ label }: { label: string }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: 12 }}>
      <Shimmer />
      <ActivityIndicator color={colors.secondaryLabel} />
      <Text style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{label}</Text>
    </View>
  );
}

const withPrice = (label: string, price?: number) => (price ? `${label} · ${creditsLabel(price)}` : label);

type SheetContentProps = {
  item: Item;
  onRemove?: () => void;
  onUpdated?: (item: ClosetItem) => void;
  onBusy?: (busy: boolean) => void;
};

function SheetContent({ item, onRemove, onUpdated, onBusy }: SheetContentProps) {
  const { facts } = item;
  const toast = useToast();
  const trims = asList(facts.trims.value).filter((t) => t.toLowerCase() !== "not visible");
  const text = asList(facts.visible_text.value);
  const added = "run_id" in item ? addedLabel(item.run_id) : null;
  const back = isClosetItem(item) ? item.back ?? null : null;
  const closetItem = isClosetItem(item) ? item : null;
  const actions = !!(closetItem && onUpdated);
  const turnState = useTurn(closetItem, onUpdated);
  const { turn, error: turnError } = turnState;
  const turnViews = turn?.state === "done" && turn.views.length > 0
    ? turn.views.map((v) => ({ label: TURN_LABELS[v.angle], path: v.url, cutoutPath: v.cutout_url }))
    : null;
  // A finished 360 is the most complete view of the garment, so the sheet opens on it.
  const [side, setSide] = useState<Side>(turnViews ? "360" : "front");
  const [confirm, setConfirm] = useState<"back" | "turn" | null>(null);
  const [short, setShort] = useState<number | null>(null);  // credits needed, when the user can't afford it
  const backState = useAddBack(
    closetItem,
    onUpdated && ((updated) => {
      onUpdated(updated);
      setSide("back");
      toast.show(backState.price ? `✓ Back image ready · ${creditsLabel(backState.price)} used` : "✓ Back image ready");
    }),
    onBusy,
  );
  const { uploading, error: backError } = backState;

  // Say when a 360 that was running while the sheet was open finishes.
  const lastTurn = useRef(turn?.state);
  useEffect(() => {
    if (lastTurn.current === "running" && turn?.state === "done") {
      setSide("360");
      toast.show(turnState.price ? `✓ 360° view ready · ${creditsLabel(turnState.price)} used` : "✓ 360° view ready");
    }
    lastTurn.current = turn?.state;
  }, [turn?.state]);

  useEffect(() => {
    if (backState.insufficient) { setShort(backState.price ?? 0); backState.clearInsufficient(); }
    if (turnState.insufficient) { setShort(turnState.price ?? 0); turnState.clearInsufficient(); }
  }, [backState.insufficient, turnState.insufficient]);

  // Every paid action is confirmed with its price first; billing off goes straight on.
  const requestBack = () => {
    if (!backState.price) return backState.ask();
    if (!backState.affordable) return setShort(backState.price);
    setConfirm("back");
  };
  const requestTurn = () => {
    if (!turnState.price) return turnState.start();
    if (!turnState.affordable) return setShort(turnState.price);
    setConfirm("turn");
  };

  const segments = [
    { value: "front" as Side, label: "Front" },
    ...(back || actions ? [{ value: "back" as Side, label: "Back" }] : []),
    ...(turnViews || actions ? [{ value: "360" as Side, label: "360°" }] : []),
  ];

  let stage: React.ReactNode;
  if (side === "360" && turnViews) {
    stage = <TurnView views={turnViews} label="AI view" onDragActive={onBusy} />;
  } else if (side === "360") {
    stage = (
      <Stage>
        {turn?.state === "running" ? <Working label="Creating four angles…" /> : (
          <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 24 }}>
            <View style={{ flexDirection: "row", gap: 6 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {[1, 0.7, 0.45, 0.25].map((opacity, i) => (
                <View key={i} style={{ opacity }}>
                  <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} tile={colors.grouped} style={{ width: 54, height: 66, borderRadius: 12 }} />
                </View>
              ))}
            </View>
            <Text style={{ ...type.headline, color: colors.label }}>See it from every angle</Text>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
              Four AI views on an invisible body, about a minute. Labelled as AI.
            </Text>
            {turn?.state === "failed" && turn.error ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{turn.error}</Text> : null}
            {turnError ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{turnError}</Text> : null}
            {actions ? (
              <Button
                title={withPrice(turn?.state === "failed" ? "Try Again" : "Generate 360°", turnState.price)}
                size="medium" icon="turn" onPress={requestTurn}
              />
            ) : null}
          </View>
        )}
      </Stage>
    );
  } else if (side === "back" && !back) {
    stage = (
      <Stage>
        {uploading ? <Working label="Creating back image…" /> : (
          <View style={{ alignSelf: "stretch", flex: 1, margin: 16, borderRadius: radius.feature, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 }}>
            <Icon name="cameraBack" size={30} color={colors.secondaryLabel} />
            <Text style={{ ...type.headline, color: colors.label }}>No back image yet</Text>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
              Take a photo of the back and we'll create a matching catalog image.
            </Text>
            {backError ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{backError}</Text> : null}
            {actions ? <Button title={withPrice("Add Back Image", backState.price)} size="medium" onPress={requestBack} /> : null}
          </View>
        )}
      </Stage>
    );
  } else {
    const showBack = side === "back" && back;
    stage = (
      // Same garment turning over: a quick crossfade, not a hard cut.
      <Rise key={side} distance={0}>
        <Stage>
          {showBack ? (
            <GarmentImage path={back.generated_url} cutoutPath={back.cutout_url} style={{ width: "100%", height: "100%" }} />
          ) : (
            <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", height: "100%" }} />
          )}
        </Stage>
      </Rise>
    );
  }

  const groupLabel = groupOf(item);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 48 }}>
        {stage}
        {segments.length > 1 ? (
          <View style={{ marginTop: 14 }}>
            <Segmented options={segments} value={side} onChange={setSide} />
          </View>
        ) : null}
        {uploading && side !== "back" ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center", marginTop: 10 }}>Creating back image…</Text>
        ) : null}
        {backError && side !== "back" ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: 10, textAlign: "center" }}>{backError}</Text> : null}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 22, gap: 12 }}>
          <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, flexShrink: 1 }}>
            {garmentName(item)}
          </Text>
          <TierBadge tier={item.tier} />
        </View>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 4 }}>
          {[groupLabel === "Other" ? capitalize(asList(facts.category.value)[0] ?? "Item") : `${groupLabel} · ${capitalize(asList(facts.category.value)[0] ?? "")}`, added].filter(Boolean).join(" · ")}
        </Text>

        <View testID="facts-card" style={{ marginTop: 20, backgroundColor: colors.grouped, borderRadius: radius.list, paddingHorizontal: 16 }}>
          <FactRow label="Color" first>
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

        {actions || onRemove ? (
          <View style={{ marginTop: 24 }}>
            <GroupedList>
              {actions && !back && !uploading ? (
                <Row label="Add Back Image" value={backState.price ? creditsLabel(backState.price) : undefined} onPress={() => { setSide("back"); requestBack(); }} />
              ) : null}
              {actions && !turnViews && turn?.state !== "running" ? (
                <Row label="Generate 360° View" value={turnState.price ? creditsLabel(turnState.price) : undefined} onPress={() => { setSide("360"); requestTurn(); }} />
              ) : null}
              {onRemove ? <Row label="Remove from closet" destructive onPress={onRemove} /> : null}
            </GroupedList>
          </View>
        ) : null}
      </ScrollView>

      <CostSheet
        visible={confirm === "back"} title="Add a back image" subtitle="Lay the item flat, back side up. We'll create a matching catalog image."
        lines={[{ label: "Back image", action: "back", count: 1 }]}
        confirmLabel={withPrice("Continue", backState.price)}
        onConfirm={() => { setConfirm(null); backState.ask(); }} onClose={() => setConfirm(null)}
      />
      <CostSheet
        visible={confirm === "turn"} title="Generate 360° view" subtitle="Four AI views on an invisible body, about a minute. Labelled as AI."
        lines={[{ label: "360° view", action: "turn", count: 1 }]}
        confirmLabel={withPrice("Generate", turnState.price)}
        onConfirm={() => { setConfirm(null); turnState.start(); }} onClose={() => setConfirm(null)}
      />
      <InsufficientCreditsSheet visible={short !== null} needed={short ?? 0} onClose={() => setShort(null)} />
    </View>
  );
}
