import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text, Touchable, colors, fonts, radius, spacing, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthShell, finishSignIn } from "@/features/auth/AuthShell";
import { loginCode } from "@/features/auth/validation";
import { isolateLtr } from "@/features/auth/countries";
import { messageFor } from "@/lib/api/errors";

/**
 * Step two: the six-digit code sent to the number.
 *
 * It submits itself on the sixth digit — typed, pasted or filled in by
 * the keyboard from the message. Resending waits out the same minute the
 * server enforces, so the button is never offered only to be refused.
 * A new account (no name yet) goes on to profile.tsx.
 */

const LENGTH = 6;
const RESEND_AFTER = 60;

export default function Verify() {
  const { phone } = useLocalSearchParams<{ phone?: string }>();
  const { requestCode, signInWithCode } = useAuth();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const input = useRef<TextInput>(null);
  // State is a render behind: a code filled in twice by the keyboard, or
  // the sixth digit and a tap on Confirm, would otherwise both send.
  const inFlight = useRef(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_AFTER);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  // Reached without a number — a stale link or a reload: start again.
  useEffect(() => {
    if (!phone) router.replace("/(auth)/login");
  }, [phone]);

  async function verify(value: string) {
    if (!phone || inFlight.current || !loginCode.safeParse(value).success) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const user = await signInWithCode(phone, value);
      if (!user.name) router.replace("/(auth)/profile");
      else finishSignIn();
    } catch (e) {
      setError(messageFor(e));
      setCode("");
      setBusy(false);
      // After the field is editable again, or the keyboard stays shut.
      setTimeout(() => input.current?.focus(), 0);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (!phone || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await requestCode(phone);
      setLeft(RESEND_AFTER);
      setCode("");
      setNotice(ar ? "بعتنالك كود جديد." : "We sent you a new code.");
    } catch (e) {
      setError(messageFor(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const display = phone ?? "";
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <AuthShell
      title={ar ? "اكتب كود التأكيد" : "Enter your code"}
      subtitle={
        <Text variant="body" tone="inverseMuted">
          {ar ? "بعتنا كود من 6 أرقام على واتساب لـ " : "We sent a 6-digit code on WhatsApp to "}
          <Text variant="bodyBold" tone="inverse" style={styles.number}>
            {isolateLtr(display)}
          </Text>
        </Text>
      }
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
    >
      <Touchable
        accessibilityRole="none"
        accessible={false}
        onPress={() => input.current?.focus()}
        style={styles.cellsWrap}
      >
        <View style={styles.cells} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: LENGTH }, (_, i) => {
            const char = code[i] ?? "";
            const active = focused && i === Math.min(code.length, LENGTH - 1);
            return (
              <View
                key={i}
                style={[
                  styles.cell,
                  char ? styles.cellFilled : null,
                  active ? styles.cellActive : null,
                  error ? styles.cellError : null,
                ]}
              >
                <Text variant="title">{char}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, LENGTH);
            setCode(digits);
            setError(null);
            if (digits.length === LENGTH) verify(digits);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={LENGTH + 2}
          autoFocus
          editable={!busy}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={ar ? "كود التأكيد، 6 أرقام" : "Confirmation code, 6 digits"}
          caretHidden
          style={styles.hiddenInput}
        />
      </Touchable>

      {error ? (
        <Text variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite" align="center">
          {error}
        </Text>
      ) : notice ? (
        <Text variant="caption" tone="ok" accessibilityLiveRegion="polite" align="center">
          {notice}
        </Text>
      ) : null}

      <Button
        label={ar ? "تأكيد" : "Confirm"}
        onPress={() => verify(code)}
        disabled={code.length !== LENGTH || busy}
        loading={busy}
        fullWidth
      />

      {left > 0 ? (
        <Text variant="caption" tone="subtle" align="center" accessibilityLiveRegion="none">
          {ar ? `تقدر تطلب كود جديد بعد ${mm}:${ss}` : `You can request a new code in ${mm}:${ss}`}
        </Text>
      ) : (
        <Button label={ar ? "ابعت الكود تاني" : "Resend code"} variant="ghost" onPress={resend} disabled={busy} fullWidth />
      )}

      <Button
        label={ar ? "تغيير الرقم" : "Change number"}
        variant="ghost"
        icon="create-outline"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        disabled={busy}
        fullWidth
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  number: { direction: "ltr" },
  cellsWrap: { position: "relative" },
  // Digits fill left to right, as a code is read in any language.
  cells: { direction: "ltr", flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  cell: {
    flex: 1,
    maxWidth: 52,
    aspectRatio: 0.85,
    borderWidth: 1.5,
    borderColor: colors.line2,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellFilled: { backgroundColor: colors.surface, borderColor: colors.ink2 },
  cellActive: { borderColor: colors.jade, borderWidth: 2 },
  cellError: { borderColor: colors.danger },
  hiddenInput: {
    position: "absolute",
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    opacity: 0.01,
    color: colors.surface,
    fontFamily: fonts.regular,
  },
});
