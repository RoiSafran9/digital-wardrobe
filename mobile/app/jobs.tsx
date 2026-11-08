import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FlowBar } from "../src/components/capture/FlowChrome";
import { Icon } from "../src/components/Icon";
import { useActiveJobs } from "../src/jobs/activeJobs";
import { colors, radius, type, weight } from "../src/theme";
import { Glass, GlassScreen } from "../src/ui";

// Every AI job this account has going on this phone, each opening its own details. Reached from the jobs
// banner when there is more than one; the work runs on the server whether or not this is open.
export default function JobsScreen() {
  const router = useRouter();
  const jobs = useActiveJobs();
  return (
    <GlassScreen>
      <SafeAreaView style={{ flex: 1 }}>
        <FlowBar left={{ icon: "chevronLeft", label: "Back", onPress: () => router.back() }} title="In Progress" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 10 }}>
          <Text style={{ ...type.subhead, color: colors.secondaryLabel }}>
            Your pieces keep being made on the server while you use the app or close it.
          </Text>
          {jobs.length === 0 ? <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8 }}>Nothing in progress.</Text> : null}
          {jobs.map((job) => (
            <Pressable key={job.id} accessibilityRole="button" accessibilityLabel={job.detail ? `${job.label} ${job.detail}` : job.label}
              onPress={() => router.push(job.route)} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <Glass radius={radius.tile} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                <View style={{ width: 22, alignItems: "center" }}>
                  {job.state === "working" ? <ActivityIndicator color={colors.tint} />
                    : <Icon name={job.state === "failed" ? "alert" : "check"} size={20} color={job.state === "failed" ? colors.destructive : colors.success} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.callout, ...weight(600), color: job.state === "failed" ? colors.destructive : colors.label }}>{job.label}</Text>
                  {job.detail ? <Text style={{ ...type.footnote, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>{job.detail}</Text> : null}
                </View>
                <Icon name="chevron" size={15} color={colors.tertiaryLabel} />
              </Glass>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </GlassScreen>
  );
}
