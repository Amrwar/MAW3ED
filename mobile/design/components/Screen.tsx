import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../tokens";
import { useLayout } from "../layout";

/**
 * A screen's frame: safe areas, the background, a gutter, and on a
 * tablet a content column that stops growing — so a form is not 1100pt
 * wide on an iPad. One component for every size; nothing is written
 * twice for phones and tablets.
 *
 * `dark` is the Deep Anchor surface, for screens that open on night
 * (sign-in, splash-adjacent flows). The keyboard pushes content up on
 * iOS rather than covering the field being typed in.
 */
export function Screen({
  children,
  scroll = true,
  dark = false,
  edges = "top",
  footer,
  hero,
  testID,
}: {
  children: ReactNode;
  /**
   * A night block across the top (Bold Cairo), above the content — the
   * tab screens' title and anything that belongs with it. It takes the
   * top safe area, so the content under it starts with a small gap.
   */
  hero?: ReactNode;
  scroll?: boolean;
  dark?: boolean;
  /** Which edges to pad for. Tab screens sit above the tab bar, which owns the bottom. */
  edges?: "top" | "both" | "none";
  /** Pinned under the content — a primary action that must stay in reach. */
  footer?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const layout = useLayout();
  const background = dark ? colors.night : colors.ground;

  const column = {
    width: "100%" as const,
    maxWidth: layout.contentWidth + layout.gutter * 2,
    alignSelf: "center" as const,
    paddingHorizontal: layout.gutter,
  };
  const top = hero ? spacing.lg : edges === "none" ? 0 : insets.top + spacing.md;
  const bottom = edges === "both" ? insets.bottom + spacing.lg : spacing.xl;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[column, { paddingTop: top, paddingBottom: bottom }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, column, { paddingTop: top }]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      testID={testID}
    >
      {hero ? (
        <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
          <View style={column}>{hero}</View>
        </View>
      ) : null}
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: dark ? colors.night : colors.surface, borderTopColor: dark ? colors.nightLine : colors.line },
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={column}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: { borderTopWidth: 1, paddingTop: spacing.md },
  hero: {
    backgroundColor: colors.night,
    paddingBottom: spacing.xl,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28,
  },
});
