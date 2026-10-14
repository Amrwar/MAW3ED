import { Redirect, Tabs } from "expo-router";
import { useSignedInGuard } from "@/features/auth/useSignedInGuard";
import { useAuth } from "@/features/auth/AuthProvider";
import { bottomNavOptions, tabIcon, useLocale } from "@/design";
import { useBusinessAccess } from "@/features/business/access";

/**
 * The business's space — for the owner and for staff who were given app
 * access.
 *
 * Guarded here rather than per screen: somebody who works for no business
 * has nothing to see in any of these tabs. The server checks the same
 * thing on every request — this only saves looking at empty screens.
 *
 * Four tabs, for running the day standing up: Today, the Calendar, the
 * Customers, and More (the business, its team and services, reports for
 * the owner, settings). Configuration is the web dashboard's job.
 * Customers is hidden for a provider, who has no customer book.
 * Notifications open from Today's bell and from More.
 */
export default function BusinessLayout() {
  const { user, restoring } = useAuth();
  const { lang } = useLocale();
  const access = useBusinessAccess();
  const works = Boolean(user?.businessId || user?.staff);
  // Reached by a link while signed out: sign in and come back (and home
  // after signing out from in here).
  const door = useSignedInGuard();

  if (door === "left") return <Redirect href="/" />;
  if (door === "wait" || restoring || !user) return null;
  if (!works) return <Redirect href="/(customer)" />;

  const TABS = [
    { name: "index", ar: "النهارده", en: "Today", icon: "today", show: true },
    { name: "calendar", ar: "التقويم", en: "Calendar", icon: "calendar", show: true },
    { name: "customers", ar: "العملاء", en: "Customers", icon: "people", show: access.can("customers.read") },
    { name: "account", ar: "المزيد", en: "More", icon: "menu", show: true },
  ] as const;

  return (
    <Tabs screenOptions={bottomNavOptions}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab[lang], tabBarIcon: tabIcon(tab.icon), href: tab.show ? undefined : null }}
        />
      ))}
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
