import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/api/client";
import type { ClosetItem } from "../../src/api/types";
import { closetStats } from "../../src/closetStats";
import { addedLabel, colors, hitSlopFor, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { GarmentTile } from "../../src/components/GarmentTile";
import { ItemSheet } from "../../src/components/ItemSheet";
import { CaptureBanner } from "../../src/components/home/CaptureBanner";
import { Greeting } from "../../src/components/home/Greeting";
import { HomeEmpty } from "../../src/components/home/HomeEmpty";
import { StatsRow } from "../../src/components/home/StatsRow";
import { garmentName } from "../../src/garmentName";
import { Marquee } from "../../src/motion/Marquee";
import { Rise } from "../../src/motion/Rise";
import { pickPhoto } from "../../src/photoPicker";
import { useCredits } from "../../src/credits/CreditsProvider";
import { OUTFIT_LINK } from "../../src/outfit/outfit";
import { Button, Chip } from "../../src/ui";

const MARQUEE = { width: 118, height: 148 };
const RECENT = { width: 150, height: 188 };
const MARQUEE_SPEED = (118 + 12) / 4;  // about four seconds per tile

export default function HomeScreen() {
  const router = useRouter();
  const { outfit: outfitOn } = useCredits();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The open garment by identity: the sheet always reads the live list, so edits and backs show at once.
  const [openKey, setOpenKey] = useState<string | null>(null);

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

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const [pickError, setPickError] = useState<string | null>(null);
  // Take Photo opens the camera flow; From Library goes straight to the preview and quote.
  const fromLibrary = async () => {
    setPickError(null);
    try {
      const uri = await pickPhoto(false);
      if (uri) router.push({ pathname: "/capture/preview", params: { uri } });
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };
  const keyOf = (i: ClosetItem) => `${i.run_id}/${i.photo_name}/${i.item_id}`;
  const openIndex = openKey ? items.findIndex((i) => keyOf(i) === openKey) : -1;

  const now = new Date();
  const stats = useMemo(() => closetStats(items, new Date()), [items]);
  const empty = loaded && !loadError && items.length === 0;
  const recent = items.slice(0, 12);
  const open = (item: ClosetItem) => setOpenKey(keyOf(item));

  const digitize = (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button title="Take Photo" size="medium" icon="camera" onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "garments" } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="From Library" size="medium" variant="secondary" onPress={fromLibrary} />
        </View>
      </View>
      {pickError ? <Text style={{ ...type.footnote, color: colors.destructive }}>{pickError}</Text> : null}
      {outfitOn ? (
        <Pressable
          accessibilityRole="button" hitSlop={hitSlopFor(20)} style={{ alignSelf: "center", paddingTop: 2 }}
          onPress={() => router.push({ pathname: "/capture/camera", params: { mode: "outfit" } })}
        >
          <Text style={{ ...type.subhead, color: colors.tint }}>{OUTFIT_LINK}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 28 }}>
        <Greeting now={now} onCredits={() => router.push("/account")} />
        <CaptureBanner />

        {loadError ? (
          <View style={{ margin: 20, padding: 16, borderRadius: radius.list, backgroundColor: colors.destructiveBg, gap: 10 }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
            <Button title="Try again" size="medium" variant="secondary" onPress={load} />
          </View>
        ) : null}

        {empty || (loadError && items.length === 0) ? (
          <View style={{ marginTop: 20 }}>
            <HomeEmpty outfit={!!outfitOn}>{digitize}</HomeEmpty>
          </View>
        ) : null}

        {items.length > 0 ? (
          <>
            <View style={{ marginTop: 22, height: MARQUEE.height + 30 }}>
              <Marquee
                items={recent}
                itemWidth={MARQUEE.width}
                gap={12}
                speed={MARQUEE_SPEED}
                testID="marquee"
                renderItem={(item, i) => (
                  <View style={{ paddingTop: i % 2 ? 20 : 10 }}>
                    <GarmentTile item={item} width={MARQUEE.width} height={MARQUEE.height} rounded={20} label={`Open ${garmentName(item)}`} onPress={() => open(item)} />
                  </View>
                )}
              />
            </View>

            <Rise style={{ marginTop: 8 }}>
              <StatsRow stats={[
                { label: "Pieces", value: stats.pieces },
                { label: "Categories", value: stats.groups.length },
                { label: "New this week", value: stats.addedThisWeek },
              ]} />
            </Rise>

            <View style={{ marginHorizontal: 20, marginTop: 22, padding: 20, borderRadius: radius.feature, backgroundColor: colors.grouped, gap: 14 }}>
              <View style={{ gap: 4 }}>
                <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Digitize clothes</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
                  {outfitOn ? "Snap garments or an outfit. AI turns them into catalog images." : "Snap garments. AI turns them into catalog images."}
                </Text>
              </View>
              {digitize}
            </View>

            <View style={{ marginTop: 24 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
                <Text accessibilityRole="header" style={{ ...type.section, color: colors.label }}>Recently Added</Text>
                <Pressable accessibilityRole="button" hitSlop={hitSlopFor(22)} onPress={() => router.push("/closet")}>
                  <Text style={{ ...type.body, color: colors.tint }}>See All</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 18 }}>
                {recent.map((item) => (
                  <View key={keyOf(item)} style={{ width: RECENT.width, gap: 8 }}>
                    <GarmentTile item={item} width={RECENT.width} height={RECENT.height} rounded={20} label={`Open ${garmentName(item)}`} onPress={() => open(item)} />
                    <View>
                      <Text numberOfLines={1} style={{ ...type.subhead, fontWeight: "600", color: colors.label }}>{garmentName(item)}</Text>
                      <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{addedLabel(item.run_id) ?? ""}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {stats.groups.length > 0 ? (
              <View style={{ marginTop: 10, paddingHorizontal: 20 }}>
                <Text accessibilityRole="header" style={{ ...type.section, color: colors.label, marginBottom: 12 }}>Browse by category</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {stats.groups.map(({ name, count }) => (
                    <Chip
                      key={name} label={name} count={count} variant="outlined"
                      onPress={() => router.push({ pathname: "/closet", params: { group: name, at: String(Date.now()) } })}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <ItemSheet items={items} index={openIndex >= 0 ? openIndex : null} onClose={() => setOpenKey(null)}
        onUpdated={(updated) => setItems((all) => all.map((i) => (keyOf(i) === keyOf(updated) ? updated : i)))}
        onDeleted={() => { setOpenKey(null); load(); }} />
    </SafeAreaView>
  );
}
