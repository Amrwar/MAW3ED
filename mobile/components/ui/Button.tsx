import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import type { PressableProps } from "react-native";
import { Text } from "./Typography";
import { colors, radius, spacing, touchTarget } from "@/constants/theme";

type Variant = "primary" | "outline" | "ghost";

/**
 * The button.
 *
 * Three variants, matching the web's btn-primary / btn-outline /
 * btn-ghost so the two products agree about what a primary action looks
 * like.
 *
 * Every one is at least `touchTarget` tall — 48, the larger of Apple's
 * 44 and Android's 48 — so nothing is harder to hit on one platform
 * than the other. A busy button is disabled as well as spinning, since
 * a spinner that still accepts taps books twice.
 */
export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "children"> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        typeof style === "function" ? style({ pressed } as never) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.inverse : colors.jade} />
      ) : (
        <Text
          variant="bodyBold"
          tone={variant === "primary" ? "inverse" : "jade"}
          style={styles.label}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  primary: { backgroundColor: colors.jade },
  outline: { borderWidth: 1, borderColor: colors.line2, backgroundColor: colors.surface },
  ghost: { backgroundColor: "transparent" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  label: { textAlign: "center" },
});
