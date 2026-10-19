import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "../Icon";
import { useCaptureJobs } from "../../store/captureJobs";
import { colors, radius, type } from "../../theme";

// The garment photo still being worked on (or finished while the user was elsewhere). Tapping it
// returns to the processing screen, which forwards to the results when they're ready.
export function CaptureBanner() {
  const router = useRouter();
  const { current } = useCaptureJobs();
  if (!current) return null;
  const label = current.status === "running" ? "Creating your pieces…"
    : current.status === "done" ? "Your pieces are ready — review them"
    : "Generation paused — tap to see why";
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      onPress={() => router.push(current.status === "done" ? "/capture/results" : "/capture/processing")}
      style={{ marginHorizontal: 20, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.list, backgroundColor: current.status === "failed" ? colors.destructiveBg : colors.tintSoft }}
    >
      {current.status === "running" ? <ActivityIndicator color={colors.tint} /> : <Icon name={current.status === "done" ? "check" : "alert"} size={20} color={current.status === "failed" ? colors.destructive : colors.tint} />}
      <Text style={{ ...type.subhead, fontWeight: "600", color: current.status === "failed" ? colors.destructive : colors.label, flex: 1 }}>{label}</Text>
      <View><Icon name="chevron" size={14} color={colors.secondaryLabel} /></View>
    </Pressable>
  );
}
