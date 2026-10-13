import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/features/auth/AuthProvider";
import { colors, typography, touchTarget } from "@/constants/theme";
import { useUnreadCount } from "@/features/notifications/queries";

/**
 * The owner's space.
 *
 * Guarded here rather than per screen: a person with no business has
 * nothing to show in any of these tabs, so the whole group redirects.
 * The server checks the same thing on every request — this only saves
 * somebody from looking at five empty screens.
 *
 * Which tabs: the things an owner does standing up, away from a desk.
 * The dashboard, the calendar, bookings, customers, and what changed. Services, staff
 * and settings are configuration — occasional, fiddly, better on the
 * web — so they sit inside Account rather than taking a tab each.
 *
 * Outline icons that fill when active, so the selected tab is marked by
 * shape as well as colour rather than by colour alone.
 */

/** One place to add a tab, so the icon and the route cannot drift. */
const TABS = [
  { name: "index", title: "الرئيسية", icon: "grid" },
  { name: "calendar", title: "التقويم", icon: "calendar" },
  { name: "bookings", title: "الحجوزات", icon: "list" },
  { name: "customers", title: "العملاء", icon: "people" },
  { name: "notifications", title: "الإشعارات", icon: "notifications" },
  { name: "account", title: "حسابي", icon: "person" },
] as const;

export default function BusinessLayout() {
  const { user, restoring } = useAuth();
  const unread = useUnreadCount(Boolean(user?.businessId));

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
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === "notifications" ? unread : undefined,
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
