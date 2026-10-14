import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Button, ListState, Screen, Tabs, Text, colors, spacing, useLocale } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { BookingCard } from "@/features/bookings/BookingCard";
import { statusLabelFor } from "@/features/bookings/status";
import { useBookingHistory } from "@/features/account/queries";
import { useMyBookings } from "@/features/customer/queries";
import type { MyBooking } from "@/types/api";
import { joinParts } from "@/lib/format";

type Tab = "upcoming" | "history";

/**
 * My bookings.
 *
 * Two tabs, because "upcoming" and "everything that already happened"
 * are different questions asked at different moments — one to check a
 * time, the other to find a receipt or leave a review. History loads a
 * page at a time.
 *
 * Every card opens the booking (app/booking/[token]), which is where it
 * can be moved, cancelled or reviewed — whatever the server allows.
 */
export default function MyBookingsScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <SignInGate
      title={ar ? "حجوزاتي" : "My bookings"}
      reason={ar ? "عشان تشوف مواعيدك الجاية وتديرها." : "To see your upcoming appointments and manage them."}
    >
      <MyBookings />
    </SignInGate>
  );
}

function MyBookings() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const [tab, setTab] = useState<Tab>("upcoming");
  const upcoming = useMyBookings("upcoming", tab === "upcoming");
  const history = useBookingHistory(tab === "history");

  const isUpcoming = tab === "upcoming";
  const bookings: MyBooking[] = isUpcoming ? (upcoming.data?.bookings ?? []) : (history.data?.pages.flatMap((p) => p.bookings) ?? []);
  const needsPhone = isUpcoming ? upcoming.data?.needsPhone : history.data?.pages[0]?.needsPhone;
  const loading = isUpcoming ? upcoming.isLoading : history.isLoading;
  const error = isUpcoming ? upcoming.error : history.error;
  const refreshing = isUpcoming ? upcoming.isRefetching : history.isRefetching && !history.isFetchingNextPage;
  const refetch = () => (isUpcoming ? upcoming.refetch() : history.refetch());

  return (
    <Screen
      scroll={false}
      hero={
        <>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            {T("حجوزاتي", "My bookings")}
          </Text>
          <Text variant="body" tone="inverseMuted">
            {isUpcoming ? T("مواعيدك الجاية، الأقرب الأول.", "Your upcoming appointments, soonest first.") : T("كل اللي فات، تقدر تقيّمه.", "Everything past, ready to review.")}
          </Text>
          <View style={styles.tabs}>
            <Tabs
              tone="night"
              value={tab}
              onChange={setTab}
              options={[
                { value: "upcoming", label: T("الجاية", "Upcoming") },
                { value: "history", label: T("اللي فات", "Past") },
              ]}
            />
          </View>
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.jade} />}
      >
        <ListState
          loading={loading}
          error={error}
          isEmpty={bookings.length === 0}
          emptyIcon={needsPhone ? "call-outline" : "calendar-clear-outline"}
          emptyTitle={
            needsPhone
              ? T("محتاجين رقم موبايلك", "We need your phone number")
              : isUpcoming
                ? T("مفيش مواعيد جاية", "No upcoming bookings")
                : T("مفيش حاجة فاتت", "Nothing here yet")
          }
          emptyBody={
            needsPhone
              ? T(
                  "الحجوزات بتتربط برقم موبايلك المتأكد منه. ضيفه من حسابك عشان تشوفها هنا.",
                  "Bookings are linked to your verified phone number. Add one in your account to see them here.",
                )
              : isUpcoming
                ? T("لما تحجز مكان هيظهر هنا.", "When you book somewhere, it will show up here.")
                : T("المواعيد اللي خلصت هتظهر هنا.", "Finished appointments will appear here.")
          }
          emptyAction={
            isUpcoming && !needsPhone ? (
              <Button label={T("دوّر على مكان", "Find a place")} onPress={() => router.push("/(customer)/search")} />
            ) : undefined
          }
          onRetry={refetch}
        >
          <View style={styles.list}>
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                title={(!ar && b.business.nameEn) || b.business.nameAr}
                subtitle={(!ar && b.serviceNameEn) || b.serviceName}
                date={b.date}
                startTime={b.startTime}
                endTime={b.endTime}
                status={b.status}
                statusLabel={statusLabelFor(b.status, lang)}
                price={b.totalPrice}
                currency={b.currency}
                // Only on the upcoming tab: "7 months ago" under every row
                // of a history list is noise, not information.
                minutesUntil={isUpcoming ? b.minutesUntil : undefined}
                meta={joinParts([(!ar && b.staffNameEn) || b.staffName, (!ar && b.branchNameEn) || b.branchName], lang) || null}
                onPress={b.accessToken ? () => router.push({ pathname: "/booking/[token]", params: { token: b.accessToken as string } }) : undefined}
              />
            ))}
            {!isUpcoming && history.hasNextPage ? (
              <Button
                variant="outline"
                label={T("حمّل أكتر", "Load more")}
                loading={history.isFetchingNextPage}
                onPress={() => history.fetchNextPage()}
              />
            ) : null}
          </View>
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: spacing.lg },
  scroll: { paddingBottom: spacing.xxl },
  list: { gap: spacing.md },
});
