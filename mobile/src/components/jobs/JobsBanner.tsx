import React from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../Icon";
import { colors, type, weight } from "../../theme";
import { Glass } from "../../ui";
import { summaryLabel, useActiveJobs } from "../../jobs/activeJobs";

// A small glass banner for the AI jobs this account has going, on Home, Closet, Build My Look and Me, so the
// user can browse while pieces are made. One job: its own words and its job details; several: a count and
// the jobs screen. It changes in place when a job finishes — it never moves the user anywhere by itself.
export function JobsBanner({ style }: { style?: ViewStyle }) {
  const router = useRouter();
  const jobs = useActiveJobs();
  if (!jobs.length) return null;
  const one = jobs.length === 1 ? jobs[0] : null;
  const working = jobs.some((j) => j.state === "working");
  const failed = !working && jobs.some((j) => j.state === "failed") && !jobs.some((j) => j.state === "ready");
  const label = one ? one.label : summaryLabel(jobs);
  const detail = one?.detail;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail ? `${detail}. Opens the details.` : "Opens the details."}
      accessibilityLiveRegion="polite"
      onPress={() => router.push(one ? one.route : "/jobs")}
      style={({ pressed }) => ({ marginTop: 12, opacity: pressed ? 0.8 : 1, ...style })}
    >
      <Glass radius={20} level="sheet" style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
        <View style={{ width: 22, alignItems: "center" }}>
          {working ? <ActivityIndicator color={colors.tint} />
            : <Icon name={failed ? "alert" : "check"} size={20} color={failed ? colors.destructive : colors.success} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...type.subhead, ...weight(700), color: failed ? colors.destructive : colors.label }}>{label}</Text>
          {detail ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{detail}</Text> : null}
        </View>
        <Icon name="chevron" size={15} color={colors.tertiaryLabel} />
      </Glass>
    </Pressable>
  );
}
