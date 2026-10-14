import type { ReactNode } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import { Screen, Text, Button, EmptyState, colors, spacing, useLocale } from "@/design";
import { useAuth } from "./AuthProvider";
import { signInThenReturn } from "./AuthShell";

/**
 * For the screens that only mean something to a signed-in person —
 * bookings, saved places, notifications, the account.
 *
 * Browsing needs no account, so a signed-out person can open these tabs;
 * what they get is a way in, not a screen of requests answering 401.
 * The children are not mounted until somebody is signed in, so their
 * queries never run anonymously.
 */
export function SignInGate({
  title,
  reason,
  children,
}: {
  title: string;
  /** Why signing in is worth it here, in a sentence. */
  reason: string;
  children: ReactNode;
}) {
  const { user, restoring } = useAuth();
  const { lang } = useLocale();
  const pathname = usePathname();

  if (restoring) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.jade} />
      </View>
    );
  }

  if (user) return <>{children}</>;

  return (
    <Screen
      hero={
        <Text variant="display" tone="inverse" accessibilityRole="header">
          {title}
        </Text>
      }
    >
      <View style={styles.body}>
        <EmptyState
          title={lang === "ar" ? "سجّل دخولك الأول" : "Sign in first"}
          body={reason}
          action={<Button label={lang === "ar" ? "تسجيل الدخول" : "Sign in"} onPress={() => signInThenReturn(pathname)} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ground },
  body: { marginTop: spacing.xxl },
});
