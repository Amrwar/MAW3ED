import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, StyleSheet } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { ListState } from "@/components/ui/ListState";
import { BookingCard } from "@/features/bookings/BookingCard";
import { useMyBookings } from "@/features/customer/queries";
import { colors, radius, spacing, touchTarget } from "@/constants/theme";
import { SignInGate } from "@/features/auth/SignInGate";

type Tab = "upcoming" | "history";

/**
 * My bookings.
 *
 * Two tabs, because "upcoming" and "everything that already happened"
 * are different questions asked at different moments — one to check a
 * time, the other to find a receipt. Mixing them puts last March above
 * tomorrow.
 *
 * Pull to refresh, since the usual reason to open this screen is to
 * check whether something changed.
 */
export default function MyBookingsScreen() {
  return (
    <SignInGate title="حجوزاتي" reason="عشان تشوف مواعيدك الجاية وتديرها.">
      <MyBookings />
    </SignInGate>
  );
}

function MyBookings() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const query = useMyBookings(tab);
  const bookings = query.data?.bookings ?? [];

  return (
    <Screen scroll={false}>
      <Text variant="title">حجوزاتي</Text>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(["upcoming", "history"] as const).map((value) => {
          const active = tab === value;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text variant="label" tone={active ? "inverse" : "muted"}>
                {value === "upcoming" ? "الجاية" : "اللي فات"}
              </Text>
            </Pressable>
          );
        })}
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
          emptyTitle={
            query.data?.needsPhone
              ? "محتاجين رقم موبايلك"
              : tab === "upcoming"
                ? "مفيش مواعيد جاية"
                : "مفيش حاجة فاتت"
          }
          emptyBody={
            query.data?.needsPhone
              ? // Not an error: the account simply has no number to
                // match bookings against, and saying so is more use
                // than an empty list.
                "الحجوزات بتترّبط برقم موبايلك المتأكد منه. ضيفه من صفحة حسابك عشان تشوفها هنا."
              : tab === "upcoming"
                ? "لما تحجز مكان هيظهر هنا."
                : "لسه مفيش حجوزات خلصت."
          }
          onRetry={() => query.refetch()}
        >
          <View style={styles.list}>
            {bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                title={booking.business.nameAr}
                subtitle={booking.serviceName}
                date={booking.date}
                startTime={booking.startTime}
                endTime={booking.endTime}
                status={booking.status}
                price={booking.totalPrice}
                currency={booking.currency}
                // Only on the upcoming tab: "من 7 أشهر" under every row
                // of a history list is noise, not information.
                minutesUntil={tab === "upcoming" ? booking.minutesUntil : undefined}
                meta={booking.staffName ?? booking.branchName}
              />
            ))}
          </View>
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    minHeight: touchTarget - 8,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    borderRadius: radius.full,
    backgroundColor: colors.surface3,
  },
  tabActive: { backgroundColor: colors.jade },
  scroll: { paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
});
