import type { ReactNode } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";
import { router } from "expo-router";
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
          <IconButton icon="chevron-back" label={lang === "ar" ? "رجوع" : "Back"} onPress={onBack} variant="night" />
        ) : (
          <View />
        )}
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={lang === "ar" ? "Switch to English" : "التحويل للعربية"}
          onPress={() => setLang(lang === "ar" ? "en" : "ar")}
          style={styles.lang}
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
          accessibilityLabel={lang === "ar" ? "مواعيد" : "Maw3ed"}
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
    <Text variant="caption" tone="inverseMuted" align="center">
      {ar ? "بالمتابعة إنت موافق على " : "By continuing you agree to the "}
      <Text variant="caption" tone="inverse" onPress={() => openSite("/terms")} accessibilityRole="link">
        {ar ? "الشروط والأحكام" : "Terms"}
      </Text>
      {ar ? " و" : " and "}
      <Text variant="caption" tone="inverse" onPress={() => openSite("/privacy")} accessibilityRole="link">
        {ar ? "سياسة الخصوصية" : "Privacy Policy"}
      </Text>
      .
    </Text>
  );
}

/** Leaves sign-in for wherever the app opens — the home screen of the person's space. */
export function finishSignIn() {
  router.replace("/");
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
