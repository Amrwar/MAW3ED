import { useCallback } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { colors } from "@/design/tokens";

/**
 * The gate.
 *
 * Decides which space a person lands in and sends them there. It waits
 * for `restoring` first: redirecting before the stored session has been
 * read shows the login screen to people who are already signed in.
 *
 * Browsing does not require an account, so somebody signed out lands in
 * the customer space rather than at a login wall. Signing in is asked
 * for at the point it is actually needed — booking, favourites — which
 * is the pattern the web already follows.
 */
const SPACE = { admin: "/(admin)", business: "/(business)", customer: "/(customer)" } as const;

export default function Index() {
  const { restoring, role, user } = useAuth();

  // Only while this screen is the one showing. It sits at the bottom of
  // the stack under any deep-linked screen — a cold start on
  // /booking/<token> or a tab's URL mounts it too — and an unconditional
  // effect replaced that screen with the home tab.
  useFocusEffect(
    useCallback(() => {
      if (restoring) return;
      router.replace(user ? SPACE[role] : "/(customer)");
    }, [restoring, role, user]),
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.jade} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.night,
  },
});
