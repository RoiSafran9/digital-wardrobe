import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { getItems } from "../../src/api/client";
import type { ClosetItem } from "../../src/api/types";
import { CATEGORY_GROUPS, groupOf } from "../../src/categoryGroups";
import { Icon } from "../../src/components/Icon";
import { AddClothesButton } from "../../src/components/home/AddToCloset";
import { CaptureBanner } from "../../src/components/home/CaptureBanner";
import { CategoryRows, type CategoryRow } from "../../src/components/home/CategoryRows";
import { Greeting } from "../../src/components/home/Greeting";
import { HomeEmpty } from "../../src/components/home/HomeEmpty";
import { useCredits } from "../../src/credits/CreditsProvider";
import { useProfile } from "../../src/profile";
import { useAuth } from "../../src/auth/AuthProvider";
import { colors, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { Button } from "../../src/ui";
import { useScreenViewed } from "../../src/activity/track";

// One row per category group with pieces, in the groups' fixed order, with the group's first piece.
export function categoryRows(items: ClosetItem[]): CategoryRow[] {
  const byGroup = new Map<string, ClosetItem[]>();
  for (const item of items) {
    const g = groupOf(item);
    byGroup.set(g, [...(byGroup.get(g) ?? []), item]);
  }
  return CATEGORY_GROUPS.filter((g) => byGroup.has(g)).map((g) => ({ name: g, count: byGroup.get(g)!.length, first: byGroup.get(g)![0] }));
}

export default function HomeScreen() {
  useScreenViewed("home");
  const router = useRouter();
  const { outfit: outfitOn, outfitBuilder } = useCredits();
  const { status } = useAuth();
  const { profile } = useProfile();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const rows = useMemo(() => categoryRows(items), [items]);
  const empty = loaded && items.length === 0;

  // One way in: the Add tab asks what the photo shows and where it comes from.
  const add = () => router.push("/add");

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 28 }}>
        <Greeting now={new Date()} name={profile?.display_name} onCredits={() => router.push("/account")} />
        <CaptureBanner />

        {status === "signedIn" && outfitBuilder ? (
          <Pressable
            onPress={() => router.push("/build-my-look")}
            accessibilityRole="button"
            accessibilityLabel="Build My Look. Outfit ideas made from your own closet."
            style={{
              marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: radius.list, backgroundColor: colors.tintSoft,
              flexDirection: "row", alignItems: "center", gap: 14,
            }}
          >
            <View style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.tint, alignItems: "center", justifyContent: "center" }}>
              <Icon name="sparkles" size={20} color={colors.onTint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.headline, color: colors.label }}>Build My Look</Text>
              <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 1 }}>Outfit ideas made from your own closet.</Text>
            </View>
            <Icon name="chevron" size={16} color={colors.secondaryLabel} />
          </Pressable>
        ) : null}

        {loadError ? (
          <View style={{ margin: 20, padding: 16, borderRadius: radius.list, backgroundColor: colors.destructiveBg, gap: 10 }}>
            <Text style={{ ...type.subhead, color: colors.destructive }}>{loadError}</Text>
            <Button title="Try again" size="medium" variant="secondary" onPress={load} />
          </View>
        ) : null}

        {empty ? (
          <View style={{ marginTop: 20 }}>
            {/* Signed in: the guided First 3 Pieces start is the one entry. Local mode: plain Add Clothes. */}
            {status === "signedIn" ? (
              <HomeEmpty outfit={!!outfitOn} onFirstPieces={() => router.push({ pathname: "/first-pieces", params: { entry: "home" } })} />
            ) : (
              <HomeEmpty outfit={!!outfitOn}><AddClothesButton onPress={add} /></HomeEmpty>
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable
              onPress={() => router.push({ pathname: "/closet", params: { search: "1", at: String(Date.now()) } })}
              accessibilityRole="search" accessibilityLabel={`Search ${items.length} pieces`}
              style={{ marginTop: 22, height: 44, borderRadius: radius.input, backgroundColor: colors.fill, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}
            >
              <Icon name="search" size={17} color={colors.secondaryLabel} />
              <Text style={{ ...type.callout, color: colors.secondaryLabel }}>{`Search ${items.length} ${items.length === 1 ? "piece" : "pieces"}`}</Text>
            </Pressable>

            <View style={{ marginTop: 16 }}>
              <AddClothesButton onPress={add} />
            </View>

            {rows.length ? (
              <>
                <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingTop: 28, paddingBottom: 6 }}>Your closet</Text>
                <CategoryRows rows={rows} onOpen={(g) => router.push({ pathname: "/closet", params: { group: g, at: String(Date.now()) } })} />
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}
