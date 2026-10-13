import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { Screen, Text, ListState, colors, radius, spacing, touchTarget } from "@/design";
import { BookingCard } from "@/features/bookings/BookingCard";
import { useBusinessBookings } from "@/features/business/queries";
import { longDate, num, shortDate } from "@/lib/format";

/** How many days the strip offers at once. A fortnight fits the thumb. */
const DAYS_SHOWN = 14;

/**
 * The calendar.
 *
 * A day at a time, picked from a scrolling strip. The web's month grid
 * does not survive the trip to a 390px screen — thirty cells each
 * holding several appointments becomes unreadable, and shrinking it
 * until it fits is how an app ends up feeling like a website in a
 * frame.
 *
 * So: the strip answers "which day", the list answers "what is on it",
 * and a dot marks the days that have anything. Same data, shaped for
 * the device.
 */
export default function Calendar() {
  const days = useMemo(() => upcomingDays(DAYS_SHOWN), []);
  const [selected, setSelected] = useState(days[0]!);

  const query = useBusinessBookings({ date: selected });
  const bookings = query.data?.bookings ?? [];

  return (
    <Screen scroll={false}>
      <Text variant="title">التقويم</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        style={styles.stripOuter}
      >
        {days.map((day) => {
          const active = day === selected;
          return (
            <Pressable
              key={day}
              onPress={() => setSelected(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={longDate(day)}
              style={[styles.day, active && styles.dayActive]}
            >
              <Text variant="caption" tone={active ? "inverse" : "subtle"}>
                {weekdayShort(day)}
              </Text>
              <Text variant="bodyBold" tone={active ? "inverse" : "ink"}>
                {shortDate(day).split(" ")[0]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dayHeader}>
        <Text variant="heading">{longDate(selected)}</Text>
        {query.data ? (
          <Text variant="caption" tone="subtle">
            {num(query.data.total)} موعد
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.jade}
          />
        }
      >
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={bookings.length === 0}
          emptyTitle="اليوم ده فاضي"
          emptyBody="مفيش مواعيد محجوزة في اليوم ده."
          onRetry={() => query.refetch()}
        >
          <View style={styles.list}>
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                title={booking.customerName}
                subtitle={booking.serviceName}
                date={booking.date}
                startTime={booking.startTime}
                endTime={booking.endTime}
                status={booking.status}
                price={booking.totalPrice}
                currency={booking.currency}
                meta={booking.staffName ?? booking.tableName}
              />
            ))}
          </View>
        </ListState>
      </ScrollView>
    </Screen>
  );
}

/**
 * Today and the next `count - 1` days, in Cairo.
 *
 * Cairo rather than the device, for the same reason the dashboard uses
 * it: the bookings are stored against Cairo dates, so a phone in another
 * timezone would highlight the wrong day as today.
 */
function upcomingDays(count: number): string[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const start = new Date();
  return Array.from({ length: count }, (_, i) =>
    formatter.format(new Date(start.getTime() + i * 86_400_000)),
  );
}

function weekdayShort(isoDate: string): string {
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

const styles = StyleSheet.create({
  stripOuter: { flexGrow: 0, marginTop: spacing.lg },
  strip: { gap: spacing.sm, paddingVertical: 2 },
  day: {
    minWidth: touchTarget + 8,
    minHeight: touchTarget + 10,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  dayActive: { backgroundColor: colors.jade, borderColor: colors.jade },
  dayHeader: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  scroll: { paddingTop: spacing.md, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
});
