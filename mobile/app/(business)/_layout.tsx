import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import { useAuth } from "@/stores/auth";
import { colors, typography, touchTarget } from "@/constants/theme";

/**
 * The owner's space.
 *
 * Guarded here rather than per screen: a person with no business has
 * nothing to show in any of these tabs, so the whole group redirects.
 * The server checks the same thing on every request — this only saves
 * somebody from looking at five empty screens.
 *
 * Which tabs: the things an owner does standing up, away from a desk.
 * Today's schedule, the calendar, bookings, customers. Services, staff
 * and settings are configuration — occasional, fiddly, better on the
 * web — so they sit inside Account rather than taking a tab each.
 */
export default function BusinessLayout() {
  const { user, restoring } = useAuth();

  if (restoring) return null;
  if (!user?.businessId) return <Redirect href="/(customer)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.jade,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: touchTarget + 28,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: typography.tiny.fontSize,
          fontWeight: typography.tiny.fontWeight,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "اليوم" }} />
      <Tabs.Screen name="calendar" options={{ title: "التقويم" }} />
      <Tabs.Screen name="bookings" options={{ title: "الحجوزات" }} />
      <Tabs.Screen name="customers" options={{ title: "العملاء" }} />
      <Tabs.Screen name="account" options={{ title: "حسابي" }} />
    </Tabs>
  );
}
