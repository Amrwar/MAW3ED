import { useState } from "react";
import { View, TextInput, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/AuthProvider";
import { egyptianMobile, emailLogin, loginCode } from "@/features/auth/validation";
import { messageFor } from "@/lib/api/errors";
import { colors, radius, spacing, touchTarget } from "@/constants/theme";

/**
 * Signing in.
 *
 * Two ways, because the platform has two kinds of account: customers
 * sign in with a code sent to their phone, as on the website; owners
 * and staff with email and password. Phone first — most people opening
 * the app are customers.
 *
 * The error shown is the server's own message. It is written in Arabic
 * for a person, and replacing it with something of our own would be
 * both more work and less accurate.
 */

type Mode = "phone" | "email";

export default function Login() {
  const [mode, setMode] = useState<Mode>("phone");

  return (
    <Screen dark>
      <View style={styles.header}>
        <Text variant="display" tone="inverse">
          أهلًا بيك
        </Text>
        <Text variant="body" tone="inverse" style={styles.subtitle}>
          سجّل دخولك عشان تشوف حجوزاتك وتدير نشاطك.
        </Text>
      </View>

      <View style={styles.switcher} accessibilityRole="tablist">
        {(
          [
            ["phone", "رقم الموبايل"],
            ["email", "أصحاب الأعمال"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            onPress={() => setMode(value)}
            style={[styles.tab, mode === value && styles.tabActive]}
          >
            <Text variant="label" tone="inverse">
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === "phone" ? <PhoneForm /> : <EmailForm />}
    </Screen>
  );
}

function PhoneForm() {
  const { requestCode, signInWithCode } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneOk = egyptianMobile.safeParse(phone).success;
  const codeOk = loginCode.safeParse(code).success;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await requestCode(phone);
      setSent(true);
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      await signInWithCode(phone, code);
      router.replace("/");
    } catch (e) {
      setError(messageFor(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text variant="label" tone="inverse" nativeID="phone-label">
        رقم الموبايل
      </Text>
      <TextInput
        accessibilityLabelledBy="phone-label"
        accessibilityLabel="رقم الموبايل"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (sent) setSent(false);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="01xxxxxxxxx"
        placeholderTextColor={colors.nightSubtle}
        style={[styles.input, styles.ltr]}
        editable={!busy}
      />

      {sent ? (
        <>
          <Text variant="label" tone="inverse" nativeID="code-label" style={styles.spaced}>
            الكود اللي وصلك على واتساب
          </Text>
          <TextInput
            accessibilityLabelledBy="code-label"
            accessibilityLabel="كود الدخول"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            placeholder="______"
            placeholderTextColor={colors.nightSubtle}
            style={[styles.input, styles.ltr, styles.code]}
            onSubmitEditing={() => codeOk && !busy && verify()}
            autoFocus
          />
        </>
      ) : null}

      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {sent ? (
        <>
          <Button label="دخول" onPress={verify} disabled={!codeOk || busy} loading={busy} style={styles.submit} />
          <Button label="ابعت الكود تاني" variant="ghost" onPress={send} disabled={busy} />
        </>
      ) : (
        <Button label="ابعت الكود" onPress={send} disabled={!phoneOk || busy} loading={busy} style={styles.submit} />
      )}
    </View>
  );
}

function EmailForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = emailLogin.safeParse({ email, password }).success && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <Text variant="label" tone="inverse" nativeID="email-label">
        البريد الإلكتروني
      </Text>
      <TextInput
        accessibilityLabelledBy="email-label"
        accessibilityLabel="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="example@email.com"
        placeholderTextColor={colors.nightSubtle}
        style={[styles.input, styles.ltr]}
      />

      <Text variant="label" tone="inverse" nativeID="password-label" style={styles.spaced}>
        كلمة المرور
      </Text>
      <TextInput
        accessibilityLabelledBy="password-label"
        accessibilityLabel="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        placeholderTextColor={colors.nightSubtle}
        style={styles.input}
        onSubmitEditing={() => canSubmit && submit()}
      />

      {error ? (
        <Text variant="caption" style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Button label="تسجيل الدخول" onPress={submit} disabled={!canSubmit} loading={busy} style={styles.submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  subtitle: { marginTop: spacing.sm, color: colors.nightText },
  switcher: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.night2,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget - 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: colors.jade },
  form: { gap: spacing.sm },
  spaced: { marginTop: spacing.lg },
  input: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.nightLine,
    backgroundColor: colors.night2,
    color: colors.inverse,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    writingDirection: "auto",
  },
  // Numbers and addresses read left to right inside the Arabic layout.
  ltr: { writingDirection: "ltr", textAlign: "left" },
  code: { letterSpacing: 8, fontSize: 20 },
  error: { color: "#FCA5A5", marginTop: spacing.sm },
  submit: { marginTop: spacing.xl },
});
