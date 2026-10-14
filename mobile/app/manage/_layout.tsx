import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { colors } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { useSignedInGuard } from "@/features/auth/useSignedInGuard";

/**
 * The business's own screens — a booking, a customer, the team, reports.
 *
 * Reachable from links too (a notification about a booking opens
 * /manage/booking/<id>), so the door is checked here, not only by the
 * tab bar that normally leads in. Signed out: sign in, then come back to
 * the same screen. Signed in but working for no business: home. The
 * server checks every request again regardless, so a link can never
 * show anybody a business they do not work for.
 */
export default function ManageLayout() {
  const { user } = useAuth();
  const door = useSignedInGuard();

  if (door === "left") return <Redirect href="/" />;
  if (door === "wait" || !user) {
    return (
      <View style={styles.wait}>
        <ActivityIndicator color={colors.jade} />
      </View>
    );
  }
  if (!user.businessId && !user.staff) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }} />;
}

const styles = StyleSheet.create({
  wait: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ground },
});
