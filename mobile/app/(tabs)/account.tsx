import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { deleteAccount, getCredits } from "../../src/api/client";
import type { CreditAction, CreditEntry } from "../../src/api/types";
import { useAppearance, type AppearanceMode } from "../../src/appearance";
import { APP_NAME } from "../../src/appName";
import { useAuth } from "../../src/auth/AuthProvider";
import { useCredits } from "../../src/credits/CreditsProvider";
import { NAME_MAX, useProfile, validName } from "../../src/profile";
import { useNotify } from "../../src/notifications";
import { BILLING_OFF, creditsLabel, entryLabel, entrySign, visibleEntries } from "../../src/credits/credits";
import { colors, radius, TAB_BAR_HEIGHT, type } from "../../src/theme";
import { Button, GroupedList, ProgressBar, Row, Segmented, Sheet } from "../../src/ui";

export const LOW_CREDITS = 3;
const PRICE_ROWS: [CreditAction, string][] = [["garment", "Front image"], ["back", "Back image"], ["turn", "360° view"]];
const HOW_IT_WORKS = [
  ["Finding garments is free", "Detecting the pieces in a photo never uses credits."],
  ["You pay per image created", "A front image, a back image or a 360° view each have their own price. Failed attempts cost nothing."],
  ["You always see the cost first", "Every AI action shows its price and your balance before anything is made."],
];

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// From the chosen name when there is one, else from the email's name part.
export function initials(email: string | null, displayName?: string | null): string {
  const name = (displayName || (email ?? "").split("@")[0]).replace(/[^\p{L}]+/gu, " ").trim();
  const parts = name.split(" ").filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function AccountScreen() {
  const router = useRouter();
  const { status, email, signOut } = useAuth();
  const { billing, prices, credits, outfit, refresh } = useCredits();
  const { mode, setMode } = useAppearance();
  const notify = useNotify();
  const [how, setHow] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { profile, saveName } = useProfile();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  async function saveNameDraft() {
    setNameError(null);
    try {
      await saveName(nameDraft);
      setEditingName(false);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Couldn't save your name. Try again.");
    }
  }
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function removeAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      setConfirmDelete(false);
      await signOut();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete your account. Try again.");
    } finally {
      setDeleting(false);
    }
  }
  const [extra, setExtra] = useState<CreditEntry[]>([]);
  const [next, setNext] = useState<number | null | undefined>(undefined);
  const [moreError, setMoreError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void refresh(); setExtra([]); setNext(undefined); }, [refresh]));

  const entries = visibleEntries([...(credits?.entries ?? []), ...extra]);
  const cursor = next === undefined ? credits?.next_before ?? null : next;
  async function more() {
    if (!cursor) return;
    setMoreError(null);
    try {
      const page = await getCredits(cursor);
      if (!page) return;
      setExtra((have) => [...have, ...page.entries]);
      setNext(page.next_before);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "Couldn't load more activity.");
    }
  }

  const appearance = (
    <GroupedList header="Settings">
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        <Text style={{ ...type.body, color: colors.label }}>Appearance</Text>
        <Segmented<AppearanceMode>
          options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          value={mode} onChange={(m) => void setMode(m)}
        />
      </View>
      {status === "signedIn" ? (
        <Row label="Notify when ready" accessory={
          <Switch accessibilityLabel="Notify when ready" value={notify.enabled} disabled={notify.busy}
            onValueChange={(on) => void notify.setEnabled(on)} />
        } />
      ) : null}
      {notify.error ? <Text style={{ ...type.footnote, color: colors.destructive, paddingHorizontal: 16, paddingBottom: 10 }}>{notify.error}</Text> : null}
      <Row label="Help & Support" accessory="chevron" onPress={() => router.push("/help")} />
      <Row label="Privacy" accessory="chevron" onPress={() => router.push("/privacy")} />
    </GroupedList>
  );

  const version = Constants.expoConfig?.version;
  if (status === "local") {
    return (
      <SafeAreaView edges={["top"]} style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Account</Text>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.list, padding: 16, gap: 4 }}>
            <Text style={{ ...type.headline, color: colors.label }}>Local mode</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Not signed in. Your items live on your computer's wardrobe server.</Text>
          </View>
          {appearance}
          {version ? <Text style={styles.footer}>{`${APP_NAME} ${version}`}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const low = !!credits && credits.available <= LOW_CREDITS;
  const enough = credits && prices.garment ? Math.floor(credits.available / prices.garment) : null;
  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Account</Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.card, borderRadius: radius.list, padding: 16 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...type.headline, color: colors.tint }}>{initials(email, profile?.display_name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {profile?.display_name ? <Text numberOfLines={1} style={{ ...type.headline, color: colors.label }}>{profile.display_name}</Text> : null}
            <Text numberOfLines={1} style={{ ...(profile?.display_name ? type.subhead : type.body), color: profile?.display_name ? colors.secondaryLabel : colors.label }}>{email}</Text>
          </View>
          <Text onPress={() => { setNameDraft(profile?.display_name ?? ""); setNameError(null); setEditingName(true); }}
            accessibilityRole="button" accessibilityLabel="Edit name" style={{ ...type.body, color: colors.tint }}>Edit</Text>
        </View>

        {credits ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 }}>
              <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel }}>AI Credits</Text>
              <Text onPress={() => setHow(true)} accessibilityRole="button" style={{ ...type.subhead, color: colors.tint }}>How it works</Text>
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: radius.list, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text accessibilityLabel={`${credits.available} AI credits available`} style={{ ...type.balance, color: colors.label }}>{credits.available}</Text>
                {credits.granted > 0 ? <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{`of ${credits.granted} granted`}</Text> : null}
              </View>
              {credits.granted > 0 ? (
                <ProgressBar value={credits.available / credits.granted} warning={low} accessibilityLabel="Credits left" />
              ) : null}
              {billing ? (
                <Text style={{ ...type.footnote, color: low ? colors.warningText : colors.secondaryLabel }}>
                  {low
                    ? "Running low. Ask the app owner for more credits."
                    : [`${credits.used} used so far`, enough !== null ? `enough for about ${enough} more ${enough === 1 ? "garment" : "garments"}` : null].filter(Boolean).join(" · ")}
                </Text>
              ) : (
                <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{BILLING_OFF}</Text>
              )}
              {credits.held > 0 ? <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{`${credits.held} held for work in progress`}</Text> : null}
            </View>
          </View>
        ) : null}

        {credits && billing ? (
          <GroupedList header="Price list">
            {outfit ? <Row label="Garment detection" value="Free" /> : null}
            {PRICE_ROWS.filter(([a]) => prices[a] !== undefined).map(([a, label]) => (
              <Row key={a} label={label} value={creditsLabel(prices[a]!)} />
            ))}
          </GroupedList>
        ) : null}

        {credits ? (
          <GroupedList header="Recent activity">
            {entries.length ? entries.map((e) => (
              <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.body, color: colors.label }}>{entryLabel(e)}</Text>
                  <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{dateLabel(e.created_at)}</Text>
                </View>
                <Text style={{ ...type.body, fontWeight: "600", color: e.kind === "grant" ? colors.successText : colors.label, fontVariant: ["tabular-nums"] }}>{entrySign(e)}</Text>
              </View>
            )) : <View style={{ padding: 16 }}><Text style={{ ...type.subhead, color: colors.secondaryLabel }}>No credit activity yet.</Text></View>}
            {cursor ? <Row label="Show more" tint onPress={more} /> : null}
          </GroupedList>
        ) : null}
        {moreError ? <Text style={{ ...type.footnote, color: colors.destructive }}>{moreError}</Text> : null}

        {appearance}

        <GroupedList>
          <Row label="Sign Out" tint onPress={() => setConfirmSignOut(true)} />
          <Row label="Delete Account" destructive onPress={() => { setDeleteError(null); setConfirmDelete(true); }} />
        </GroupedList>
        {version ? <Text style={styles.footer}>{`${APP_NAME} ${version}`}</Text> : null}
      </ScrollView>

      <Sheet visible={how} onClose={() => setHow(false)} title="How AI Credits work" floating>
        <View style={{ gap: 16, marginBottom: 20 }}>
          {HOW_IT_WORKS.map(([title, body], i) => (
            <View key={title} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...type.footnote, fontWeight: "700", color: colors.tint }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button title="Got It" onPress={() => setHow(false)} />
      </Sheet>
      <Sheet visible={editingName} onClose={() => setEditingName(false)} title="Your name" floating>
        <TextInput
          accessibilityLabel="Your name" value={nameDraft} onChangeText={setNameDraft} autoFocus autoCapitalize="words"
          maxLength={NAME_MAX} placeholder="Your name" placeholderTextColor={colors.tertiaryLabel}
          style={{ ...type.body, color: colors.label, backgroundColor: colors.grouped, height: 52, borderRadius: radius.button, paddingHorizontal: 16, marginBottom: 16 }}
        />
        {nameError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{nameError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Save" onPress={saveNameDraft} disabled={!validName(nameDraft)} />
          <Button title="Cancel" variant="text" onPress={() => setEditingName(false)} />
        </View>
      </Sheet>
      <Sheet visible={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} title="Delete your account?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 20 }}>
          Your closet, photos and AI credits are removed for good. This can't be undone.
        </Text>
        {deleteError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{deleteError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Delete Account" variant="destructive" onPress={removeAccount} loading={deleting} />
          <Button title="Cancel" variant="text" onPress={() => setConfirmDelete(false)} disabled={deleting} />
        </View>
      </Sheet>
      <Sheet visible={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 20 }}>You'll need a new email code to sign back in.</Text>
        <View style={{ gap: 6 }}>
          <Button title="Sign Out" variant="destructive" onPress={() => { setConfirmSignOut(false); void signOut(); }} />
          <Button title="Cancel" variant="text" onPress={() => setConfirmSignOut(false)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.grouped },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + 24, gap: 22 },
  title: { ...type.largeTitle, color: colors.label, paddingHorizontal: 4 },
  footer: { ...type.footnote, color: colors.secondaryLabel, textAlign: "center" },
});
