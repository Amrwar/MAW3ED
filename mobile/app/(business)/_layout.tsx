import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { bottomNavOptions, tabIcon } from "@/design";
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
    <Tabs screenOptions={bottomNavOptions}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarBadge: tab.name === "notifications" ? unread : undefined,
            tabBarIcon: tabIcon(tab.icon),
          }}
        />
      ))}
    </Tabs>
  );
}
