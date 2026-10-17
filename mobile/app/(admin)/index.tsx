import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Screen, Text, Card, ListState, colors, spacing, useLocale } from "@/design";
import { useAdminOverview } from "@/features/admin/queries";

/**
 * Does anything need an admin right now? The same figures as the web
 * admin's landing page, from the same function. A figure the role may
 * not see is absent rather than zero.
 */
export default function AdminOverviewScreen() {
  const query = useAdminOverview();
  const d = query.data;
  const { lang } = useLocale();
  const T = (a: string, e: string) => (lang === "ar" ? a : e);

  const tiles: { label: string; value: number | null | undefined }[] = [
    { label: T("أعمال بانتظار المراجعة", "Businesses awaiting review"), value: d?.pendingBusinesses },
    { label: T("بلاغات مفتوحة", "Open reports"), value: d?.openReports },
    { label: T("تقييمات تحت المراجعة", "Reviews under review"), value: d?.reviewsUnderReview },
    { label: T("أعمال موقوفة", "Suspended businesses"), value: d?.suspendedBusinesses },
    { label: T("كل الأعمال", "All businesses"), value: d?.totalBusinesses },
    { label: T("حجوزات مدفوعة", "Paid bookings"), value: d?.paidBookings },
  ];
  const visible = tiles.filter((t): t is { label: string; value: number } => typeof t.value === "number");

  return (
    <Screen
      scroll={false}
      hero={
        <>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            {T("نظرة عامة", "Overview")}
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {T("التفاصيل والإجراءات على لوحة الإدارة في الموقع.", "Details and actions are in the admin dashboard on the website.")}
          </Text>
        </>
      }
    >
      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} tintColor={colors.jade} />
        }
      >
        <ListState
          loading={query.isLoading}
          error={query.error}
          isEmpty={visible.length === 0}
          emptyTitle={T("مفيش أرقام متاحة لصلاحيتك", "No figures available for your role")}
          onRetry={() => query.refetch()}
        >
          {visible.map((t) => (
            <View key={t.label} style={styles.tile}>
              <Card accessibilityLabel={`${t.label}: ${t.value}`}>
                <Text variant="display">{t.value}</Text>
                <Text variant="caption" tone="subtle">
                  {t.label}
                </Text>
              </Card>
            </View>
          ))}
        </ListState>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.lg },
  tile: { flexBasis: "47%", flexGrow: 1 },
});
