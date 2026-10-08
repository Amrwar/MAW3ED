import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/stores/auth";
import { createQueryClient } from "@/lib/query/client";
import { colors } from "@/constants/theme";

/**
 * The root of the app.
 *
 * Providers only: auth, server state and safe areas. No screen, so
 * nothing here re-renders when a route changes.
 *
 * Right-to-left is NOT set here any more. It is configured natively in
 * app.config.ts, through expo-localization's forcesRTL, because
 * I18nManager.forceRTL only takes effect on the next launch — so the
 * first run after install laid out left-to-right with Arabic text in
 * it. Setting it in the build means the first frame is already
 * correct, and it no longer depends on the phone's language: the copy
 * is Arabic regardless, so the direction should be too.
 */

const queryClient = createQueryClient();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.ground },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(business)" />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
