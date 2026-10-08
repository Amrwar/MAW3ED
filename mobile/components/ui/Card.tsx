import type { ReactNode } from "react";
import { Pressable, View, StyleSheet } from "react-native";
import { colors, radius, shadows, spacing } from "@/constants/theme";

/**
 * A surface.
 *
 * Pressable only when there is somewhere to go: a card with an onPress
 * gets the button role and the pressed state, and one without stays a
 * plain View. Wrapping everything in a Pressable "just in case" is how
 * a screen reader ends up announcing every block as a button.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  padded = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
}) {
  const content = (
    <View style={[styles.card, padded && styles.padded]}>{children}</View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    ...shadows.card,
  },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
});
