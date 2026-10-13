import { StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "../tokens";
import { useLocale } from "../locale";
import { useLayout } from "../layout";
import { time } from "@/lib/format";
import { Text } from "./Text";
import { Touchable } from "./Touchable";
import { EmptyState } from "./Feedback";

/**
 * Picking a time. The times are the server's (/slots) — this never
 * computes availability, it only shows what it is given. Grouped into
 * morning, afternoon and evening when there are many, because a wall of
 * 24 identical buttons is hard to scan. Three columns on a phone, more
 * on a tablet; one component either way.
 *
 * Each time is a radio button in one group, read as "2:30 PM, selected".
 */
export function TimeSlots({
  slots,
  value,
  onChange,
}: {
  /** "HH:MM", in order. */
  slots: readonly string[];
  value: string | null;
  onChange: (hhmm: string) => void;
}) {
  const { lang, t } = useLocale();
  const { isTablet } = useLayout();

  if (slots.length === 0) return <EmptyState title={t("noTimes")} icon="time-outline" />;

  const groups = slots.length > 8 ? groupByPart(slots, lang) : [{ label: null, items: slots }];
  const width = isTablet ? "18%" : "31%";

  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {groups.map((g) => (
        <View key={g.label ?? "all"} style={styles.group}>
          {g.label ? (
            <Text variant="tiny" tone="subtle" accessibilityRole="header">
              {g.label}
            </Text>
          ) : null}
          <View style={styles.grid}>
            {g.items.map((s) => {
              const selected = s === value;
              return (
                <Touchable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={time(s, lang)}
                  onPress={() => onChange(s)}
                  style={[styles.slot, { width }, selected ? styles.on : styles.off]}
                >
                  <Text variant="label" align="center" style={{ color: selected ? colors.inverse : colors.ink }}>
                    {time(s, lang)}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const PARTS = {
  ar: ["الصبح", "الضهر", "بالليل"],
  en: ["Morning", "Afternoon", "Evening"],
} as const;

function groupByPart(slots: readonly string[], lang: "ar" | "en") {
  const buckets: string[][] = [[], [], []];
  for (const s of slots) {
    const h = Number(s.slice(0, 2));
    buckets[h < 12 ? 0 : h < 17 ? 1 : 2]!.push(s);
  }
  return buckets
    .map((items, i) => ({ label: PARTS[lang][i]!, items }))
    .filter((g) => g.items.length > 0);
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  group: { gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  slot: {
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  on: { backgroundColor: colors.jade, borderColor: colors.jade },
  off: { backgroundColor: colors.surface, borderColor: colors.line2 },
});
