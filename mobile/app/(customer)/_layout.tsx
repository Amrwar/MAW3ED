import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, touchTarget } from "@/constants/theme";

/**
 * What a customer does: find a place, manage what they booked, and
 * their own account.
 *
 * Five tabs, which is the most a phone bar holds before the labels
 * start truncating. Notifications live inside Account rather than
 * taking a sixth — they are checked occasionally, not constantly.
 *
 * Outline icons that fill when active, which is the convention on both
 * platforms and means the selected tab is marked twice over — by shape
 * and by colour — rather than by colour alone.
 */

/** One place to add a tab, so the icon and the route cannot drift. */
const TABS = [
  { name: "index", title: "الرئيسية", icon: "home" },
  { name: "search", title: "ابحث", icon: "search" },
  { name: "bookings", title: "حجوزاتي", icon: "calendar" },
  { name: "favorites", title: "المحفوظات", icon: "heart" },
  { name: "account", title: "حسابي", icon: "person" },
] as const;

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
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons
                name={focused ? tab.icon : (`${tab.icon}-outline` as never)}
                size={size ?? 22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
