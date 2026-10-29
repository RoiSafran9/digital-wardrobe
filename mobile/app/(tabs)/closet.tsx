import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions, type TextInputInstance } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItems } from "../../src/api/client";
import { Icon } from "../../src/components/Icon";
import { GarmentTile } from "../../src/components/GarmentTile";
import { ItemSheet } from "../../src/components/ItemSheet";
import { Rise } from "../../src/motion/Rise";
import type { ClosetItem } from "../../src/api/types";
import { CATEGORY_GROUPS, groupFor, groupOf } from "../../src/categoryGroups";
import { ALL, colorsPresent, filterCloset } from "../../src/closetFilter";
import { garmentName } from "../../src/garmentName";
import { asList, capitalize, colors, radius, swatchFor, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { Button, Chip, Swatch } from "../../src/ui";
import { useAuth } from "../../src/auth/AuthProvider";
import { FirstPiecesPopup } from "../../src/components/firstPieces/FirstPiecesPopup";
import { useFirstPiecesMaybe } from "../../src/firstPieces/FirstPiecesProvider";
import { markCelebrated, parseIds, wasCelebrated } from "../../src/firstPieces/celebrate";
import { FIRST_GOAL } from "../../src/firstPieces/round";
import { pathOf, track } from "../../src/firstPieces/analytics";
import { useScreenViewed } from "../../src/activity/track";

const GAP = 12;

function sameItem(a: ClosetItem, b: ClosetItem): boolean {
  return a.run_id === b.run_id && a.photo_name === b.photo_name && a.item_id === b.item_id;
}

export default function ClosetScreen() {
  useScreenViewed("closet");
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [group, setGroup] = useState<string>(ALL);
  const [color, setColor] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const params = useLocalSearchParams<{ group?: string; category?: string; search?: string; at?: string; celebrate?: string; ids?: string; path?: string }>();
  const searchField = useRef<TextInputInstance>(null);
  const wantsSearch = useRef(false);
  // Home's search field opens the closet ready to type (once the field is there).
  useEffect(() => { if (params.search) wantsSearch.current = true; }, [params.search, params.at]);
  // Home's group pills open the closet pre-filtered (an older link may still send a category word).
  useEffect(() => {
    const wanted = params.group ?? (params.category ? groupFor(params.category) : null);
    if (wanted) setGroup(wanted);
  }, [params.group, params.category, params.at]);  // `at` changes on every tap, so the same pill re-applies

  const [loadError, setLoadError] = useState<string | null>(null);

  // Never let a failed fetch become an uncaught rejection: show it, offer a retry.
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems((await getItems()).items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your closet.");
    } finally {
      setLoaded(true);
    }
  }, []);

  // First 3 Pieces' first success: once per account, over the closet, with the pieces just made — from a
  // round's finish (celebrate=1&ids=…) or a round that finished while the user was elsewhere.
  const { userId } = useAuth();
  const firstPieces = useFirstPiecesMaybe();
  const settled = firstPieces?.summary?.settled && firstPieces.summary.made > 0 ? firstPieces.round : null;
  const wanted = useMemo(() => (params.celebrate ? parseIds(params.ids) : settled ? settled.jobs.flatMap((j) => j.itemIds ?? []) : []),
    [params.celebrate, params.ids, params.at, settled]);
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (!loaded || !wanted.length) return;
    let live = true;
    wasCelebrated(userId).then((done) => {
      if (!live) return;
      // Milestones are recorded once per account by the server, so repeats here are harmless.
      const path = pathOf(params.path) ?? (settled ? "near" : undefined);
      track("first_garment_saved", { path });
      if (items.length >= FIRST_GOAL) track("first_3_saved", { path });
      if (!done) {
        track("popup_shown", { saved: wanted.length });
        setCelebrating(true);
      }
      else if (settled) firstPieces?.finishRound();
    });
    return () => { live = false; };
  }, [loaded, wanted, userId]);  // eslint-disable-line react-hooks/exhaustive-deps
  const endCelebration = (then?: () => void) => {
    setCelebrating(false);
    void markCelebrated(userId);
    if (firstPieces?.summary?.settled) firstPieces.finishRound();
    then?.();
  };
  const celebrated = useMemo(() => {
    const mine = items.filter((i) => wanted.includes(i.item_id));
    return mine.length ? mine : items.slice(0, 3);
  }, [items, wanted]);

  // Tabs stay mounted, so reload on every focus to pick up items from new runs.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  useEffect(() => {
    if (!wantsSearch.current || items.length === 0) return;
    wantsSearch.current = false;
    const timer = setTimeout(() => searchField.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, [items.length, params.at]);

  const groups = useMemo(() => {
    const present = new Set(items.map(groupOf));
    return [ALL, ...CATEGORY_GROUPS.filter((g) => present.has(g))];
  }, [items]);
  const swatches = useMemo(() => colorsPresent(items), [items]);
  // A filter whose pieces are gone (deleted, recategorized) falls back to everything, never a blank closet.
  const activeGroup = groups.includes(group) ? group : ALL;
  const activeColor = swatches.includes(color.toLowerCase()) ? color : ALL;
  const visible = filterCloset(items, { group: activeGroup, color: activeColor, query });
  const filtered = activeGroup !== ALL || activeColor !== ALL || query.trim() !== "";
  const clearFilters = () => { setGroup(ALL); setColor(ALL); setQuery(""); };
  const tileWidth = (width - 40 - GAP) / 2;

  const header = (
    <View style={{ paddingTop: 8, paddingBottom: 18, gap: 14 }}>
      <View>
        <Text accessibilityRole="header" style={{ ...type.largeTitle, color: colors.label }}>Closet</Text>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginTop: 2 }}>
          {items.length === 1 ? "1 piece" : `${items.length} pieces`}
        </Text>
      </View>
      {loadError ? (
        <View style={{ padding: 16, borderRadius: radius.list, backgroundColor: colors.destructiveBg, gap: 10 }}>
          <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
          <Button title="Try again" size="medium" variant="secondary" onPress={load} />
        </View>
      ) : null}
      {items.length > 0 ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 40, borderRadius: radius.input, backgroundColor: colors.fill, paddingHorizontal: 10 }}>
            <Icon name="search" size={16} color={colors.secondaryLabel} />
            <TextInput
              ref={searchField}
              accessibilityLabel="Search your closet"
              placeholder="Search name, color, details"
              placeholderTextColor={colors.secondaryLabel}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
              style={{ ...type.body, color: colors.label, flex: 1, paddingVertical: 0 }}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {groups.map((name) => (
              <Chip key={name} label={name} selected={name === activeGroup} onPress={() => setGroup(name)} />
            ))}
          </ScrollView>
          {swatches.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
              {swatches.map((c) => (
                <Swatch
                  key={c} color={swatchFor(c)} label={capitalize(c)} selected={c === activeColor.toLowerCase()}
                  onPress={() => setColor(c === activeColor.toLowerCase() ? ALL : c)}
                />
              ))}
            </ScrollView>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const emptyState = loaded && !loadError ? (
    items.length === 0 ? (
      <View style={{ paddingTop: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ ...type.section, color: colors.label }}>Your closet is empty</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center", marginBottom: 16 }}>
          Photograph a piece and it'll land here as a clean catalog image.
        </Text>
        <Button title="Add Clothes" icon="camera" onPress={() => router.push("/add")} />
      </View>
    ) : filtered ? (
      <View style={{ paddingTop: 48, alignItems: "center", gap: 8 }}>
        <Text style={{ ...type.section, color: colors.label }}>No matches</Text>
        <Text style={{ ...type.body, color: colors.secondaryLabel, textAlign: "center", marginBottom: 16 }}>
          Nothing in your closet fits these filters.
        </Text>
        <Button title="Clear Filters" size="medium" variant="secondary" onPress={clearFilters} />
      </View>
    ) : null
  ) : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={visible}
        numColumns={2}
        keyExtractor={(item) => `${item.run_id}-${item.photo_name}-${item.item_id}`}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 24 }}
        columnWrapperStyle={{ gap: GAP }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.secondaryLabel} />}
        ListEmptyComponent={emptyState ?? undefined}
        renderItem={({ item, index }) => {
          const name = garmentName(item);
          const firstColor = asList(item.facts.colors.value)[0];
          return (
            // The collection lays itself out: short stagger, capped so long closets don't wait.
            <Rise delay={Math.min(index, 8) * 30} style={{ width: tileWidth, marginBottom: 18 }}>
              <View>
                <GarmentTile
                  testID={`thumb-${item.run_id}-${item.item_id}`}
                  item={item} width={tileWidth} height={tileWidth * 1.25} label={`Open ${name}`}
                  onPress={() => setSelectedIndex(index)}
                  badge={item.turn?.state === "done" ? "360°" : null}
                />
              </View>
              {item.turn?.state === "done" ? <View testID={`badge-360-${item.run_id}-${item.item_id}`} accessibilityLabel="Has a 360 view" /> : null}
              <Text numberOfLines={1} style={{ ...type.subhead, fontWeight: "600", color: colors.label, marginTop: 10 }}>{name}</Text>
              <Text numberOfLines={1} style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 1 }}>
                {[groupOf(item), firstColor ? capitalize(firstColor) : null].filter(Boolean).join(" · ")}
              </Text>
            </Rise>
          );
        }}
      />
      {/* Swipes through the grid as currently filtered. */}
      <ItemSheet
        items={visible}
        index={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onUpdated={(updated) => setItems((all) => all.map((i) => (sameItem(i, updated) ? updated : i)))}
        onDeleted={(removed) => {
          setSelectedIndex(null);
          setItems((all) => all.filter((i) => !sameItem(i, removed)));
        }}
      />
      <FirstPiecesPopup
        visible={celebrating && celebrated.length > 0}
        items={celebrated}
        onExplore={() => endCelebration()}
        onClose={() => endCelebration()}
        onAddMore={() => endCelebration(() => { track("popup_add_more", {}); router.push(firstPieces?.pieces.length
          ? "/first-pieces/pick"
          : { pathname: "/first-pieces", params: { entry: "home" } }); })}
      />
    </SafeAreaView>
  );
}
