import { Tabs } from "expo-router";
import { colors, typography, touchTarget } from "@/constants/theme";

/**
 * What a customer does: find a place, manage what they booked, and
 * their own account.
 *
 * Five tabs, which is the most a phone bar holds before the labels
 * start truncating. Notifications live inside Account rather than
 * taking a sixth — they are checked occasionally, not constantly.
 *
 * The icons are placeholders until an icon set is chosen; the brief is
 * explicit that this phase is architecture, and a tab bar that renders
 * with correct labels and routes is the part that needs to be right.
 */
export default function CustomerLayout() {
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
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="search" options={{ title: "ابحث" }} />
      <Tabs.Screen name="bookings" options={{ title: "حجوزاتي" }} />
      <Tabs.Screen name="favorites" options={{ title: "المحفوظات" }} />
      <Tabs.Screen name="account" options={{ title: "حسابي" }} />
    </Tabs>
  );
}
