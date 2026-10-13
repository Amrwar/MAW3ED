import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Stack, router, usePathname, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Almarai_300Light,
  Almarai_400Regular,
  Almarai_700Bold,
  Almarai_800ExtraBold,
} from "@expo-google-fonts/almarai";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { bookingTokenFor, configureForegroundHandling, targetOf, watchTokenChanges } from "@/features/notifications/push";
import { createQueryClient } from "@/lib/query/client";
import { keys } from "@/lib/query/keys";
import { hrefFor } from "@/lib/links";
import { screen, track } from "@/lib/analytics";
import { Text, Button, LocaleProvider, ToastProvider, colors, spacing } from "@/design";

/**
 * The root of the app.
 *
 * Providers, and the few things that must happen exactly once for the
 * whole app: how a notification is shown while the app is open, where a
 * tapped notification goes, and which screen analytics is told about.
 *
 * Direction is set twice, on purpose. Natively, in app.config.ts
 * (expo-localization's forcesRTL), so the first frame after install is
 * already right-to-left — I18nManager.forceRTL only takes effect on the
 * next launch. And by LocaleProvider, which sets `direction` on the root
 * view from the chosen language, so English lays out left-to-right
 * without a restart. See design/locale.tsx.
 *
 * The splash stays up until Almarai has loaded, so no screen is ever
 * drawn in the system font and then redrawn.
 */

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = createQueryClient();
if (Platform.OS !== "web") configureForegroundHandling();

export default function RootLayout() {
  useScreenTracking();
  const [fontsLoaded, fontError] = useFonts({
    Almarai_300Light,
    Almarai_400Regular,
    Almarai_700Bold,
    Almarai_800ExtraBold,
  });
  // A font that fails to load is not a reason to show nothing: the
  // system font is an acceptable fallback, a blank app is not.
  const ready = fontsLoaded || Boolean(fontError);
  useNotificationRouting(ready);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ToastProvider>
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
                <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
                <Stack.Screen name="(customer)" />
                <Stack.Screen name="(business)" />
                <Stack.Screen name="(admin)" />
                {/* Above the tabs, so Back returns to the tab as it was left. */}
                <Stack.Screen name="business/[slug]/index" />
                <Stack.Screen name="business/[slug]/reviews" />
                {/* The steps walk back with the header's back button; a stray
                    swipe must not drop somebody out of a half-made booking. */}
                <Stack.Screen name="book/[slug]" options={{ gestureEnabled: false }} />
                <Stack.Screen name="booking/[token]/index" />
                <Stack.Screen name="booking/[token]/reschedule" />
                <Stack.Screen name="booking/[token]/review" />
                <Stack.Screen name="me/profile" />
                <Stack.Screen name="me/reviews" />
                <Stack.Screen name="me/payments" />
                <Stack.Screen name="me/security" />
                <Stack.Screen name="me/delete" />
                <Stack.Screen name="dev/design-system" />
              </Stack>
            </AuthProvider>
          </QueryClientProvider>
        </ToastProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function useScreenTracking() {
  const pathname = usePathname();
  useEffect(() => {
    screen(pathname);
  }, [pathname]);
}

/**
 * A tapped notification opens where its link points — the website path
 * the server attached, translated by the same table as any maw3ed.net
 * link. Covers both a tap while the app runs (the listener) and the tap
 * that launched a closed app (the last response, read once).
 *
 * Native only: expo-notifications has no web implementation of either,
 * and calling it there threw from the root of the app.
 */
function useNotificationRouting(ready: boolean) {
  useEffect(() => {
    // Not before the navigator exists: routing then throws.
    if (!ready || Platform.OS === "web") return;

    // Each tap handled once: the launch response is read again on every
    // mount, and a notification that opened the app must not re-open its
    // screen the next time the root remounts.
    const handled = new Set<string>();

    const open = async (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);

      const target = targetOf(response);
      track("notification_opened", { source: "push", booking: Boolean(target.bookingId) });
      // A customer's booking: its id travels in the push, its token does
      // not — fetched over the signed-in connection, only if it is theirs.
      if (target.bookingId) {
        const token = await bookingTokenFor(target.bookingId);
        if (token) {
          router.navigate({ pathname: "/booking/[token]", params: { token } });
          return;
        }
      }
      if (target.path) router.navigate(hrefFor(target.path));
    };

    Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => undefined);
    const tapped = Notifications.addNotificationResponseReceivedListener((r) => void open(r));

    // A push arriving while the app is open means something changed: the
    // feed, the bookings and the booking itself are refetched.
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: keys.notifications.all });
      void queryClient.invalidateQueries({ queryKey: keys.myBookings.all });
      void queryClient.invalidateQueries({ queryKey: keys.booking.all });
    });

    const stopWatching = watchTokenChanges();
    return () => {
      tapped.remove();
      received.remove();
      stopWatching();
    };
  }, [ready]);
}

/**
 * What a crash in any screen shows instead of a white screen. Expo
 * Router renders this for an error thrown while rendering a route; the
 * person can try again, and the error is reported once.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    track("render_error", { message: error.message.slice(0, 120) });
  }, [error]);

  return (
    <View style={styles.crash}>
      <Text variant="heading" style={styles.center}>
        حصل خطأ غير متوقع
      </Text>
      <Text variant="body" tone="subtle" style={styles.center}>
        جرّب تاني. لو المشكلة فضلت، اقفل التطبيق وافتحه من جديد.
      </Text>
      <Button label="حاول تاني" onPress={retry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.ground,
  },
  center: { textAlign: "center" },
  retry: { marginTop: spacing.lg, alignSelf: "stretch" },
});
