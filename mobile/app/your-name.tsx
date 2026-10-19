import React, { useState } from "react";
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ErrorNote } from "../src/components/ErrorNote";
import { haptics } from "../src/haptics";
import { NAME_MAX, useProfile, validName } from "../src/profile";
import { colors, radius, type } from "../src/theme";
import { Button } from "../src/ui";

// Part of signing up: the name the app greets you with. Shown once, after the code, when the account
// has no name yet; it can be changed later in Account.
export default function YourNameScreen() {
  const router = useRouter();
  const { saveName } = useProfile();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = validName(name);

  async function save() {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await saveName(name);
      haptics.success();
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save your name. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label }}>What should we call you?</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8, marginBottom: 28 }}>
            We'll use it to greet you. You can change it later in Account.
          </Text>
          <TextInput
            accessibilityLabel="Your name"
            placeholder="Your name"
            placeholderTextColor={colors.tertiaryLabel}
            value={name}
            onChangeText={setName}
            autoFocus
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={NAME_MAX}
            returnKeyType="done"
            onSubmitEditing={save}
            style={{
              ...type.body, color: colors.label, backgroundColor: colors.grouped, height: 56, borderRadius: radius.button,
              paddingHorizontal: 16, borderWidth: 1.5, borderColor: ok ? colors.tint : "transparent",
            }}
          />
          {error ? <View style={{ marginTop: 14 }}><ErrorNote message={error} /></View> : null}
          <View style={{ flex: 1, minHeight: 24 }} />
          <Button title="Continue" onPress={save} disabled={!ok} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
