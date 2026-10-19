import React, { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { CreditsCard } from "../../src/components/CreditsCard";
import { PillButton } from "../../src/components/PillButton";
import { useCredits } from "../../src/credits/CreditsProvider";
import { colors, radius, type } from "../../src/theme";

export default function AccountScreen() {
  const { status, email, signOut } = useAuth();
  const { refresh } = useCredits();
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const confirmSignOut = () =>
    Alert.alert("Sign out?", "You'll need a new email code to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } },
    ]);

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>Account</Text>
      {status === "local" ? (
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Local mode</Text>
          <Text style={styles.rowDetail}>Not signed in. Your items live on your computer's wardrobe server.</Text>
        </View>
      ) : (
        <>
          <View style={[styles.card, styles.row]}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
          </View>
          <CreditsCard />
          <PillButton label="Sign out" onPress={confirmSignOut} />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  title: { ...type.largeTitle, color: colors.label, marginTop: 20, marginBottom: 20 },
  card: { backgroundColor: colors.grouped, borderRadius: radius.card, padding: 14, marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLabel: { ...type.body, color: colors.label },
  rowValue: { ...type.body, color: colors.secondaryLabel, flexShrink: 1 },
  rowDetail: { ...type.subhead, color: colors.secondaryLabel, marginTop: 4 },
});
