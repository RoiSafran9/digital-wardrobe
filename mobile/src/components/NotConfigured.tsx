import React from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, type } from "../theme";
import { Glass, GlassScreen } from "../ui";

// Shown instead of the app when a release build is missing its Supabase settings.
export function NotConfigured({ reason }: { reason: string }) {
  return (
    <GlassScreen>
      <SafeAreaView style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>Sign-in isn't configured</Text>
        <Glass radius={radius.list} style={styles.card}>
          <Text style={styles.body}>
            This build is missing its Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.
          </Text>
          <Text style={styles.reason}>{reason}</Text>
        </Glass>
      </SafeAreaView>
    </GlassScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  title: { ...type.largeTitle, color: colors.label, marginTop: 24, paddingHorizontal: 4 },
  card: { marginTop: 16, padding: 16, gap: 10 },
  body: { ...type.body, color: colors.label },
  reason: { ...type.footnote, color: colors.secondaryLabel },
});
