import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/features/auth/AuthProvider";
import { colors, typography, touchTarget } from "@/constants/theme";

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
  { name: "index", title: "نظرة عامة", icon: "pulse" },
  { name: "account", title: "حسابي", icon: "person" },
] as const;

export default function AdminLayout() {
  const { user, restoring } = useAuth();

  if (restoring) return null;
  if (!user?.adminRole) return <Redirect href="/(customer)" />;

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
              <Ionicons name={focused ? tab.icon : (`${tab.icon}-outline` as never)} size={size ?? 22} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
