import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Avatar, Card, Header, ListState, Screen, Text, colors, spacing, useLocale } from "@/design";
import { SignInGate } from "@/features/auth/SignInGate";
import { useMyReviews } from "@/features/account/queries";
import { Stars } from "@/features/booking/components";
import { longDate, shortDate } from "@/lib/format";

/**
 * The reviews you have written, newest first, with the business's
 * reply where there is one. Writing one starts from a completed booking
 * (My bookings → the booking), the only place a review can come from.
 */
export default function MyReviewsScreen() {
  const { lang } = useLocale();
  return (
    <SignInGate title={lang === "ar" ? "تقييماتي" : "My reviews"} reason={lang === "ar" ? "عشان تشوف تقييماتك." : "To see your reviews."}>
      <Reviews />
    </SignInGate>
  );
}

function Reviews() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const query = useMyReviews();
  const reviews = query.data?.reviews ?? [];

  return (
    <Screen scroll={false} edges="both"
      hero={<Header title={T("تقييماتي", "My reviews")} back tone="night" />}
    >
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.jade} />}
      >
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={reviews.length === 0}
          emptyIcon="star-outline"
          emptyTitle={T("لسه مكتبتش تقييمات", "No reviews yet")}
          emptyBody={T(
            "بعد ما زيارتك تخلص، افتح الحجز من حجوزاتي وقيّمها.",
            "Once a visit is completed, open it from My bookings to rate it.",
          )}
          onRetry={() => query.refetch()}
        >
          {reviews.map((r) => (
            <Card key={r.id} onPress={() => router.push(`/business/${r.business.slug}`)} accessibilityLabel={`${r.business.nameAr}, ${r.rating}/5`}>
              <View style={styles.head}>
                <Avatar name={r.business.nameAr} uri={r.business.logoImage} size="sm" shape="rounded" />
                <View style={styles.flex}>
                  <Text variant="bodyBold">{r.business.nameAr}</Text>
                  <Text variant="caption" tone="subtle">
                    {r.serviceName} · {longDate(r.date, lang)}
                  </Text>
                </View>
                <Stars value={r.rating} />
              </View>
              {r.comment ? (
                <Text variant="body" tone="ink2" style={styles.gap}>
                  {r.comment}
                </Text>
              ) : null}
              {r.response ? (
                <View style={styles.response}>
                  <Text variant="caption" tone="subtle">
                    {T("رد المكان", "Business response")}
                    {r.respondedAt ? ` · ${shortDate(r.respondedAt.slice(0, 10), lang)}` : ""}
                  </Text>
                  <Text variant="body" tone="ink2">
                    {r.response}
                  </Text>
                </View>
              ) : null}
            </Card>
          ))}
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.md, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  gap: { marginTop: spacing.sm },
  response: { marginTop: spacing.sm, paddingStart: spacing.md, borderStartWidth: 2, borderStartColor: colors.line2, gap: spacing.xxs },
});
