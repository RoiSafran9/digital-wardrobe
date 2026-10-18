import React from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, type } from "../theme";

// Shown instead of the app when a release build is missing its Supabase settings.
export function NotConfigured({ reason }: { reason: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Sign-in isn't configured</Text>
      <Text style={styles.body}>
        This build is missing its Supabase settings. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.
      </Text>
      <Text style={styles.reason}>{reason}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 24 },
  title: { ...type.largeTitle, color: colors.label, marginTop: 20 },
  body: { ...type.body, color: colors.label, marginTop: 12 },
  reason: { ...type.footnote, color: colors.secondaryLabel, marginTop: 12 },
});
