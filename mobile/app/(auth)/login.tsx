import { useState } from "react";
import { View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/stores/auth";
import { messageFor } from "@/lib/api/errors";
import { colors, radius, spacing, touchTarget } from "@/constants/theme";

/**
 * Signing in.
 *
 * The one screen built in full this phase, because it is what proves
 * the foundation: secure storage, the token pair, the API client, and
 * the redirect that follows from a role. Everything else can be a stub;
 * this cannot, or nothing underneath it has been exercised.
 *
 * The error shown is the server's own message. It is written in Arabic
 * for a person, and replacing it with something of our own would be
 * both more work and less accurate.
 */
export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0 && !busy;

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
    <Screen dark>
      <View style={styles.header}>
        <Text variant="display" tone="inverse">
          أهلًا بيك
        </Text>
        <Text variant="body" tone="inverse" style={styles.subtitle}>
          سجّل دخولك عشان تشوف حجوزاتك وتدير نشاطك.
        </Text>
      </View>

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
          style={styles.input}
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

        <Button
          label="تسجيل الدخول"
          onPress={submit}
          disabled={!canSubmit}
          loading={busy}
          style={styles.submit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xxl },
  subtitle: { marginTop: spacing.sm, color: colors.nightText },
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
  error: { color: "#FCA5A5", marginTop: spacing.sm },
  submit: { marginTop: spacing.xl },
});
