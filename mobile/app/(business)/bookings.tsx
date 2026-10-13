import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { Screen, Text, Button, ListState, colors, radius, spacing, touchTarget } from "@/design";
import { BookingCard } from "@/features/bookings/BookingCard";
import { useBusinessBookings, useUpdateBookingStatus } from "@/features/business/queries";
import { nextActionsFor } from "@/features/bookings/status";
import { num } from "@/lib/format";

const FILTERS = [
  { value: "ALL", label: "الكل" },
  { value: "PENDING", label: "في الانتظار" },
  { value: "CONFIRMED", label: "مؤكد" },
  { value: "COMPLETED", label: "مكتمل" },
] as const;

/**
 * The owner's bookings, with the actions on them.
 *
 * Each card offers only the moves that make sense from where it is —
 * a finished appointment offers nothing, a pending one offers confirm
 * or cancel. Buttons that are always present and usually disabled teach
 * people to ignore buttons.
 *
 * Nothing here is optimistic. Confirming is a promise to a customer,
 * and showing it as confirmed before the server agreed would be a lie
 * if the request failed.
 */
export default function BusinessBookings() {
  const [filter, setFilter] = useState<string>("ALL");
  const query = useBusinessBookings({ status: filter });
  const update = useUpdateBookingStatus();

  const bookings = query.data?.bookings ?? [];

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <Text variant="title">الحجوزات</Text>
        {query.data ? (
          <Text variant="caption" tone="subtle">
            {num(query.data.total)}
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        // Without this the row stretches to the tallest child and the
        // chips float in the middle of a tall strip.
        style={styles.filterStrip}
      >
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setFilter(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text variant="label" tone={active ? "inverse" : "muted"}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
          emptyTitle={filter === "ALL" ? "مفيش حجوزات" : "مفيش حجوزات بالحالة دي"}
          emptyBody={
            filter === "ALL"
              ? "أول ما حد يحجز هيظهر هنا."
              : "جرّب فلتر تاني عشان تشوف باقي الحجوزات."
          }
          onRetry={() => query.refetch()}
        >
          <View style={styles.list}>
            {bookings.map((booking) => {
              const actions = nextActionsFor(booking.status);
              const busy = update.isPending && update.variables?.id === booking.id;

              return (
                <BookingCard
                  key={booking.id}
                  title={booking.customerName}
                  subtitle={`${booking.serviceName} · ${booking.customerPhone}`}
                  date={booking.date}
                  startTime={booking.startTime}
                  endTime={booking.endTime}
                  status={booking.status}
                  price={booking.totalPrice}
                  currency={booking.currency}
                  meta={booking.staffName ?? booking.tableName}
                  actions={
                    actions.length > 0 ? (
                      <>
                        {actions.map((action) => (
                          <Button
                            key={action.status}
                            label={action.label}
                            variant={action.status === "CONFIRMED" ? "primary" : "outline"}
                            loading={busy}
                            onPress={() =>
                              update.mutate({ id: booking.id, status: action.status })
                            }
                            style={styles.action}
                          />
                        ))}
                      </>
                    ) : null
                  }
                />
              );
            })}
          </View>
        </ListState>

        {update.isError ? (
          <Text variant="caption" tone="danger" style={styles.error}>
            ما قدرناش نحدّث الحجز. جرّب تاني.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  filterStrip: { flexGrow: 0, marginTop: spacing.lg },
  filters: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    minHeight: touchTarget - 10,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.surface3,
  },
  chipActive: { backgroundColor: colors.jade },
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
  action: { flexGrow: 1, minWidth: 96, paddingHorizontal: spacing.lg },
  error: { marginTop: spacing.lg, textAlign: "center" },
});
