import { useState } from "react";
import { Button, Text, TextField, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthShell, finishSignIn } from "@/features/auth/AuthShell";
import { api } from "@/lib/api/client";
import { messageFor } from "@/lib/api/errors";

/**
 * The last step for a new customer: a name, so a business knows who is
 * coming, and an email if they want reminders there too.
 *
 * Asked once, after the number is confirmed — the account already
 * exists by then, so leaving now loses nothing. "Later" skips it; the
 * name can be added from the account tab whenever.
 */
export default function Profile() {
  const { updateUser } = useAuth();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 2;
  const emailOk = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function save() {
    if (!nameOk || !emailOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const patch = { name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}) };
      await api.patch("/api/account/profile", patch);
      updateUser(patch);
      finishSignIn();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={ar ? "خلّينا نتعرّف عليك" : "Tell us about you"}
      subtitle={
        ar
          ? "تم تأكيد رقمك وحسابك جاهز. اسمك بيظهر للنشاط اللي بتحجز عنده."
          : "Your number is confirmed and your account is ready. Businesses see your name when you book."
      }
    >
      <TextField
        label={ar ? "الاسم" : "Full name"}
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        icon="person-outline"
        required
        editable={!busy}
        autoFocus
      />
      <TextField
        label={ar ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}
        hint={ar ? "لتأكيدات الحجز والتذكيرات." : "For booking confirmations and reminders."}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="name@example.com"
        icon="mail-outline"
        ltr
        editable={!busy}
        error={!emailOk && email.length > 3 ? (ar ? "البريد الإلكتروني غير صحيح" : "That email doesn't look right") : error}
        onSubmitEditing={save}
      />
      <Button
        label={ar ? "ابدأ" : "Get started"}
        onPress={save}
        disabled={!nameOk || !emailOk || busy}
        loading={busy}
        fullWidth
      />
      <Button label={ar ? "بعدين" : "Later"} variant="ghost" onPress={finishSignIn} disabled={busy} fullWidth />
      <Text variant="caption" tone="subtle" align="center">
        {ar ? "تقدر تعدّل بياناتك في أي وقت من صفحة حسابك." : "You can change these any time from your account."}
      </Text>
    </AuthShell>
  );
}
