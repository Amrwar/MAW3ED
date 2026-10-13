import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Header, Icon, Screen, Text, colors, fonts, ltr, radius, spacing, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { SignInGate } from "@/features/auth/SignInGate";
import { useDeleteAccount, useRequestDeletionCode } from "@/features/account/queries";
import { clearTokens } from "@/features/auth/token-store";
import { ApiError, messageFor } from "@/lib/api/errors";
import { track } from "@/lib/analytics";

/**
 * Deleting the account.
 *
 * Said plainly before anything happens: what goes (the account, saved
 * places, notifications, devices) and what stays (bookings, reviews and
 * payments are the businesses' records). Then the same proof as signing
 * in — a code to the account's own phone — so an unlocked phone is not
 * one tap from erasing someone. The server decides who may delete
 * (owners and admins may not; lib/account/deletion.ts).
 */
export default function DeleteAccountScreen() {
  const { lang } = useLocale();
  return (
    <SignInGate title={lang === "ar" ? "حذف الحساب" : "Delete account"} reason={lang === "ar" ? "سجّل دخولك الأول." : "Sign in first."}>
      <Delete />
    </SignInGate>
  );
}

function Delete() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const { signOut } = useAuth();
  const request = useRequestDeletionCode();
  const remove = useDeleteAccount();
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const words = (e: unknown) => {
    const c = e instanceof ApiError ? e.code : undefined;
    if (ar) return messageFor(e);
    switch (c) {
      case "owns-business":
        return "This account owns a business. Contact support to close the business first.";
      case "admin":
        return "Admin accounts can't be deleted here.";
      case "no-phone":
        return "A verified phone number is needed to confirm it's you.";
      case "cooldown":
        return "Wait a minute before asking for another code.";
      case "too-many":
        return "Too many codes requested. Try again later.";
      case "wrong-code":
        return "That code is wrong or has expired.";
      default:
        return "Something went wrong. Please try again.";
    }
  };

  const send = async () => {
    setError(null);
    try {
      const res = await request.mutateAsync();
      setSentTo(res.phone);
    } catch (e) {
      setError(words(e));
    }
  };

  const confirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(code.trim());
      track("account_deleted");
      // The server already ended every session; clear this device too.
      await clearTokens();
      await signOut().catch(() => undefined);
      router.replace("/");
    } catch (e) {
      setError(words(e));
      setCode("");
    }
  };

  return (
    <Screen edges="both">
      <Header title={T("حذف الحساب", "Delete account")} back />
      <View style={styles.body}>
        <Card>
          <Text variant="label" tone="danger" accessibilityRole="header">
            {T("هيتشال نهائيًا", "Removed permanently")}
          </Text>
          <Line icon="close-circle-outline" tone="danger" text={T("حسابك، الأماكن المحفوظة، والإشعارات", "Your account, saved places and notifications")} />
          <Line icon="close-circle-outline" tone="danger" text={T("كل الأجهزة المتسجلة وإشعارات الموبايل", "Every signed-in device and push registration")} />
          <Text variant="label" tone="ink2" style={styles.gap} accessibilityRole="header">
            {T("هيفضل عند الأنشطة", "Stays with the businesses")}
          </Text>
          <Line icon="information-circle-outline" tone="info" text={T("الحجوزات والتقييمات والمدفوعات — دي سجلات المكان لمواعيد حصلت.", "Bookings, reviews and payments — the businesses' records of appointments that happened.")} />
          <Text variant="caption" tone="subtle" style={styles.gap}>
            {T(
              "لو سجّلت تاني بنفس الرقم بعدين، هيتعمل حساب جديد والحجوزات المسجلة على الرقم هتظهر فيه.",
              "If you sign up again later with the same number, a new account is created and bookings made under that number will show in it.",
            )}
          </Text>
        </Card>

        {!sentTo ? (
          <Button variant="danger" fullWidth label={T("ابعتلي كود التأكيد", "Send me a confirmation code")} loading={request.isPending} onPress={send} />
        ) : (
          <View style={styles.codeBox}>
            <Text variant="body" tone="ink2">
              {T(`بعتنا كود على واتساب لـ`, `We sent a code on WhatsApp to`)} <Text variant="bodyBold" style={ltr}>{sentTo}</Text>
            </Text>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              accessibilityLabel={T("كود التأكيد", "Confirmation code")}
              placeholder="••••••"
              style={[styles.code, ltr]}
            />
            <Button variant="danger" fullWidth label={T("احذف حسابي نهائيًا", "Delete my account permanently")} disabled={code.length < 4} loading={remove.isPending} onPress={confirm} />
            <Button variant="ghost" label={T("ابعت كود جديد", "Send a new code")} disabled={request.isPending} onPress={send} />
          </View>
        )}

        {error ? (
          <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Line({ icon, tone, text }: { icon: "close-circle-outline" | "information-circle-outline"; tone: "danger" | "info"; text: string }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size="sm" color={tone === "danger" ? colors.danger : colors.info} />
      <Text variant="body" tone="ink2" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, marginTop: spacing.md },
  gap: { marginTop: spacing.md },
  line: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  codeBox: { gap: spacing.md },
  code: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 24,
    letterSpacing: 8,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
});
