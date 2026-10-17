import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { bottomNavOptions, tabIcon, useLocale } from "@/design";

/**
 * The platform admin's space — deliberately small.
 *
 * The full admin stays on the web: moderation queues, payment refunds
 * and audit trails are desk work, and duplicating fifteen screens in the
 * app would mean two admin tools to keep in step. What earns a place on
 * a phone is knowing whether anything needs attention right now. The
 * server checks the role on every request (requireAdminApi); this guard
 * only saves a non-admin from an empty space.
 */
const TABS = [
  { name: "index", ar: "نظرة عامة", en: "Overview", icon: "pulse" },
  { name: "account", ar: "حسابي", en: "Account", icon: "person" },
] as const;

export default function AdminLayout() {
  const { user, restoring } = useAuth();
  const { lang } = useLocale();

  if (restoring) return null;
  if (!user?.adminRole) return <Redirect href="/(customer)" />;

  return (
    <Tabs screenOptions={bottomNavOptions}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab[lang],
            tabBarIcon: tabIcon(tab.icon),
          }}
        />
      ))}
    </Tabs>
  );
}
