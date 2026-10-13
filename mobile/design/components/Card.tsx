import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, elevation, radius, spacing } from "../tokens";
import { Touchable } from "./Touchable";

/**
 * The white card on the light ground — the bright thing Deep Anchor
 * puts content on.
 *
 * Pressable when given `onPress`, and then announced as one control
 * with `accessibilityLabel` summarising it, rather than a dozen separate
 * text nodes a screen reader has to step through.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  tone = "surface",
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  /** `night` for a card on a dark screen; `tint` for a quiet highlighted one. */
  tone?: "surface" | "tint" | "night";
  style?: StyleProp<ViewStyle>;
}) {
  const body = [styles.card, styles[tone], padded && styles.padded, style];

  if (!onPress) {
    return (
      <View
        style={body}
        accessible={Boolean(accessibilityLabel)}
        // A label needs a role to hang on; "group" is what a card is.
        role={accessibilityLabel ? "group" : undefined}
        aria-label={accessibilityLabel}
      >
        {children}
      </View>
    );
  }

  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      pressedOpacity={0.85}
      style={body}
    >
      {children}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  surface: { backgroundColor: colors.surface, borderColor: colors.line, ...elevation.card },
  tint: { backgroundColor: colors.jadeTint, borderColor: colors.jadeLine },
  night: { backgroundColor: colors.night2, borderColor: colors.nightLine },
  padded: { padding: spacing.lg },
});
