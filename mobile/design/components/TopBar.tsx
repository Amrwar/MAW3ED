import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../tokens";
import { Header } from "./Header";

/**
 * The top of a pushed screen in the app's Bold Cairo look: a night block
 * under the status bar, with the Header in it and rounded lower corners.
 * It takes the top safe area itself, so the page around it must not.
 * Anything that belongs up there with the title goes in `children`.
 */
export function TopBar({ children, ...header }: Omit<ComponentProps<typeof Header>, "tone"> & { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <Header {...header} tone="night" />
      {children ? <View style={styles.extra}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.night,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomStartRadius: 24,
    borderBottomEndRadius: 24,
  },
  extra: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
});
