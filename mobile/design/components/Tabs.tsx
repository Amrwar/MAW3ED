import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../tokens";
import { Text } from "./Text";
import { Touchable } from "./Touchable";

/**
 * Switching between views of the same thing — upcoming and past
 * bookings, phone and email sign-in. A segmented control on the surface,
 * or `night` on a dark screen. Announced as a tab list with the chosen
 * tab marked selected. Order follows reading direction, so the first
 * option is on the right in Arabic.
 */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  tone = "light",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: "light" | "night";
}) {
  const night = tone === "night";
  return (
    <View style={[styles.track, night ? styles.trackNight : styles.trackLight]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Touchable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.tab, selected && (night ? styles.selectedNight : styles.selectedLight)]}
          >
            <Text
              variant="label"
              align="center"
              numberOfLines={1}
              style={{ color: selected ? (night ? colors.night : colors.ink) : night ? colors.nightText : colors.muted }}
            >
              {o.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: spacing.xs, borderRadius: radius.md, gap: spacing.xs },
  trackLight: { backgroundColor: colors.surface3 },
  trackNight: { backgroundColor: colors.night2 },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    overflow: "hidden",
  },
  selectedLight: {
    backgroundColor: colors.surface,
    shadowColor: colors.night,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  selectedNight: { backgroundColor: colors.gold },
});
