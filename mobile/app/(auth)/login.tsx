import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Screen, Tabs, Text, TextField, spacing } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { egyptianMobile, emailLogin, loginCode } from "@/features/auth/validation";
import { messageFor } from "@/lib/api/errors";

/**
 * Signing in.
 *
 * Two ways, because the platform has two kinds of account: customers
 * sign in with a code sent to their phone, as on the website; owners
 * and staff with email and password. Phone first — most people opening
 * the app are customers.
 *
 * It opens on night — Deep Anchor's colour — as the app's front door.
 * The error shown is the server's own message, written in Arabic for a
 * person.
 */

type Mode = "phone" | "email";

const MODES = [
  { value: "phone", label: "رقم الموبايل" },
  { value: "email", label: "أصحاب الأعمال" },
] as const;

export default function Login() {
  const [mode, setMode] = useState<Mode>("phone");

  return (
    <Screen dark edges="both">
      <View style={styles.header}>
        <Text variant="display" tone="inverse" accessibilityRole="header">
          أهلًا بيك
        </Text>
        <Text variant="body" tone="inverseMuted">
          سجّل دخولك عشان تشوف حجوزاتك وتدير نشاطك.
        </Text>
      </View>

      <Tabs options={MODES} value={mode} onChange={setMode} tone="night" />

      <View style={styles.form}>{mode === "phone" ? <PhoneForm /> : <EmailForm />}</View>
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
    <>
      <TextField
        tone="night"
        label="رقم الموبايل"
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          if (sent) setSent(false);
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="01xxxxxxxxx"
        ltr
        editable={!busy}
        error={sent ? null : error}
      />

      {sent ? (
        <TextField
          tone="night"
          label="الكود اللي وصلك على واتساب"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          placeholder="______"
          ltr
          autoFocus
          error={error}
          onSubmitEditing={() => codeOk && !busy && verify()}
        />
      ) : null}

      {sent ? (
        <>
          <Button label="دخول" onPress={verify} disabled={!codeOk || busy} loading={busy} fullWidth />
          <Button label="ابعت الكود تاني" variant="ghost" onPress={send} disabled={busy} fullWidth />
        </>
      ) : (
        <Button label="ابعت الكود" onPress={send} disabled={!phoneOk || busy} loading={busy} fullWidth />
      )}
    </>
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
    <>
      <TextField
        tone="night"
        label="البريد الإلكتروني"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="example@email.com"
        ltr
      />
      <TextField
        tone="night"
        label="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={error}
        onSubmitEditing={() => canSubmit && submit()}
      />
      <Button label="تسجيل الدخول" onPress={submit} disabled={!canSubmit} loading={busy} fullWidth />
    </>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl, gap: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.xl },
});
