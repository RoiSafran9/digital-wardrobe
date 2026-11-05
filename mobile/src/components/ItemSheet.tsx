import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Icon } from "./Icon";
import { deleteItem, imageUrl } from "../api/client";
import { useAddBack } from "../useAddBack";
import { NO_SIDE_VIEWS, isFootwearItem } from "../footwear";
import { TurnView } from "./TurnView";
import { TURN_LABELS, useTurn } from "../useTurn";
import type { ClosetItem, RunItem } from "../api/types";
import { addedLabel, asList, capitalize, colors, hitSlopFor, radius, type, weight } from "../theme";
import { haptics } from "../haptics";
import { ColorSwatches, FactChip } from "./ColorSwatches";
import { Rise } from "../motion/Rise";
import { PressScale } from "../motion/PressScale";
import { GarmentImage } from "./GarmentImage";
import { ItemEditForm } from "./ItemEditForm";
import { RetakeNote } from "./RetakeNote";
import { TierBadge } from "./TierBadge";
import { garmentName } from "../garmentName";
import { groupOf } from "../categoryGroups";
import { useCredits } from "../credits/CreditsProvider";
import { creditsLabel } from "../credits/credits";
import { Button, CostSheet, Glass, GroupedList, IconButton, InsufficientCreditsSheet, Row, Segmented, Sheet, Shimmer, useToast } from "../ui";
import { track } from "../activity/track";

type Item = RunItem | ClosetItem;

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

// One photo can hold several pieces, and one run several photos, so the key needs all three.
const keyOf = (item: Item, i: number) => ("run_id" in item ? `${item.run_id}-${item.photo_name}-${item.item_id}` : `${item.photo_name}-${item.item_id}-${i}`);

// Opens on items[index]; swipe the image left/right to page through the rest of the list.
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

// Swiping the image pages through the items: a native horizontal paging list, so iOS settles it with
// the sheet's vertical scroll and its swipe-down (a JS pan inside them is cancelled on a device).
type Paging = { items: Item[]; index: number; onIndex: (index: number) => void };

function Pager({ items, startIndex, onClose, onUpdated, onDeleted, editing, setEditing }: PagerProps) {
  const toast = useToast();
  const [current, setCurrent] = useState(startIndex);
  const index = Math.max(0, Math.min(current, items.length - 1));
  const currentItem = items[index];
  const canEdit = !!onUpdated && !!currentItem && isClosetItem(currentItem);

  const { billing } = useCredits();
  const [removing, setRemoving] = useState<ClosetItem | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const step = (dir: 1 | -1) => {
    const next = index + dir;
    if (next >= 0 && next < items.length) setCurrent(next);
  };

  // The neighbours' images load ahead, so a swipe lands on a picture, not a blank stage.
  useEffect(() => {
    for (const neighbour of [items[index - 1], items[index + 1]]) {
      const path = neighbour ? neighbour.cutout_url ?? neighbour.generated_url : null;
      if (!path) continue;
      try { Image.prefetch(imageUrl(path)).catch(() => {}); } catch { /* no image cache here (tests) */ }
    }
  }, [index, items]);

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

  if (!currentItem) return null;

  const chrome = (
    <>
      <View pointerEvents="box-none" style={{ position: "absolute", top: CHROME_TOP, left: 16, right: 16, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        {canEdit ? <EditPill onPress={() => setEditing(true)} /> : null}
      </View>
      {items.length > 1 ? (
        <View pointerEvents="box-none" style={{ position: "absolute", top: CHROME_TOP, left: 0, right: 0, height: 40, alignItems: "center", justifyContent: "center" }}>
          <Counter index={index} count={items.length} onStep={step} />
        </View>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {editing && isClosetItem(currentItem) ? (
        <Rise distance={0} style={{ flex: 1 }}>
          <ItemEditForm
            item={currentItem}
            onClose={onClose}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setEditing(false);
              onUpdated?.(updated);
              toast.show("Changes saved");
            }}
          />
        </Rise>
      ) : (
        <SheetContent
          key={keyOf(currentItem, index)}
          item={currentItem}
          chrome={chrome}
          paging={{ items, index, onIndex: setCurrent }}
          onRemove={onDeleted && isClosetItem(currentItem) ? () => { setRemoveError(null); setRemoving(currentItem); } : undefined}
          onUpdated={onUpdated}
        />
      )}
      <Sheet visible={!!removing} onClose={() => setRemoving(null)} title="Remove from closet?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 18 }}>
          {`It leaves your closet. You can't undo this in the app.${billing ? " Credits used for its images are not returned." : ""}`}
        </Text>
        {removeError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{removeError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Remove" variant="danger" onPress={() => removing && remove(removing)} />
          <Button title="Cancel" variant="text" size="medium" onPress={() => setRemoving(null)} />
        </View>
      </Sheet>
    </View>
  );
}

const CHROME_TOP = 16;

function EditPill({ onPress }: { onPress: () => void }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel="Edit" hitSlop={hitSlopFor(40)} style={{ height: 40, borderRadius: radius.pill, paddingHorizontal: 16, justifyContent: "center" }}>
      <Glass radius={radius.pill} level="base" style={StyleSheet.absoluteFill} />
      <Text style={{ ...type.subhead, ...weight(600), color: colors.tint }}>Edit</Text>
    </PressScale>
  );
}

// "5 / 8" over the image. VoiceOver can move through the items from here (swipe up or down), since the
// image swipe is a gesture only.
function Counter({ index, count, onStep }: { index: number; count: number; onStep: (dir: 1 | -1) => void }) {
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Item"
      accessibilityValue={{ text: `${index + 1} of ${count}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      <Glass radius={radius.pill} level="base" style={{ height: 30, paddingHorizontal: 12, justifyContent: "center" }}>
        <Text style={{ ...type.footnote, ...weight(600), color: colors.label, fontVariant: ["tabular-nums"] }}>{`${index + 1} / ${count}`}</Text>
      </Glass>
    </View>
  );
}

// Red on a soft red fill: the one irreversible action in the sheet.
type Side = "front" | "back" | "360";

// The image stage: full width at the top of the screen, on the stone tile. Its controls float over it,
// so the garment sits between the top row and the segmented control and is never covered.
const STAGE_MAX = 480;
const STAGE_TOP = CHROME_TOP + 40 + 8;
const SEGMENTED_SPACE = 16 + 38 + 12;

function Working({ label }: { label: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Shimmer />
      <View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator color={colors.secondaryLabel} />
        <Text style={{ ...type.subhead, ...weight(600), color: colors.label }}>{label}</Text>
      </View>
    </View>
  );
}

const withPrice = (label: string, price?: number) => (price ? `${label} · ${creditsLabel(price)}` : label);

type SheetContentProps = {
  item: Item;
  chrome: React.ReactNode;
  paging: Paging;
  onRemove?: () => void;
  onUpdated?: (item: ClosetItem) => void;
};

function SheetContent({ item, chrome, paging, onRemove, onUpdated }: SheetContentProps) {
  const { facts } = item;
  const toast = useToast();
  const { height, width } = useWindowDimensions();
  // A back uploading, or a finger turning the 360, holds the item where it is.
  const [busy, setBusy] = useState(false);
  const trims = asList(facts.trims.value).filter((t) => t.toLowerCase() !== "not visible");
  const text = asList(facts.visible_text.value);
  const pattern = capitalize(asList(facts.pattern.value).join(", "));
  const added = "run_id" in item ? addedLabel(item.run_id) : null;
  const back = isClosetItem(item) ? item.back ?? null : null;
  const closetItem = isClosetItem(item) ? item : null;
  const actions = !!(closetItem && onUpdated);
  // Back and 360 are garment features: shoes don't offer them (a back or 360 made before stays viewable).
  const shoe = isFootwearItem(item);
  const sideViews = actions && !shoe;
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
    setBusy,
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
    ...(back || sideViews ? [{ value: "back" as Side, label: "Back" }] : []),
    ...(turnViews || sideViews ? [{ value: "360" as Side, label: "360°" }] : []),
  ];
  const stageHeight = Math.min(STAGE_MAX, Math.round(height * 0.55));
  const bottom = segments.length > 1 ? SEGMENTED_SPACE : 20;
  // The area between the stage's controls.
  const area = { position: "absolute" as const, top: STAGE_TOP, bottom, left: 20, right: 20 };

  let stage: React.ReactNode;
  if (side === "360" && turnViews) {
    stage = <TurnView views={turnViews} label="AI view" onDragActive={setBusy} inset={{ top: STAGE_TOP, bottom }} />;
  } else if (side === "360") {
    stage = turn?.state === "running" ? <Working label="Creating four angles…" /> : (
      <View style={{ ...area, left: 30, right: 30, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 6 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {[1, 0.7, 0.45, 0.25].map((opacity, i) => (
            <View key={i} style={{ opacity }}>
              <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: 54, height: 66, borderRadius: radius.image - 2 }} />
            </View>
          ))}
        </View>
        <Text style={{ ...type.headline, color: colors.label }}>See it from every angle</Text>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
          Four AI views on an invisible body, about a minute. Labelled as AI.
        </Text>
        {turn?.state === "failed" && turn.error ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{turn.error}</Text> : null}
        {turnError ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{turnError}</Text> : null}
        {sideViews ? (
          <Button
            title={withPrice(turn?.state === "failed" ? "Try Again" : "Generate 360°", turnState.price)}
            size="medium" icon="turn" onPress={requestTurn}
          />
        ) : null}
      </View>
    );
  } else if (side === "back" && !back) {
    stage = uploading ? <Working label="Creating back image…" /> : (
      <View style={{ ...area, top: STAGE_TOP + 8, left: 28, right: 28, borderRadius: radius.stage, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.separatorStrong, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
        <Icon name="cameraBack" size={30} color={colors.secondaryLabel} />
        <Text style={{ ...type.headline, color: colors.label }}>No back image yet</Text>
        <Text style={{ ...type.footnote, color: colors.secondaryLabel, textAlign: "center" }}>
          Take a photo of the back and we'll create a matching catalog image.
        </Text>
        {backError ? <Text style={{ ...type.footnote, color: colors.destructive, textAlign: "center" }}>{backError}</Text> : null}
        {sideViews ? <View style={{ marginTop: 4 }}><Button title={withPrice("Add Back Image", backState.price)} size="medium" onPress={requestBack} /></View> : null}
      </View>
    );
  } else {
    const showBack = side === "back" && back;
    stage = (
      // Same garment turning over: a quick crossfade, not a hard cut.
      <Rise key={side} distance={0} style={area}>
        {showBack ? (
          <GarmentImage path={back.generated_url} cutoutPath={back.cutout_url} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
        ) : (
          <GarmentImage path={item.generated_url} cutoutPath={item.cutout_url} cropPath={item.crop_url} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
        )}
      </Rise>
    );
  }

  const groupLabel = groupOf(item);
  const category = capitalize(asList(facts.category.value)[0] ?? "");
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ height: stageHeight, backgroundColor: colors.tile, overflow: "hidden" }}>
          <FlatList
            testID="item-pager"
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            // On the 360 a sideways drag turns the garment; Front / Back first to change item.
            scrollEnabled={!busy && !(side === "360" && turnViews)}
            data={paging.items}
            keyExtractor={(it, i) => keyOf(it, i)}
            initialScrollIndex={paging.index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            initialNumToRender={1}
            windowSize={3}
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / width);
              if (i !== paging.index && i >= 0 && i < paging.items.length) paging.onIndex(i);
            }}
            renderItem={({ item: it, index: i }) => (
              <View style={{ width, height: stageHeight }}>
                {i === paging.index ? stage : (
                  <View style={area}>
                    <GarmentImage path={it.generated_url} cutoutPath={it.cutout_url} cropPath={it.crop_url} style={{ width: "100%", height: "100%", borderRadius: 0 }} />
                  </View>
                )}
              </View>
            )}
          />
          {chrome}
          {segments.length > 1 ? (
            <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 16, alignItems: "center" }}>
              <View style={{ width: segments.length * 78 + 6 }}>
                <Segmented glass options={segments} value={side} onChange={setSide} />
              </View>
            </View>
          ) : null}
        </View>

        <Rise distance={0} style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {uploading && side !== "back" ? (
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginBottom: 10 }}>Creating back image…</Text>
          ) : null}
          {backError && side !== "back" ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 10 }}>{backError}</Text> : null}

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Text accessibilityRole="header" style={{ ...type.pageTitle, color: colors.label, flexShrink: 1 }}>
              {garmentName(item)}
            </Text>
            <TierBadge tier={item.tier} />
          </View>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 4 }}>
            {[groupLabel === "Other" ? (category || "Item") : `${groupLabel} · ${category}`, added].filter(Boolean).join(" · ")}
          </Text>

          <View testID="facts-card" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <ColorSwatches value={facts.colors.value} />
            {pattern ? <FactChip label={`Pattern: ${pattern}`} text={pattern} /> : null}
            {trims.length > 0 ? <FactChip label={`Details: ${capitalize(trims.join(", "))}`} text={capitalize(trims.join(", "))} /> : null}
            {text.length > 0 ? <FactChip label={`Text: ${text.join(" ")}`} text={`“${text.join(" ")}”`} /> : null}
            {back && back.visible_text ? <FactChip label={`Back text: ${back.visible_text}`} prefix="Back" text={`“${back.visible_text}”`} /> : null}
          </View>

          {"retake_instruction" in item && item.retake_instruction ? (
            <RetakeNote tier={item.tier} text={item.retake_instruction} />
          ) : null}

          {actions || onRemove ? (
            <View style={{ marginTop: 16 }}>
              <GroupedList>
                {sideViews && !back && !uploading ? (
                  <Row label="Add Back Image" value={backState.price ? creditsLabel(backState.price) : undefined} onPress={() => { setSide("back"); requestBack(); }} />
                ) : null}
                {sideViews && !turnViews && turn?.state !== "running" ? (
                  <Row label="Generate 360° View" value={turnState.price ? creditsLabel(turnState.price) : undefined} onPress={() => { setSide("360"); requestTurn(); }} />
                ) : null}
                {onRemove ? <Row label="Remove from closet" destructive onPress={onRemove} /> : null}
              </GroupedList>
              {actions && shoe ? (
                <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 8, marginHorizontal: 16 }}>{NO_SIDE_VIEWS}</Text>
              ) : null}
            </View>
          ) : null}
        </Rise>
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
