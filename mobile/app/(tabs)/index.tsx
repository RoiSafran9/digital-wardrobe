import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/api/client";
import { cachedItems, rememberItems } from "../../src/store/itemsCache";
import type { ClosetItem } from "../../src/api/types";
import { CATEGORY_GROUPS, groupOf } from "../../src/categoryGroups";
import { AddRows, type PhotoActions } from "../../src/components/home/AddToCloset";
import { CaptureBanner } from "../../src/components/home/CaptureBanner";
import { AddHero, CategoryTile, LookHero, NewThisWeek } from "../../src/components/home/HomeCards";
import { Greeting } from "../../src/components/home/Greeting";
import { HomeEmpty } from "../../src/components/home/HomeEmpty";
import { ItemSheet } from "../../src/components/ItemSheet";
import { useCredits } from "../../src/credits/CreditsProvider";
import { creditsLabel } from "../../src/credits/credits";
import { useProfile } from "../../src/profile";
import { useAuth } from "../../src/auth/AuthProvider";
import { pickPhoto } from "../../src/photoPicker";
import { colors, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { Backdrop, Button, Glass } from "../../src/ui";
import { track, useScreenViewed } from "../../src/activity/track";
import { MorningReminderCard } from "../../src/morningReminder/MorningReminderCard";
import { useCaptureJobs } from "../../src/store/captureJobs";
import { useFirstPiecesMaybe } from "../../src/firstPieces/FirstPiecesProvider";

export type CategoryRow = { name: string; count: number; first: ClosetItem; items: ClosetItem[] };

// One entry per category group with pieces, in the groups' fixed order, with the group's pieces.
export function categoryRows(items: ClosetItem[]): CategoryRow[] {
  const byGroup = new Map<string, ClosetItem[]>();
  for (const item of items) {
    const g = groupOf(item);
    byGroup.set(g, [...(byGroup.get(g) ?? []), item]);
  }
  return CATEGORY_GROUPS.filter((g) => byGroup.has(g)).map((g) => {
    const list = byGroup.get(g)!;
    return { name: g, count: list.length, first: list[0], items: list };
  });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Pieces added in the last 7 days, newest first. The date is in the run id (YYYYMMDD-…).
export function newThisWeek(items: ClosetItem[], now: Date): ClosetItem[] {
  const added = (item: ClosetItem) => {
    const m = /^(\d{4})(\d{2})(\d{2})/.exec(item.run_id);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime() : null;
  };
  return items
    .map((item) => ({ item, at: added(item) }))
    .filter((x): x is { item: ClosetItem; at: number } => x.at !== null && now.getTime() - x.at < WEEK_MS)
    .sort((a, b) => b.at - a.at || b.item.run_id.localeCompare(a.item.run_id))
    .map((x) => x.item);
}

// Three pieces for the Build My Look card: a top, a bottom and shoes when the closet has them.
function lookPieces(rows: CategoryRow[]): ClosetItem[] {
  const pick = ["Tops", "Bottoms", "Shoes", "Dresses", "Outerwear", "Bags", "Accessories", "Other"]
    .map((g) => rows.find((r) => r.name === g)?.first).filter((x): x is ClosetItem => !!x);
  return pick.slice(0, 3);
}

export default function HomeScreen() {
  useScreenViewed("home");
  const router = useRouter();
  const { outfit: outfitOn, outfitBuilder, billing, prices } = useCredits();
  const { status, userId } = useAuth();
  const { profile } = useProfile();
  // The last closet fetched for this account draws at once; the fetch on focus refreshes it.
  const [items, setItems] = useState<ClosetItem[]>(() => cachedItems(userId ?? null) ?? []);
  const [loaded, setLoaded] = useState(() => cachedItems(userId ?? null) !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ list: ClosetItem[]; index: number } | null>(null);
  // The morning reminder card waits while pieces are being made.
  const { current: capture } = useCaptureJobs();
  const firstPieces = useFirstPiecesMaybe();
  const making = capture?.status === "running" || !!firstPieces?.round;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const fresh = (await getItems()).items;
      rememberItems(userId ?? null, fresh);
      setItems(fresh);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your closet.");
    } finally {
      setLoaded(true);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const rows = useMemo(() => categoryRows(items), [items]);
  const fresh = useMemo(() => newThisWeek(items, new Date()), [items]);
  const empty = loaded && items.length === 0;

  // The empty closet's library buttons open the same system library, each feeding its own flow.
  const pickInto = (flow: "garment" | "outfit") => async () => {
    setPickError(null);
    try {
      const uri = await pickPhoto(false);
      if (!uri) return;
      track("capture_source", { flow, from: "library" });
      router.push(flow === "garment"
        ? { pathname: "/capture/preview", params: { uri, flow } }
        : { pathname: "/outfit/detect", params: { uri, flow } });
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Couldn't open your photos.");
    }
  };
  const camera = (mode: "garments" | "outfit") => () => router.push({ pathname: "/capture/camera", params: { mode } });
  const actions: PhotoActions = {
    onGarmentCamera: camera("garments"),
    onGarmentLibrary: pickInto("garment"),
    onOutfitPhoto: outfitOn ? pickInto("outfit") : undefined,
  };
  // The price comes from the server; with billing off no amount is shown.
  const price = billing ? prices.garment : undefined;
  const caption = price ? `Finding pieces is free · ${creditsLabel(price)} per piece` : "Finding pieces is free";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Backdrop />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_HEIGHT + 28 }}>
          <Greeting now={now} name={profile?.display_name} count={loaded && !empty ? items.length : null} onCredits={() => router.push("/account")} />
          <CaptureBanner />

          {loadError ? (
            <Glass radius={radius.list} style={{ marginTop: 12, padding: 16, gap: 10 }}>
              <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
              <Button title="Try again" size="medium" variant="soft" onPress={load} />
            </Glass>
          ) : null}

          {empty ? (
            <View style={{ marginTop: 12 }}>
              <HomeEmpty outfit={!!outfitOn}
                onFirstPieces={status === "signedIn" ? () => router.push({ pathname: "/first-pieces", params: { entry: "home" } }) : undefined}>
                <MorningReminderCard hidden={making} />
                <AddRows {...actions} />
              </HomeEmpty>
            </View>
          ) : (
            <>
              <AddHero caption={caption} onFlat={camera("garments")} onWorn={outfitOn ? camera("outfit") : undefined} />
              <MorningReminderCard hidden={making} style={{ marginTop: 10 }} />
              {status === "signedIn" && outfitBuilder && items.length ? (
                <LookHero count={items.length} pieces={lookPieces(rows)} onPress={() => router.push("/build-my-look")} />
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: 10 }}>
                {rows.map((r) => (
                  <CategoryTile key={r.name} name={r.name} items={r.items}
                    onPress={() => router.push({ pathname: "/closet", params: { group: r.name, at: String(Date.now()) } })} />
                ))}
              </View>
              {fresh.length ? <NewThisWeek items={fresh} onOpen={(item) => setOpen({ list: fresh, index: fresh.indexOf(item) })} /> : null}
            </>
          )}
          {pickError ? <Text style={{ ...type.footnote, color: colors.destructive, paddingHorizontal: 4, marginTop: 10 }}>{pickError}</Text> : null}
        </ScrollView>
      </SafeAreaView>
      <ItemSheet
        items={open?.list ?? []}
        index={open?.index ?? null}
        onClose={() => setOpen(null)}
        onUpdated={() => { void load(); }}
        onDeleted={() => { setOpen(null); void load(); }}
      />
    </View>
  );
}
