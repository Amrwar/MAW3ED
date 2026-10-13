import { StyleSheet, type PressableProps } from "react-native";
import { colors, radius, touchTarget } from "../tokens";
import { Icon, type IconName } from "./Icon";
import { Touchable } from "./Touchable";

/**
 * A button that is only an icon. `label` is required: an icon has no
 * name a screen reader can say, and "button" alone tells nobody what it
 * does. Always the full 48pt target, whatever the icon's size.
 */
export function IconButton({
  icon,
  label,
  variant = "plain",
  color,
  ...rest
}: Omit<PressableProps, "children" | "style"> & {
  icon: IconName;
  label: string;
  variant?: "plain" | "filled" | "night";
  color?: string;
}) {
  const fg = color ?? (variant === "night" ? colors.inverse : colors.ink);
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      borderless={variant === "plain"}
      {...rest}
      style={[
        styles.base,
        variant === "filled" && styles.filled,
        variant === "night" && styles.night,
        rest.disabled && styles.disabled,
      ]}
    >
      <Icon name={icon} size="lg" color={fg} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
  },
  filled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  night: { backgroundColor: colors.night2 },
  disabled: { opacity: 0.4 },
});
