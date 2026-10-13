import { Tabs } from "expo-router";
import { bottomNavOptions, tabIcon } from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { useUnreadCount } from "@/features/notifications/queries";

/**
 * What a customer does: find a place, manage what they booked, and
 * their own account.
 *
 * Six tabs. Notifications has its own, with the unread count on it:
 * booking confirmations and changes are what a customer most needs to
 * see, and a count buried inside Account is a count nobody sees. Labels
 * are short so six fit on a 320px phone.
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
  { name: "notifications", title: "الإشعارات", icon: "notifications" },
  { name: "account", title: "حسابي", icon: "person" },
] as const;

export default function CustomerLayout() {
  const { user } = useAuth();
  const unread = useUnreadCount(Boolean(user));

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
