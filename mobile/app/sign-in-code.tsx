import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { CODE_LENGTH, CodeBoxes } from "../src/components/CodeBoxes";
import { ErrorNote } from "../src/components/ErrorNote";
import { haptics } from "../src/haptics";
import { useOnboarding } from "../src/onboarding";
import { colors, hitSlopFor, type } from "../src/theme";
import { BackButton } from "../src/ui";

const RESEND_AFTER_S = 60;  // Supabase allows one code per address per minute
const VERIFY_AFTER_MS = 600;  // let the six green boxes register before moving on

export default function SignInCodeScreen() {
  const router = useRouter();
  const { email = "", sentAt } = useLocalSearchParams<{ email: string; sentAt?: string }>();
  const { sendCode, verifyCode } = useAuth();
  const { noteSignedIn, clearSignedIn } = useOnboarding();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(() => Number(sentAt || Date.now()) + RESEND_AFTER_S * 1000);
  const [now, setNow] = useState(Date.now);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const verifying = useRef(false);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  useEffect(() => {
    if (code.length !== CODE_LENGTH || verifying.current) return;
    const timer = setTimeout(async () => {
      verifying.current = true;
      setBusy(true);
      setError(null);
      noteSignedIn();  // before verifying: success swaps the whole navigator to the app
      try {
        await verifyCode(email, code);
        haptics.success();
      } catch (e) {
        clearSignedIn();
        setCode("");
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      } finally {
        verifying.current = false;
        setBusy(false);
      }
    }, VERIFY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [code, email, verifyCode, noteSignedIn, clearSignedIn]);

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await sendCode(email);
      const t = Date.now();
      setNow(t);
      setResendAt(t + RESEND_AFTER_S * 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ height: 44, justifyContent: "center" }}>
            <BackButton onPress={() => router.back()} />
          </View>
          <Text accessibilityRole="header" style={{ ...type.screenTitle, color: colors.label, marginTop: 12 }}>Check your inbox</Text>
          <Text style={{ ...type.body, color: colors.secondaryLabel, marginTop: 8, marginBottom: 28 }}>
            {`Enter the code we sent to ${email}`}
          </Text>
          <CodeBoxes value={code} onChange={(c) => { setError(null); setCode(c); }} disabled={busy} />
          {code.length === CODE_LENGTH && !error ? (
            <Text style={{ ...type.footnote, color: colors.successText, marginTop: 10 }}>Checking…</Text>
          ) : null}
          {error ? <View style={{ marginTop: 14 }}><ErrorNote message={error} /></View> : null}
          <View style={{ marginTop: 24, alignItems: "center", gap: 4 }}>
            <TextLink label={resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"} onPress={resend} disabled={busy || resendIn > 0} />
            <TextLink label="Use a different email" onPress={() => router.back()} disabled={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} hitSlop={hitSlopFor(22)} style={{ paddingVertical: 11 }}>
      <Text style={{ ...type.body, color: disabled ? colors.secondaryLabel : colors.tint, fontVariant: ["tabular-nums"] }}>{label}</Text>
    </Pressable>
  );
}
