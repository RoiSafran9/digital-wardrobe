import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { APP_NAME } from "../appName";
import { Icon } from "../components/Icon";
import { colors, radius, type } from "../theme";
import { Button, Glass } from "../ui";
import { useMorningReminder } from "./MorningReminderProvider";
import { whenLabel } from "./schedule";

export const OFFER_TITLE = "Want a reminder tomorrow morning?";
export const OFFER_DETAIL = "Already dressed? A mirror photo is a quick way to add what you're wearing to KIPS.";
export const OFFER_DISCLOSURE = "One reminder only. You can turn it off in Account.";
export const DENIED_TITLE = "Notifications are off";
export const DENIED_DETAIL = `To get the reminder, allow notifications for ${APP_NAME} in iOS Settings, then turn it on in Account.`;

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Glass radius={radius.list} style={{ padding: 16, gap: 12 }} testID="morning-reminder-card">
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }} accessible accessibilityLabel={label}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.tintSoft }}>
          <Icon name="sun" size={19} color={colors.tint} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>{children}</View>
      </View>
    </Glass>
  );
}

// Home's one-time, non-blocking offer of the morning reminder (never a popup, never on top of a sheet).
// iOS is only asked for permission after "Remind Me". `hidden`: something is being made right now.
// `style` applies only when something is drawn, so an absent card leaves no gap.
export function MorningReminderCard({ hidden, style }: { hidden?: boolean; style?: StyleProp<ViewStyle> }) {
  const r = useMorningReminder();
  if (r.notice === "set" && r.record?.fireAt) {
    const when = whenLabel(r.record.fireAt, new Date());
    return (
      <View style={[{ gap: 8 }, style]}>
        <Shell label={`Reminder set for ${when}. ${OFFER_DISCLOSURE}`}>
          <Text style={{ ...type.headline, color: colors.label }}>{`Reminder set for ${when}`}</Text>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{OFFER_DISCLOSURE}</Text>
        </Shell>
        <Button title="Done" variant="text" size="medium" onPress={r.dismissNotice} />
      </View>
    );
  }
  if (r.notice === "denied") {
    return (
      <View style={[{ gap: 8 }, style]}>
        <Shell label={`${DENIED_TITLE}. ${DENIED_DETAIL}`}>
          <Text style={{ ...type.headline, color: colors.label }}>{DENIED_TITLE}</Text>
          <Text style={{ ...type.footnote, color: colors.secondaryLabel }}>{DENIED_DETAIL}</Text>
        </Shell>
        <Button title="Done" variant="text" size="medium" onPress={r.dismissNotice} />
      </View>
    );
  }
  if (!r.offerVisible || hidden) return null;
  return (
    <View style={style}>
      <Glass radius={radius.list} style={{ padding: 16, gap: 14 }} testID="morning-reminder-card">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.tintSoft }}
            importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Icon name="sun" size={19} color={colors.tint} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text accessibilityRole="header" style={{ ...type.headline, color: colors.label }}>{OFFER_TITLE}</Text>
            <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>{OFFER_DETAIL}</Text>
            <Text style={{ ...type.footnote, color: colors.secondaryLabel, marginTop: 2 }}>{OFFER_DISCLOSURE}</Text>
          </View>
        </View>
        <View style={{ gap: 4 }}>
          <Button title="Remind Me" size="medium" onPress={() => void r.accept()} loading={r.busy} disabled={r.busy} />
          <Button title="Not Now" variant="text" size="medium" onPress={() => void r.decline()} disabled={r.busy} />
        </View>
        {r.error ? <Text accessibilityLiveRegion="polite" style={{ ...type.footnote, color: colors.destructive }}>{r.error}</Text> : null}
      </Glass>
    </View>
  );
}
