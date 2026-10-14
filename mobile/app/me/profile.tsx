import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Header, ListState, Screen, Text, TextField, ltr, spacing, useLocale, useToast } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { SignInGate } from "@/features/auth/SignInGate";
import { useProfile, useUpdateProfile } from "@/features/customer/queries";
import { messageFor } from "@/lib/api/errors";

/**
 * Your details: name and email. The phone is shown but cannot be edited
 * here — it is the key every booking is found by (see the PATCH route),
 * so changing it would quietly detach a customer's history.
 */
export default function ProfileScreen() {
  const { lang } = useLocale();
  return (
    <SignInGate title={lang === "ar" ? "بياناتك" : "Your details"} reason={lang === "ar" ? "عشان تعدّل بياناتك." : "To edit your details."}>
      <EditProfile />
    </SignInGate>
  );
}

function EditProfile() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const profile = useProfile();
  const update = useUpdateProfile();
  const { updateUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = profile.data;
  const n = name ?? data?.name ?? "";
  const e = email ?? data?.email ?? "";
  const nameOk = n.trim().length >= 2;
  const emailOk = e.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const save = async () => {
    if (!nameOk || !emailOk) return;
    setError(null);
    try {
      const patch = { name: n.trim(), email: e.trim() };
      await update.mutateAsync(patch);
      updateUser({ name: patch.name, email: patch.email || null });
      toast({ message: T("اتحفظ", "Saved"), tone: "ok" });
      router.back();
    } catch (err) {
      setError(ar ? messageFor(err) : "We couldn't save that. If the email is used by another account, try a different one.");
    }
  };

  return (
    <Screen
      edges="both"
      footer={<Button fullWidth label={T("احفظ", "Save")} disabled={!nameOk || !emailOk || !data} loading={update.isPending} onPress={save} />}
      hero={<Header title={T("بياناتك", "Your details")} back tone="night" />}
    >
      <ListState loading={profile.isLoading} error={profile.error} isEmpty={false} emptyTitle="" onRetry={() => profile.refetch()}>
        <View style={styles.form}>
          <TextField
            label={T("الاسم", "Name")}
            required
            value={n}
            onChangeText={setName}
            autoComplete="name"
            error={!nameOk && n.length > 0 ? T("حرفين على الأقل", "At least 2 letters") : null}
          />
          <TextField
            label={T("الإيميل (اختياري)", "Email (optional)")}
            value={e}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            ltr
            error={!emailOk ? T("الإيميل مش مظبوط", "That email doesn't look right") : null}
          />
          <Card tone="tint">
            <Text variant="label" tone="ink2">
              {T("رقم الموبايل", "Phone number")}
            </Text>
            <Text variant="bodyBold" style={ltr}>
              {data?.phone ? `+${data.phone.replace(/^\+/, "")}` : "—"}
            </Text>
            <Text variant="caption" tone="subtle">
              {T(
                "الرقم ده هو اللي حجوزاتك متسجلة عليه، فمبيتغيرش من هنا. لو غيّرت رقمك، كلّم الدعم.",
                "Your bookings are registered under this number, so it can't be changed here. If your number changes, contact support.",
              )}
            </Text>
          </Card>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </ListState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg, marginTop: spacing.md },
});
