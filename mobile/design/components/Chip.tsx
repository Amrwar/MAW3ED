import { StyleSheet } from "react-native";
import { colors, radius, spacing } from "../tokens";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";
import { Touchable } from "./Touchable";
import { useLocale } from "../locale";
import { joinLabel } from "../strings";

/**
 * A choice you can turn on and off — a filter, a category. Announced as
 * a checkbox with its state, so a screen reader says "selected" rather
 * than relying on the colour change.
 *
 * Visually 36pt tall, as chips should be in a dense row; the hit area
 * is padded out to the 48pt target.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  count?: number;
}) {
  const { lang } = useLocale();
  const fg = selected ? colors.inverse : colors.ink2;
  return (
    <Touchable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={joinLabel(lang, label, count === undefined ? null : String(count))}
      onPress={onPress}
      hitSlop={6}
      style={[styles.chip, selected ? styles.on : styles.off]}
    >
      {selected ? <Icon name="checkmark" size="sm" color={fg} /> : icon ? <Icon name={icon} size="sm" color={fg} /> : null}
      <Text variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="tiny" style={{ color: selected ? colors.gold : colors.subtle }}>
          {count}
        </Text>
      ) : null}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md + 2,
    overflow: "hidden",
  },
  on: { backgroundColor: colors.night, borderColor: colors.night },
  off: { backgroundColor: colors.surface, borderColor: colors.line2 },
});
