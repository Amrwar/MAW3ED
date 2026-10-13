import { StyleSheet, View } from "react-native";
import { radius, spacing, tones, type Tone } from "../tokens";
import { Text } from "./Text";
import { Icon, type IconName } from "./Icon";

export type BadgeTone = Tone;

/**
 * A short status label — "مؤكد", "Verified". Colour is never the only
 * signal: the word is always there, and status badges can carry an
 * icon so they also differ in shape.
 */
export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.line }]}>
      {icon ? <Icon name={icon} size={13} color={c.fg} /> : null}
      <Text variant="tiny" style={{ color: c.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
  },
});
