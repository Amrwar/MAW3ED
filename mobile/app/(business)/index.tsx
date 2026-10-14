import { useMemo } from "react";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { Screen, Text, Card, Button, ListState, colors, spacing } from "@/design";
import { BookingCard } from "@/features/bookings/BookingCard";
import { useAnalytics, useBusinessBookings } from "@/features/business/queries";
import { money, num } from "@/lib/format";

/**
 * The owner's home.
 *
 * Today, first: what is booked, and what needs confirming. An owner
 * opening this on the shop floor wants the next hour, not a chart.
 *
 * The month's numbers sit underneath and come from the same analytics
 * endpoint the dashboard uses, so the two cannot disagree. Every figure
 * is measured — there is no target, no projection, and nothing invented
 * to fill a card.
 */
export default function BusinessHome() {
  const router = useRouter();

  // Cairo's date, not the device's: a phone set to another timezone
  // would otherwise ask for the wrong day's bookings.
  const today = useMemo(() => cairoToday(), []);
  const monthStart = useMemo(() => `${today.slice(0, 7)}-01`, [today]);

  const todays = useBusinessBookings({ date: today });
  const analytics = useAnalytics(monthStart, today);

  const bookings = todays.data?.bookings ?? [];
  const awaiting = bookings.filter((b) => b.status === "PENDING");
  const kpis = analytics.data?.kpis;

  return (
    <Screen
      scroll={false}
      hero={
        <Text variant="display" tone="inverse" accessibilityRole="header">
          النهاردة
        </Text>
      }
    >

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={todays.isRefetching}
            onRefresh={() => {
              todays.refetch();
              analytics.refetch();
            }}
            tintColor={colors.jade}
          />
        }
      >
        {/* ── The month, measured ── */}
        <View style={styles.tiles}>
          <Tile
            label="حجوزات الشهر"
            value={kpis ? num(kpis.totalBookings) : "—"}
            loading={analytics.isLoading}
          />
          <Tile
            label="إيراد مكتمل"
            value={kpis ? (money(kpis.completedRevenue, kpis.currency) ?? "—") : "—"}
            loading={analytics.isLoading}
          />
        </View>

        {/* Only when something is actually waiting. A zero here would
            be a nudge to do nothing. */}
        {awaiting.length > 0 ? (
          <Card>
            <Text variant="bodyBold">{num(awaiting.length)} في انتظار التأكيد</Text>
            <Text variant="caption" tone="muted" style={styles.tileHint}>
              العميل مستني ردّك.
            </Text>
            <Button
              label="راجعهم"
              variant="outline"
              style={styles.cardButton}
              onPress={() => router.push("/(business)/bookings")}
            />
          </Card>
        ) : null}

        <Text variant="heading" style={styles.sectionTitle}>
          مواعيد النهاردة
        </Text>

        <ListState
          loading={todays.isLoading}
          error={todays.error}
          isEmpty={bookings.length === 0}
          emptyTitle="مفيش مواعيد النهاردة"
          emptyBody="أول ما حد يحجز هيظهر هنا."
          onRetry={() => todays.refetch()}
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
                onPress={() => router.push("/(business)/bookings")}
              />
            ))}
          </View>
        </ListState>
      </ScrollView>
    </Screen>
  );
}

function Tile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <View style={styles.tile}>
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
      {/* An em dash while loading, never a zero: "0 حجوزات" is a claim,
          and it would be the wrong one. */}
      <Text variant="title" style={styles.tileValue}>
        {loading ? "—" : value}
      </Text>
    </View>
  );
}

/**
 * Today in Cairo, as "YYYY-MM-DD".
 *
 * The whole product runs on Africa/Cairo — the server stores dates in
 * it and the booking rules are written against it. Asking the device
 * would show a traveller the wrong day's list.
 */
function cairoToday(): string {
  // en-CA gives ISO-shaped output, which is what the API expects.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const styles = StyleSheet.create({
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  tiles: { flexDirection: "row", gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  tileValue: { marginTop: spacing.xs },
  tileHint: { marginTop: spacing.xs },
  cardButton: { marginTop: spacing.lg },
  sectionTitle: { marginTop: spacing.sm },
  list: { gap: spacing.md },
});
