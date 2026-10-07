import { useEffect } from "react";
import { I18nManager } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Localization from "expo-localization";
import { AuthProvider } from "@/stores/auth";
import { createQueryClient } from "@/lib/query/client";
import { colors } from "@/constants/theme";

/**
 * The root of the app.
 *
 * Providers only: auth, server state and safe areas. No screen, so
 * nothing here re-renders when a route changes.
 *
 * Note on right-to-left. React Native decides layout direction at
 * startup and cannot flip it live — I18nManager.forceRTL takes effect
 * on the NEXT launch. So the app reads the device's locale and sets the
 * flag; a device already in Arabic is correct on first run, and one
 * switched to Arabic afterwards is correct from the next launch. A
 * language toggle inside the app would need a restart prompt, which is
 * why there is not one here.
 */

const queryClient = createQueryClient();

export default function RootLayout() {
  useEffect(() => {
    const locale = Localization.getLocales()[0];
    const wantsRtl = locale?.textDirection === "rtl" || locale?.languageCode === "ar";
    if (wantsRtl !== I18nManager.isRTL) {
      I18nManager.allowRTL(wantsRtl);
      I18nManager.forceRTL(wantsRtl);
    }
  }, []);

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
