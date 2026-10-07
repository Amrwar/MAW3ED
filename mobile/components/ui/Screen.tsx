import type { ReactNode } from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants/theme";

/**
 * The frame every screen sits in.
 *
 * It owns the two things every screen would otherwise get slightly
 * wrong: the safe area, which differs on every phone, and the page
 * padding, which has to match across screens or the app looks ragged
 * as you move between tabs.
 *
 * `scroll` defaults to true because most screens are lists; a screen
 * that owns its own FlatList passes false, since nesting a list inside
 * a ScrollView breaks the list's virtualisation.
 */
export function Screen({
  children,
  scroll = true,
  dark = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const background = dark ? colors.night : colors.ground;

  const padding = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  };

  if (!scroll) {
    return <View style={[styles.base, { backgroundColor: background }, padding]}>{children}</View>;
  }

  return (
    <ScrollView
      style={[styles.base, { backgroundColor: background }]}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1 },
});
