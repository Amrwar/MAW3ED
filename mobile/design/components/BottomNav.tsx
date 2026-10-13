import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Tabs } from "expo-router";
import { colors, fonts, touchTarget } from "../tokens";
import type { IconName } from "./Icon";

/** The options object <Tabs screenOptions> takes, from its public props. */
type TabOptions = Exclude<NonNullable<ComponentProps<typeof Tabs>["screenOptions"]>, (...args: never[]) => unknown>;

/**
 * The bottom navigation, as options for Expo Router's <Tabs> — one
 * definition for the customer, business and admin spaces instead of
 * three copies that drift.
 *
 * The bar is the platform's own (react-navigation), so it gets native
 * accessibility — "tab, 3 of 6, selected" — and safe-area handling for
 * free. Order follows the layout direction: the first tab sits at the
 * reading start, on the right in Arabic.
 *
 * The selected tab is marked by a filled icon as well as the jade
 * colour, so it is not signalled by colour alone.
 */
export const bottomNavOptions: TabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.jade,
  tabBarInactiveTintColor: colors.subtle,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    minHeight: touchTarget + 16,
    paddingTop: 6,
  },
  tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
  tabBarAllowFontScaling: true,
};

/** Outline icon, filled when the tab is selected. */
export function tabIcon(name: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    const outline = `${name}-outline` as IconName;
    return <Ionicons name={focused ? name : outline} size={size ?? 22} color={color as string} />;
  }
  return TabIcon;
}
