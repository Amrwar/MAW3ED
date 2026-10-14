import type { ReactNode } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";
import { router, type Href } from "expo-router";
import { IconButton, Screen, Text, Touchable, colors, elevation, radius, spacing, useLocale } from "@/design";
import { config } from "@/lib/config";

/**
 * The frame every sign-in step shares: the wordmark on night, a title,
 * and the form on a white card beneath — so phone, code and profile read
 * as one flow rather than three unrelated screens.
 *
 * The language switch lives here because this is the first screen a new
 * person sees, before there is an account page to find it on.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  onBack,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Shows a back button; omitted on the first step. */
  onBack?: () => void;
}) {
  const { lang, setLang } = useLocale();

  return (
    <Screen dark edges="both">
      <View style={styles.top}>
        {onBack ? (
          <IconButton icon="chevron-back" label={lang === "ar" ? "رجوع" : "Back"} onPress={onBack} variant="night" testID="back" />
        ) : (
          <View />
        )}
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={lang === "ar" ? "Switch to English" : "التحويل للعربية"}
          onPress={() => setLang(lang === "ar" ? "en" : "ar")}
          style={styles.lang}
          testID="lang-toggle"
        >
          <Text variant="label" tone="inverse">
            {lang === "ar" ? "English" : "العربية"}
          </Text>
        </Touchable>
      </View>

      <View style={styles.brand}>
        <Image
          source={require("@/assets/logo-white.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel={lang === "ar" ? "موعد" : "Maw3ed"}
        />
      </View>

      <View style={styles.header}>
        <Text variant="title" tone="inverse" accessibilityRole="header">
          {title}
        </Text>
        {typeof subtitle === "string" ? (
          <Text variant="body" tone="inverseMuted">
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>

      <View style={styles.card}>{children}</View>

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Screen>
  );
}

/** A page of the website, for what the app sends people there to do. */
export function openSite(path: string) {
  Linking.openURL(`${config.apiUrl}${path}`).catch(() => undefined);
}

/** "By continuing you agree to the Terms and Privacy Policy", with both linked. */
export function LegalNote() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <Text variant="caption" tone="inverseMuted" align="center" testID="legal-note">
      {ar ? "بالمتابعة، إنت موافق على " : "By continuing you agree to the "}
      <Text variant="caption" tone="inverse" onPress={() => openSite("/terms")} accessibilityRole="link" testID="terms-link">
        {ar ? "الشروط والأحكام" : "Terms & Conditions"}
      </Text>
      {ar ? " و" : " and "}
      <Text variant="caption" tone="inverse" onPress={() => openSite("/privacy")} accessibilityRole="link" testID="privacy-link">
        {ar ? "سياسة الخصوصية" : "Privacy policy"}
      </Text>
      .
    </Text>
  );
}

/**
 * Where to go back to once signed in, when sign-in interrupted something
 * — a booking half made, a place being saved. Held in memory, not in a
 * route param, so it never appears in a URL and dies with the app.
 */
let returnTo: string | null = null;

/**
 * Open sign-in. With a path, come back to it afterwards; without one,
 * go home. Every way into sign-in goes through here, so a return path
 * left over from an abandoned attempt can never redirect a later one.
 */
export function startSignIn(path?: string) {
  // Our own screens only: a path, never a host.
  returnTo = path && path.startsWith("/") && !path.startsWith("//") ? path : null;
  router.push("/(auth)/login");
}

/** Sign in, then come back here rather than to the home screen. */
export function signInThenReturn(path: string) {
  startSignIn(path);
}

/**
 * Leaves sign-in: back to what it interrupted, or else the home screen
 * of the person's space. dismissTo pops the sign-in screens off the
 * stack, so Back afterwards does not lead into them again.
 */
export function finishSignIn() {
  const target = returnTo;
  returnTo = null;
  if (target) router.dismissTo(target as Href);
  else router.replace("/");
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  lang: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.nightLine,
  },
  brand: { alignItems: "center", marginTop: spacing.lg },
  logo: { width: 150, height: 67 },
  header: { marginTop: spacing.xl, marginBottom: spacing.lg, gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...elevation.float,
  },
  footer: { marginTop: spacing.xl, gap: spacing.md, alignItems: "center" },
});
