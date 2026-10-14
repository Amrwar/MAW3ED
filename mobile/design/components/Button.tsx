import { ActivityIndicator, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, touchTarget } from "../tokens";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { Touchable } from "./Touchable";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "night" | "gold";
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; border: string; ripple: string }> = {
  // Cairo green — the one thing on the screen to do (the app's Bold Cairo look).
  primary: { bg: colors.night, fg: colors.inverse, border: colors.night, ripple: colors.night2 },
  // Ink — a strong action that is not the brand's call to action.
  secondary: { bg: colors.ink, fg: colors.inverse, border: colors.ink, ripple: colors.night2 },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.line2, ripple: colors.surface3 },
  ghost: { bg: "transparent", fg: colors.jade, border: "transparent", ripple: colors.jadeSoft },
  danger: { bg: colors.danger, fg: colors.inverse, border: colors.danger, ripple: colors.ink },
  // On a night background: jade lifted to read on dark.
  night: { bg: colors.night2, fg: colors.inverse, border: colors.nightLine, ripple: colors.nightLine },
  // Gold, under night text — the call to action on a night background.
  gold: { bg: colors.gold, fg: colors.night, border: colors.gold, ripple: colors.goldLine },
};

/**
 * The button. Variants follow the web's btn-* names; the app's primary
 * is Cairo green and it adds gold, for actions on a night background.
 *
 * Every size is at least the 48pt touch target — `sm` is visually
 * smaller, not harder to hit. A busy button is disabled as well as
 * spinning: a spinner that still accepts taps books twice. The label
 * stays in the accessibility tree while busy, with "busy" added.
 */
export function Button({
  label,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  loading = false,
  disabled,
  fullWidth = false,
  style,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "start" | "end";
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      disabled={inactive}
      rippleColor={v.ripple}
      hitSlop={size === "sm" ? 6 : undefined}
      {...rest}
      style={[
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        { backgroundColor: v.bg, borderColor: v.border },
        fullWidth && styles.full,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} aria-hidden />
      ) : (
        <View style={[styles.row, iconPosition === "end" && styles.reverse]}>
          {icon ? <Icon name={icon} size={size === "sm" ? "sm" : "md"} color={v.fg} /> : null}
          <Text variant="label" style={{ color: v.fg }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  md: { minHeight: touchTarget, paddingHorizontal: spacing.xl },
  sm: { minHeight: 36, paddingHorizontal: spacing.lg, borderRadius: radius.sm },
  full: { alignSelf: "stretch" },
  inactive: { opacity: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reverse: { flexDirection: "row-reverse" },
});
