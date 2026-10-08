import { View, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { colors, radius, spacing } from "@/constants/theme";

export type BadgeTone = "neutral" | "ok" | "warn" | "danger" | "info" | "jade";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surface3, fg: colors.muted },
  ok: { bg: colors.okSoft, fg: colors.ok },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  jade: { bg: colors.jadeSoft, fg: colors.jade },
};

/**
 * A small status pill.
 *
 * The colour pairs come from the web's status tokens, which were chosen
 * to clear 4.5:1 — the foreground is the dark variant on the soft
 * background, never the other way round.
 *
 * Colour is never the only signal: every badge carries its own words,
 * so it still reads correctly to somebody who cannot tell green from
 * amber.
 */
export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text variant="tiny" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
});
