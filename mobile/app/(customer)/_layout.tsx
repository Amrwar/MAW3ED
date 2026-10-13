import { Tabs } from "expo-router";
import { bottomNavOptions, tabIcon, useLocale } from "@/design";

/**
 * What a customer does: find a place, book it, keep track of it.
 *
 * Five tabs — the most a phone bar holds before labels truncate.
 * Notifications are reached from the bell on Home (with the unread dot)
 * and from Account, so they do not take a sixth; the route stays, hidden
 * from the bar (href: null), for links and push taps that open it.
 */
const TABS = [
  { name: "index", ar: "الرئيسية", en: "Home", icon: "home" },
  { name: "search", ar: "ابحث", en: "Search", icon: "search" },
  { name: "bookings", ar: "حجوزاتي", en: "Bookings", icon: "calendar" },
  { name: "favorites", ar: "المحفوظات", en: "Favorites", icon: "heart" },
  { name: "account", ar: "حسابي", en: "Account", icon: "person" },
] as const;

export default function CustomerLayout() {
  const { lang } = useLocale();

  return (
    <Tabs screenOptions={bottomNavOptions}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab[lang], tabBarIcon: tabIcon(tab.icon) }} />
      ))}
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
