import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { isValidEmail, normalizeCode, normalizeEmail } from "../src/auth/messages";
import { Icon } from "../src/components/Icon";
import { PillButton } from "../src/components/PillButton";
import { colors, hitSlopFor, MIN_TOUCH, radius, type } from "../src/theme";

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 60;  // Supabase allows one code per address per minute

export default function SignInScreen() {
  const { sendCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  function startResendWait() {
    const t = Date.now();
    setNow(t);
    setResendAt(t + RESEND_AFTER_S * 1000);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const send = () => run(async () => {
    await sendCode(email);
    setStep("code");
    setCode("");
    startResendWait();
  });

  const resend = () => run(async () => {
    await sendCode(email);
    startResendWait();
  });

  const verify = () => run(() => verifyCode(normalizeEmail(email), code));

  return (
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === "email" ? (
            <>
              <Text accessibilityRole="header" style={styles.title}>Sign in</Text>
              <Text style={styles.body}>Enter your email and we'll send you a 6-digit code.</Text>
              <TextInput
                accessibilityLabel="Email"
                placeholder="Email"
                placeholderTextColor={colors.secondaryLabel}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => isValidEmail(email) && !busy && send()}
                style={styles.field}
              />
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.title}>Check your email</Text>
              <Text style={styles.body}>{`Enter the 6-digit code we sent to ${normalizeEmail(email)}.`}</Text>
              <TextInput
                accessibilityLabel="6-digit code"
                placeholder="123456"
                placeholderTextColor={colors.secondaryLabel}
                value={code}
                onChangeText={(text) => setCode(normalizeCode(text).slice(0, CODE_LENGTH))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                autoFocus
                style={[styles.field, styles.codeField]}
              />
            </>
          )}

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert" size={18} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {step === "email" ? (
            <PillButton label="Send code" variant="primary" onPress={send} disabled={busy || !isValidEmail(email)} />
          ) : (
            <View style={{ gap: 10 }}>
              <PillButton label="Sign in" variant="primary" onPress={verify} disabled={busy || code.length !== CODE_LENGTH} />
              <TextLink
                label={resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                onPress={resend}
                disabled={busy || resendIn > 0}
              />
              <TextLink
                label="Use a different email"
                onPress={() => { setStep("email"); setError(null); }}
                disabled={busy}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TextLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={hitSlopFor(22)} style={styles.link}>
      <Text style={[styles.linkText, disabled && { color: colors.secondaryLabel }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  title: { ...type.largeTitle, color: colors.label, marginTop: 20 },
  body: { ...type.body, color: colors.secondaryLabel, marginTop: 8, marginBottom: 24 },
  field: {
    ...type.body, color: colors.label, backgroundColor: colors.grouped, borderRadius: radius.card,
    minHeight: MIN_TOUCH + 6, paddingHorizontal: 16, marginBottom: 14,
  },
  codeField: { fontSize: 28, letterSpacing: 8, fontVariant: ["tabular-nums"] },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.destructiveBg,
    borderRadius: 14, padding: 12, marginBottom: 14,
  },
  errorText: { color: colors.destructive, fontSize: 14, flex: 1 },
  link: { alignItems: "center", paddingVertical: 11 },
  linkText: { ...type.body, color: colors.tint, fontVariant: ["tabular-nums"] },
});
