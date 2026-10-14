import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { getLocales } from "expo-localization";
import { Button, Tabs, Text, TextField, colors, spacing, useLocale } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { AuthShell, LegalNote, finishSignIn, openSite } from "@/features/auth/AuthShell";
import { PhoneField } from "@/features/auth/PhoneField";
import { countryByIso, EGYPT, type Country } from "@/features/auth/countries";
import { emailLogin, readPhone } from "@/features/auth/validation";
import { messageFor } from "@/lib/api/errors";

/**
 * Signing in — and signing up, which for a customer is the same thing.
 *
 * Two kinds of account, two ways in. Customers prove a phone number with
 * a code: the first time a number is confirmed, the account is created
 * (the server does it, as on the website), so there is no separate
 * sign-up form to fill before booking. Any country's number works.
 * Owners and staff sign in with email and password; creating a business
 * and resetting a password happen on the website, which has the full
 * forms for them.
 *
 * The code is entered on its own screen (verify.tsx), and a new
 * customer is asked their name after it (profile.tsx).
 */

type Mode = "customer" | "business";

/** The device's country if we list it, else Egypt — the product's home. */
function initialCountry(): Country {
  try {
    return countryByIso(getLocales()[0]?.regionCode) ?? EGYPT;
  } catch {
    return EGYPT;
  }
}

export default function Login() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [mode, setMode] = useState<Mode>("customer");

  return (
    <AuthShell
      title={mode === "customer" ? (ar ? "أهلًا بيك في مواعيد" : "Welcome to Maw3ed") : ar ? "دخول أصحاب الأعمال" : "Business sign-in"}
      subtitle={
        mode === "customer"
          ? ar
            ? "احجز مواعيدك في ثواني. ادخل أو اعمل حساب برقم موبايلك."
            : "Book appointments in seconds. Sign in or sign up with your phone number."
          : ar
            ? "أدِر مواعيدك وعملاءك من مكان واحد."
            : "Manage your bookings and customers in one place."
      }
      footer={<LegalNote />}
    >
      <Tabs
        options={[
          { value: "customer", label: ar ? "عميل" : "Customer" },
          { value: "business", label: ar ? "صاحب نشاط" : "Business" },
        ]}
        value={mode}
        onChange={setMode}
        testIDPrefix="login-tab"
      />
      {mode === "customer" ? <PhoneStep /> : <BusinessForm />}
    </AuthShell>
  );
}

function PhoneStep() {
  const { requestCode } = useAuth();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [country, setCountry] = useState<Country>(initialCountry);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = readPhone(phone, country);

  async function send() {
    if (!parsed.e164 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestCode(parsed.e164);
      router.push({ pathname: "/(auth)/verify", params: { phone: parsed.e164 } });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PhoneField
        label={ar ? "رقم الموبايل" : "Mobile number"}
        value={phone}
        onChangeText={(v) => {
          setPhone(v);
          setError(null);
          // A number pasted with its own code picks its country.
          const r = readPhone(v, country);
          if (r.country.iso !== country.iso) setCountry(r.country);
        }}
        country={country}
        onCountryChange={setCountry}
        editable={!busy}
        error={error}
        hint={ar ? "هنبعتلك كود تأكيد على واتساب." : "We'll send a confirmation code on WhatsApp."}
        onSubmitEditing={send}
        testID="login-phone"
      />
      <Button
        label={ar ? "ابعت الكود" : "Send code"}
        onPress={send}
        disabled={!parsed.e164 || busy}
        loading={busy}
        fullWidth
        testID="login-submit"
      />
      <Text variant="caption" tone="subtle" align="center">
        {ar
          ? "أول مرة؟ هنعملك حساب تلقائيًا بعد ما تأكد رقمك."
          : "New here? Your account is created as soon as you confirm your number."}
      </Text>
    </>
  );
}

function BusinessForm() {
  const { signIn } = useAuth();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = emailLogin.safeParse({ email, password }).success && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      finishSignIn();
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TextField
        label={ar ? "البريد الإلكتروني" : "Email"}
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
        testID="login-email"
      />
      <View style={styles.passwordBlock}>
        <TextField
          label={ar ? "كلمة المرور" : "Password"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          icon="lock-closed-outline"
          editable={!busy}
          error={error}
          onSubmitEditing={submit}
          testID="login-password"
        />
        <Text
          variant="label"
          tone="jade"
          accessibilityRole="link"
          onPress={() => openSite("/forgot-password")}
          style={styles.forgot}
        >
          {ar ? "نسيت كلمة المرور؟" : "Forgot password?"}
        </Text>
      </View>
      <Button
        label={ar ? "تسجيل الدخول" : "Sign in"}
        onPress={submit}
        disabled={!canSubmit}
        loading={busy}
        fullWidth
        testID="login-submit"
      />

      <View style={styles.or}>
        <View style={styles.rule} />
        <Text variant="caption" tone="subtle">
          {ar ? "معندكش حساب؟" : "No account yet?"}
        </Text>
        <View style={styles.rule} />
      </View>
      <Button
        label={ar ? "سجّل نشاطك على مواعيد" : "Create a business account"}
        variant="outline"
        icon="open-outline"
        iconPosition="end"
        onPress={() => openSite("/signup")}
        fullWidth
      />
      {/* Staff have no email login: the owner gives them access by phone. */}
      <Text variant="caption" tone="subtle" align="center">
        {ar
          ? "في فريق نشاط؟ سجّل دخول برقم موبايلك من تبويب «عميل» — نفس الرقم اللي صاحب النشاط ضافه."
          : "On a business's team? Sign in with your phone on the Customer tab — the number the owner added."}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  passwordBlock: { gap: spacing.sm },
  forgot: { alignSelf: "flex-end", paddingVertical: spacing.xs },
  or: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
});
