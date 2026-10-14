import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget } from "../tokens";
import { useLocale } from "../locale";
import { joinLabel } from "../strings";
import { addMonths, cairoToday, daysFrom, monthGrid, monthStart, weekdayHeaders } from "../calendar";
import { dayOfMonth, longDate, monthShort, monthYear, weekdayHeading, weekdayShort } from "@/lib/format";
import { Text } from "./Text";
import { Touchable } from "./Touchable";
import { IconButton } from "./IconButton";

/**
 * Picking a day, two ways:
 *
 *  - DateStrip, a row of the next few weeks — the common case, where
 *    most bookings are within days and a whole calendar is too much.
 *  - Calendar, a month grid — for further out.
 *
 * Both take the days that may be chosen, so a closed day is shown as
 * unavailable instead of being offered and then refused. Every day is
 * one button whose name is the full date ("Sunday, October 12, 2026"),
 * with its state, so a screen reader never hears just "12".
 */

interface DayChoice {
  value: string | null;
  onChange: (iso: string) => void;
  /** Days that can be chosen. Anything else is shown disabled. */
  isAvailable?: (iso: string) => boolean;
}

export function DateStrip({ value, onChange, isAvailable, days = 30, from }: DayChoice & { days?: number; from?: string }) {
  const { lang, t } = useLocale();
  const start = from ?? cairoToday();
  const list = useMemo(() => daysFrom(start, days), [start, days]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {list.map((iso, i) => {
        const selected = iso === value;
        const available = isAvailable ? isAvailable(iso) : true;
        const relative = i === 0 ? t("today") : i === 1 ? t("tomorrow") : null;
        return (
          <Touchable
            key={iso}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled: !available }}
            accessibilityLabel={joinLabel(lang, relative, longDate(iso, lang), !available && t("unavailable"))}
            disabled={!available}
            onPress={() => onChange(iso)}
            style={[styles.stripDay, selected ? styles.dayOn : styles.dayOff, !available && styles.dayDisabled]}
            testID="day-option"
          >
            <Text variant="tiny" align="center" style={{ color: selected ? colors.gold : colors.subtle }} numberOfLines={1}>
              {relative ?? weekdayShort(iso, lang)}
            </Text>
            <Text variant="heading" align="center" style={{ color: selected ? colors.inverse : colors.ink }}>
              {dayOfMonth(iso, lang)}
            </Text>
            <Text variant="tiny" align="center" style={{ color: selected ? colors.gold : colors.subtle }} numberOfLines={1}>
              {monthShort(iso, lang)}
            </Text>
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

export function Calendar({ value, onChange, isAvailable, min }: DayChoice & { min?: string }) {
  const { lang, t } = useLocale();
  const today = cairoToday();
  const floor = min ?? today;
  const [month, setMonth] = useState(monthStart(value ?? floor));
  const weeks = useMemo(() => monthGrid(month), [month]);
  const canGoBack = month > monthStart(floor);

  return (
    <View style={styles.calendar}>
      <View style={styles.monthBar}>
        <IconButton
          icon="chevron-back"
          label={t("previousMonth")}
          disabled={!canGoBack}
          onPress={() => setMonth(addMonths(month, -1))}
        />
        <Text variant="heading" align="center" style={styles.monthTitle} accessibilityLiveRegion="polite">
          {monthYear(month, lang)}
        </Text>
        <IconButton icon="chevron-forward" label={t("nextMonth")} onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {weekdayHeaders().map((iso) => (
          <Text key={iso} variant="tiny" tone="subtle" align="center" style={styles.cell} numberOfLines={1}>
            {weekdayHeading(iso, lang)}
          </Text>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((iso, d) => {
            if (!iso) return <View key={d} style={styles.cell} />;
            const selected = iso === value;
            const past = iso < floor;
            const available = !past && (isAvailable ? isAvailable(iso) : true);
            return (
              <Touchable
                key={iso}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !available }}
                accessibilityLabel={joinLabel(lang, iso === today && t("today"), longDate(iso, lang), !available && t("unavailable"))}
                disabled={!available}
                onPress={() => onChange(iso)}
                style={[styles.cell, styles.day, selected && styles.dayOn, iso === today && !selected && styles.today]}
              >
                <Text
                  variant={selected ? "label" : "body"}
                  align="center"
                  style={{ color: selected ? colors.inverse : available ? colors.ink : colors.faint }}
                >
                  {dayOfMonth(iso, lang)}
                </Text>
              </Touchable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  stripDay: {
    width: 66,
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  dayOn: { backgroundColor: colors.night, borderColor: colors.night },
  dayOff: { backgroundColor: colors.surface, borderColor: colors.line },
  dayDisabled: { opacity: 0.4 },
  calendar: { gap: spacing.xs },
  monthBar: { flexDirection: "row", alignItems: "center" },
  monthTitle: { flex: 1 },
  week: { flexDirection: "row" },
  cell: { flex: 1, minHeight: touchTarget - 4, alignItems: "center", justifyContent: "center" },
  day: { borderRadius: radius.full, overflow: "hidden" },
  today: { borderWidth: 1.5, borderColor: colors.night },
});
