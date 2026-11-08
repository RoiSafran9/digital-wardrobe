import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ColorValue } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { deleteAccount, getCredits } from "../../src/api/client";
import type { CreditAction, CreditEntry } from "../../src/api/types";
import { useAppearance, type AppearanceMode } from "../../src/appearance";
import { APP_NAME } from "../../src/appName";
import { useAuth } from "../../src/auth/AuthProvider";
import { Icon, type IconName } from "../../src/components/Icon";
import { useCredits } from "../../src/credits/CreditsProvider";
import { NAME_MAX, useProfile, validName } from "../../src/profile";
import { DENIED, useNotify } from "../../src/notifications";
import { useMorningReminder } from "../../src/morningReminder/MorningReminderProvider";
import { whenLabel } from "../../src/morningReminder/schedule";
import { BILLING_OFF, creditsLabel, entryLabel, entrySign, visibleEntries } from "../../src/credits/credits";
import { EASE_OUT, Rise } from "../../src/motion/Rise";
import { colors, hitSlopFor, radius, TAB_BAR_HEIGHT, type, weight } from "../../src/theme";
import { Button, Glass, GlassScreen, GroupedList, Row, Segmented, Sheet } from "../../src/ui";
import { useReducedMotion } from "../../src/useReducedMotion";
import { useScreenViewed } from "../../src/activity/track";

export const LOW_CREDITS = 3;
// The price list: a short label for the grid, the full name for VoiceOver.
const PRICE_ROWS: [CreditAction, string, string, IconName][] = [
  ["garment", "Front", "Front image", "garment"],
  ["back", "Back", "Back image", "cameraBack"],
  ["turn", "360°", "360° view", "turn"],
];
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

const RING = 92;
const STROKE = 9;
const HALF = RING / 2;

// One stroke-wide ring with only two adjacent sides colored: half a circle, split on the diagonals.
function halfRing(color: ColorValue, side: "left" | "right") {
  const on = (s: "left" | "right") => (s === side ? color : "transparent");
  return {
    position: "absolute" as const, top: 0, width: RING, height: RING, borderRadius: HALF, borderWidth: STROKE,
    borderTopColor: on("right"), borderRightColor: on("right"), borderBottomColor: on("left"), borderLeftColor: on("left"),
  };
}

// The AI credits ring meter (92pt, 9pt stroke) without SVG: two half rings, each clipped to one half of
// the circle and turned into view, with round caps at both ends. It fills in from empty on arrival;
// under Reduce Motion it is drawn at its value at once.
function CreditRing({ value, warning, children }: { value: number | null; warning: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = value === null ? 0 : Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { t.setValue(v); return; }
    const anim = Animated.timing(t, { toValue: v, duration: 900, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, reduced, t]);
  const color = warning ? colors.warning : colors.tint;
  const cap = { position: "absolute" as const, top: 0, left: HALF - STROKE / 2, width: STROKE, height: STROKE, borderRadius: STROKE / 2, backgroundColor: color };
  const shown = t.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] });
  return (
    <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
      <View
        accessible={value !== null}
        accessibilityRole={value !== null ? "progressbar" : undefined}
        accessibilityLabel={value !== null ? "Credits left" : undefined}
        accessibilityValue={value !== null ? { min: 0, max: 100, now: Math.round(v * 100) } : undefined}
        style={StyleSheet.absoluteFill}
      >
        <View style={{ position: "absolute", top: 0, left: 0, width: RING, height: RING, borderRadius: HALF, borderWidth: STROKE, borderColor: colors.fill }} />
        {/* Right half: 0 → 50%. */}
        <View style={{ position: "absolute", top: 0, left: HALF, width: HALF, height: RING, overflow: "hidden" }}>
          <Animated.View style={[halfRing(color, "left"), {
            left: -HALF,
            transform: [{ rotate: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["45deg", "225deg", "225deg"] }) }],
          }]} />
        </View>
        {/* Left half: 50% → 100%. */}
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, width: HALF, height: RING, overflow: "hidden",
          opacity: t.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }),
        }}>
          <Animated.View style={[halfRing(color, "right"), {
            left: 0,
            transform: [{ rotate: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["45deg", "45deg", "225deg"] }) }],
          }]} />
        </Animated.View>
        <Animated.View style={[cap, { opacity: shown }]} />
        <Animated.View style={{
          position: "absolute", top: 0, left: 0, width: RING, height: RING, opacity: shown,
          transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
        }}>
          <View style={cap} />
        </Animated.View>
      </View>
      {children}
    </View>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={{ ...type.eyebrow, color: colors.secondaryLabel, paddingHorizontal: 16 }}>{children}</Text>;
}

export default function AccountScreen() {
  useScreenViewed("account");
  const router = useRouter();
  const { status, email, signOut } = useAuth();
  const { billing, prices, credits, outfit, refresh } = useCredits();
  const { mode, setMode } = useAppearance();
  const notify = useNotify();
  const reminder = useMorningReminder();
  const reminderOn = reminder.record?.status === "scheduled";
  const reminderDenied = reminder.notice === "denied" || (reminder.record?.status === "denied" && !reminderOn);
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
      await reminder.forgetAccount();  // its pending morning reminder and this phone's record of it
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
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
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
      {/* The one-time morning reminder: its own consent, separate from Notify when ready. */}
      {status === "signedIn" && reminder.enabled && (reminderOn || reminder.armable) ? (
        <>
          <Row label="Morning reminder" accessory={
            <Switch accessibilityLabel="Morning reminder" value={reminderOn} disabled={reminder.busy}
              onValueChange={(on) => void (on ? reminder.accept() : reminder.turnOff())} />
          } />
          <Text style={{ ...type.footnote, color: reminder.error ? colors.destructive : colors.secondaryLabel, paddingHorizontal: 16, paddingBottom: 10 }}>
            {reminder.error ?? (reminderOn && reminder.record?.fireAt
              ? `Set for ${whenLabel(reminder.record.fireAt, new Date())}. One reminder only.`
              : reminderDenied ? DENIED : "One reminder at 8:45 AM to add what you're wearing. Separate from Notify when ready.")}
          </Text>
        </>
      ) : null}
      <Row label="Help & Support" accessory="chevron" onPress={() => router.push("/help")} />
      <Row label="Privacy" accessory="chevron" onPress={() => router.push("/privacy")} />
    </GroupedList>
  );

  const version = Constants.expoConfig?.version;
  if (status === "local") {
    return (
      <GlassScreen>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>Me</Text>
            <Glass radius={radius.list} style={{ padding: 16, gap: 4, marginTop: -10 }}>
              <Text style={{ ...type.cardTitle, color: colors.label }}>Local mode</Text>
              <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>Not signed in. Your items live on your computer's wardrobe server.</Text>
            </Glass>
            {appearance}
            {version ? <Text style={styles.footer}>{`${APP_NAME} ${version}`}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </GlassScreen>
    );
  }

  const low = !!credits && credits.available <= LOW_CREDITS;
  const enough = credits && prices.garment ? Math.floor(credits.available / prices.garment) : null;
  const priceCells = credits && billing ? [
    ...(outfit ? [{ key: "detect", short: "Detection", full: "Garment detection", icon: "search" as IconName, value: "Free", spoken: "Free" }] : []),
    ...PRICE_ROWS.filter(([a]) => prices[a] !== undefined).map(([a, short, full, icon]) => (
      { key: a, short, full, icon, value: String(prices[a]), spoken: creditsLabel(prices[a]!) }
    )),
  ] : [];
  return (
    <GlassScreen>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Me</Text>

          <Glass radius={radius.list} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, marginTop: -10 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...type.cardTitle, color: colors.tint }}>{initials(email, profile?.display_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {profile?.display_name ? <Text numberOfLines={1} style={{ ...type.cardTitle, color: colors.label }}>{profile.display_name}</Text> : null}
              <Text numberOfLines={1} style={{ ...(profile?.display_name ? type.subhead : type.headline), color: profile?.display_name ? colors.secondaryLabel : colors.label }}>{email}</Text>
            </View>
            <Pressable onPress={() => { setNameDraft(profile?.display_name ?? ""); setNameError(null); setEditingName(true); }}
              accessibilityRole="button" accessibilityLabel="Edit name" hitSlop={hitSlopFor(22, 36)}>
              <Text style={{ ...type.body, color: colors.tint }}>Edit</Text>
            </Pressable>
          </Glass>

          {credits ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Eyebrow>AI Credits</Eyebrow>
                <Pressable onPress={() => setHow(true)} accessibilityRole="button" accessibilityLabel="How it works" hitSlop={hitSlopFor(20, 90)} style={{ paddingRight: 16 }}>
                  <Text style={{ ...type.subhead, color: colors.tint }}>How it works</Text>
                </Pressable>
              </View>
              <Glass radius={radius.list} style={{ flexDirection: "row", alignItems: "center", gap: 16, padding: 16 }}>
                <CreditRing value={credits.granted > 0 ? credits.available / credits.granted : null} warning={low}>
                  <Text accessibilityLabel={`${credits.available} AI credits available`} numberOfLines={1} adjustsFontSizeToFit
                    style={{ ...type.stat, color: colors.label, maxWidth: RING - STROKE * 2 - 8 }}>{credits.available}</Text>
                </CreditRing>
                <View style={{ flex: 1, gap: 4 }}>
                  {credits.granted > 0 ? <Text style={{ ...type.headline, color: colors.label }}>{`of ${credits.granted} granted`}</Text> : null}
                  {billing ? (
                    <Text style={{ ...type.footnote, lineHeight: 18, color: low ? colors.warningText : colors.secondaryLabel }}>
                      {low
                        ? "Running low. Ask the app owner for more credits."
                        : [`${credits.used} used so far`, enough !== null ? `enough for about ${enough} more ${enough === 1 ? "garment" : "garments"}` : null].filter(Boolean).join(" · ")}
                    </Text>
                  ) : (
                    <Text style={{ ...type.footnote, lineHeight: 18, color: colors.secondaryLabel }}>{BILLING_OFF}</Text>
                  )}
                  {credits.held > 0 ? <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{`${credits.held} held for work in progress`}</Text> : null}
                </View>
              </Glass>
            </View>
          ) : null}

          {priceCells.length ? (
            <View style={{ gap: 8 }}>
              <Eyebrow>Price list</Eyebrow>
              <Glass radius={radius.list} style={{ flexDirection: "row", paddingVertical: 14, paddingHorizontal: 6 }}>
                {priceCells.map((c) => (
                  <View key={c.key} accessible accessibilityLabel={`${c.full}, ${c.spoken}`} style={{ flex: 1, alignItems: "center", gap: 5 }}>
                    <Icon name={c.icon} size={22} color={colors.label} />
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...type.footnote, color: colors.secondaryLabel }}>{c.short}</Text>
                    <Text style={{ ...type.headline, ...weight(700), color: colors.label, fontVariant: ["tabular-nums"] }}>{c.value}</Text>
                  </View>
                ))}
              </Glass>
            </View>
          ) : null}

          {credits ? (
            <GroupedList header="Recent activity">
              {entries.length ? entries.map((e) => (
                <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...type.body, color: colors.label }}>{entryLabel(e)}</Text>
                    <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{dateLabel(e.created_at)}</Text>
                  </View>
                  <Text style={{ ...type.body, ...weight(600), color: e.kind === "grant" ? colors.successText : colors.label, fontVariant: ["tabular-nums"] }}>{entrySign(e)}</Text>
                </View>
              )) : <View style={{ padding: 16 }}><Text style={{ ...type.subhead, color: colors.secondaryLabel }}>No credit activity yet.</Text></View>}
              {cursor ? <Row label="Show more" tint onPress={more} /> : null}
            </GroupedList>
          ) : null}
          {moreError ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: -16, paddingHorizontal: 16 }}>{moreError}</Text> : null}

          {appearance}

          <View style={{ marginTop: -8 }}>
            <GroupedList>
              <Row label="Sign Out" tint onPress={() => setConfirmSignOut(true)} />
              <Row label="Delete Account" destructive onPress={() => { setDeleteError(null); setConfirmDelete(true); }} />
            </GroupedList>
          </View>
          {version ? <Text style={[styles.footer, { marginTop: -8 }]}>{`${APP_NAME} ${version}`}</Text> : null}
        </ScrollView>
      </SafeAreaView>

      <Sheet visible={how} onClose={() => setHow(false)} title="How AI Credits work" floating>
        <View style={{ gap: 16, marginBottom: 20 }}>
          {HOW_IT_WORKS.map(([title, body], i) => (
            <Rise key={title} delay={i * 80} style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.tintSoft, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...type.footnote, ...weight(700), color: colors.tint }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ ...type.headline, color: colors.label }}>{title}</Text>
                <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{body}</Text>
              </View>
            </Rise>
          ))}
        </View>
        <Button title="Got It" onPress={() => setHow(false)} />
      </Sheet>
      <Sheet visible={editingName} onClose={() => setEditingName(false)} title="Your name" floating>
        <TextInput
          accessibilityLabel="Your name" value={nameDraft} onChangeText={setNameDraft} autoFocus autoCapitalize="words"
          maxLength={NAME_MAX} placeholder="Your name" placeholderTextColor={colors.tertiaryLabel}
          style={{ ...type.body, color: colors.label, backgroundColor: colors.fill, height: 54, borderRadius: radius.input, paddingHorizontal: 16, marginBottom: 16 }}
        />
        {nameError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{nameError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Save" onPress={saveNameDraft} disabled={!validName(nameDraft)} />
          <Button title="Cancel" variant="text" onPress={() => setEditingName(false)} />
        </View>
      </Sheet>
      <Sheet visible={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} title="Delete your account?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 18 }}>
          Your closet, photos and AI credits are removed for good. This can't be undone.
        </Text>
        {deleteError ? <Text style={{ ...type.footnote, color: colors.destructive, marginBottom: 12 }}>{deleteError}</Text> : null}
        <View style={{ gap: 6 }}>
          <Button title="Delete Account" variant="danger" onPress={removeAccount} loading={deleting} />
          <Button title="Cancel" variant="text" size="medium" onPress={() => setConfirmDelete(false)} disabled={deleting} />
        </View>
      </Sheet>
      <Sheet visible={confirmSignOut} onClose={() => setConfirmSignOut(false)} title="Sign out?" floating>
        <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 18 }}>You'll need a new email code to sign back in.</Text>
        <View style={{ gap: 6 }}>
          <Button title="Sign Out" variant="danger" onPress={() => { setConfirmSignOut(false); void signOut(); }} />
          <Button title="Cancel" variant="text" size="medium" onPress={() => setConfirmSignOut(false)} />
        </View>
      </Sheet>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: TAB_BAR_HEIGHT + 28, gap: 24 },
  title: { ...type.largeTitle, color: colors.label, paddingHorizontal: 4 },
  footer: { ...type.footnote, color: colors.secondaryLabel, textAlign: "center" },
});
