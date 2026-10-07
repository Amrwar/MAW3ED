import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/stores/auth";
import { colors } from "@/constants/theme";

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
export default function Index() {
  const { restoring, role, user } = useAuth();

  useEffect(() => {
    if (restoring) return;
    if (!user) {
      router.replace("/(customer)");
      return;
    }
    router.replace(role === "business" ? "/(business)" : "/(customer)");
  }, [restoring, role, user]);

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
