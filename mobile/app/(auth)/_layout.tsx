import { Stack } from "expo-router";
import { colors } from "@/design/tokens";

/**
 * Signing in. Presented as a stack rather than a tab, because it is a
 * task somebody finishes and leaves, not a place they return to.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.night },
      }}
    />
  );
}
