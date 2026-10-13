import { useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListState } from "@/components/ui/ListState";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { BookingCard } from "@/features/bookings/BookingCard";
import { useBusinesses, useMyBookings } from "@/features/customer/queries";
import { useAuth } from "@/features/auth/AuthProvider";
import { spacing } from "@/constants/theme";

/**
 * Home.
 *
 * Answers the two questions somebody opens this app with: do I have an
 * appointment soon, and where can I book one. The next appointment goes
 * first because it is the one thing that is time-critical — everything
 * else can wait a scroll.
 *
 * Only real data. If there are five businesses, it shows five; there is
 * no filler row and no "popular near you" built out of nothing.
 */
export default function CustomerHome() {
  const router = useRouter();
  const { user } = useAuth();
  const upcoming = useMyBookings("upcoming");
  const businesses = useBusinesses();

  const next = upcoming.data?.bookings[0];
  const firstName = user?.name?.trim().split(" ")[0];

  return (
    <Screen>
      <Text variant="display">{firstName ? `أهلاً ${firstName}` : "أهلاً بيك"}</Text>
      <Text variant="body" tone="muted" style={styles.subtitle}>
        احجز موعدك في ثوانٍ.
      </Text>

      {/* ── The next appointment, when there is one ── */}
      {next ? (
        <View style={styles.section}>
          <Text variant="heading" style={styles.sectionTitle}>
            موعدك الجاي
          </Text>
          <BookingCard
            title={next.business.nameAr}
            subtitle={next.serviceName}
            date={next.date}
            startTime={next.startTime}
            endTime={next.endTime}
            status={next.status}
            price={next.totalPrice}
            currency={next.currency}
            minutesUntil={next.minutesUntil}
            onPress={() => router.push("/(customer)/bookings")}
          />
        </View>
      ) : null}

      {/* ── Somewhere to book ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="heading">أماكن تحجز فيها</Text>
          <Button
            label="اتصفح الكل"
            variant="ghost"
            onPress={() => router.push("/(customer)/search")}
          />
        </View>

        <ListState
          loading={businesses.isLoading}
          error={businesses.error}
          isEmpty={(businesses.data?.businesses.length ?? 0) === 0}
          emptyTitle="لسه مفيش أماكن"
          emptyBody="أول ما تتضاف أماكن هتلاقيها هنا."
          onRetry={() => businesses.refetch()}
        >
          <View style={styles.list}>
            {/* Six, not "featured": there is no ranking behind it and
                calling it one would be a claim nothing supports. */}
            {businesses.data?.businesses.slice(0, 6).map((b) => (
              <BusinessCard
                key={b.id}
                business={b}
                onPress={() => router.push(`/(customer)/search?q=${encodeURIComponent(b.nameAr)}`)}
              />
            ))}
          </View>
        </ListState>
      </View>

      {/* Shown only when the account genuinely cannot hold bookings. */}
      {upcoming.data?.needsPhone ? (
        <Card>
          <Text variant="bodyBold">ضيف رقم موبايلك</Text>
          <Text variant="caption" tone="muted" style={styles.hint}>
            حجوزاتك بتترّبط برقمك، فمن غيره مش هنعرف نعرضها هنا.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: spacing.xs },
  section: { marginTop: spacing.xxl },
  sectionTitle: { marginBottom: spacing.md },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  list: { gap: spacing.md },
  hint: { marginTop: spacing.xs },
});
