import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCredits } from "../credits/CreditsProvider";
import { creditsLabel, quote, type QuoteLine } from "../credits/credits";
import { colors, radius, type } from "../theme";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { track, type Action } from "../activity/track";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  lines: QuoteLine[];
  note?: string;  // e.g. "Detection was free"
  confirmLabel: string;  // the caller names the price, e.g. "Generate · 4 credits"
  onConfirm: () => void;
  onClose: () => void;
  action?: Action;  // for the activity record when the lines don't say it (outfit, regenerate)
};

// Every paid AI action is confirmed here first: each line at the server's price, the total, and the
// balance before and after.
export function CostSheet({ visible, title, subtitle, lines, note, confirmLabel, onConfirm, onClose, action }: Props) {
  const { prices, credits } = useCredits();
  const q = quote(lines, prices, credits?.available ?? null);
  const choose = (choice: "confirmed" | "cancelled", then: () => void) => () => {
    const kind = action ?? lines[0]?.action;
    if (kind) track("cost_sheet", { action: kind, choice, pieces: lines.reduce((n, l) => n + l.count, 0) });
    then();
  };
  return (
    <Sheet visible={visible} onClose={choose("cancelled", onClose)} title={title} floating>
      {subtitle ? <Text style={{ ...type.subhead, color: colors.secondaryLabel, marginBottom: 16 }}>{subtitle}</Text> : null}
      <View style={{ backgroundColor: colors.grouped, borderRadius: radius.list, paddingHorizontal: 16 }}>
        {q.lines.map((l) => (
          <View key={l.label} style={styles.row}>
            <Text style={{ ...type.body, color: colors.label }}>{l.label}</Text>
            <Text style={{ ...type.body, color: colors.label }}>{creditsLabel(l.credits)}</Text>
          </View>
        ))}
        <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator }]}>
          <Text style={{ ...type.headline, color: colors.label }}>Total</Text>
          <Text style={{ ...type.headline, color: colors.label }}>{creditsLabel(q.total)}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, marginBottom: 20, gap: 12 }}>
        {credits && q.after !== null ? (
          <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{`Balance ${credits.available} → ${q.after}`}</Text>
        ) : <View />}
        {note ? <Text style={{ ...type.footnote, color: colors.successText }}>{note}</Text> : null}
      </View>
      <View style={{ gap: 6 }}>
        <Button title={confirmLabel} onPress={choose("confirmed", onConfirm)} disabled={!q.affordable} />
        <Button title="Cancel" variant="text" onPress={choose("cancelled", onClose)} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 } });
