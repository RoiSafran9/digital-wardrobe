import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { getCredits } from "../api/client";
import type { CreditAction, CreditEntry } from "../api/types";
import { useCredits } from "../credits/CreditsProvider";
import { ACTION_LABELS, creditsLabel, entryLabel, entrySign, visibleEntries } from "../credits/credits";
import { colors, hitSlopFor, radius, type } from "../theme";
import { PillButton } from "./PillButton";

export type CreditsSheetMode = "prices" | "activity";

const ACTIONS: CreditAction[] = ["garment", "back", "turn"];

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Rows({ children }: { children: React.ReactNode[] }) {
  return (
    <View style={{ backgroundColor: colors.grouped, borderRadius: radius.card, paddingHorizontal: 16 }}>
      {children.map((child, i) => (
        <View key={i} style={{ paddingVertical: 12, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.separator }}>{child}</View>
      ))}
    </View>
  );
}

function PriceList() {
  const { prices } = useCredits();
  const priced = ACTIONS.filter((a) => prices[a] !== undefined);
  return (
    <>
      <Rows>
        {priced.map((action) => (
          <View key={action} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...type.body, color: colors.label }}>{ACTION_LABELS[action]}</Text>
            <Text style={{ ...type.body, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{creditsLabel(prices[action]!)}</Text>
          </View>
        ))}
      </Rows>
      <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 10 }}>
        A photo with several pieces makes one front image per piece, up to the number you choose; you pay only for the
        pieces made. A 360 view is one action. Failed attempts and automatic retries cost nothing. Viewing and editing
        your closet is always free.
      </Text>
    </>
  );
}

function Activity() {
  const { credits } = useCredits();
  const [entries, setEntries] = useState<CreditEntry[]>(credits?.entries ?? []);
  const [next, setNext] = useState<number | null>(credits?.next_before ?? null);
  const [error, setError] = useState<string | null>(null);

  async function more() {
    if (!next) return;
    setError(null);
    try {
      const page = await getCredits(next);
      if (!page) return;
      setEntries((have) => [...have, ...page.entries]);
      setNext(page.next_before);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more activity.");
    }
  }

  const shown = visibleEntries(entries);
  return (
    <>
      {shown.length ? (
        <Rows>
          {shown.map((entry) => (
            <View key={entry.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ ...type.body, color: colors.label }}>{entryLabel(entry)}</Text>
                <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{dateLabel(entry.created_at)}</Text>
              </View>
              <Text style={{ ...type.body, color: entry.kind === "grant" ? colors.tint : colors.label, fontVariant: ["tabular-nums"] }}>
                {entrySign(entry)}
              </Text>
            </View>
          ))}
        </Rows>
      ) : (
        <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>No credit activity yet.</Text>
      )}
      {next ? <View style={{ marginTop: 14 }}><PillButton label="Show more" onPress={more} /></View> : null}
      {error ? <Text style={{ ...type.footnote, color: colors.destructive, marginTop: 8 }}>{error}</Text> : null}
    </>
  );
}

export function CreditsSheet({ mode, onClose }: { mode: CreditsSheetMode | null; onClose: () => void }) {
  return (
    <Modal visible={mode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 8 }}>
          <Text accessibilityRole="header" style={{ ...type.title2, color: colors.label }}>
            {mode === "prices" ? "AI Price List" : "Credit activity"}
          </Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={hitSlopFor(22)}>
            <Text style={{ ...type.body, color: colors.tint }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 48 }}>
          {mode === "prices" ? <PriceList /> : mode === "activity" ? <Activity /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
