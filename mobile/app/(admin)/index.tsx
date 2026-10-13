import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Typography";
import { Card } from "@/components/ui/Card";
import { ListState } from "@/components/ui/ListState";
import { useAdminOverview } from "@/features/admin/queries";
import { colors, spacing } from "@/constants/theme";

/**
 * Does anything need an admin right now? The same figures as the web
 * admin's landing page, from the same function. A figure the role may
 * not see is absent rather than zero.
 */
export default function AdminOverviewScreen() {
  const query = useAdminOverview();
  const d = query.data;

  const tiles: { label: string; value: number | null | undefined }[] = [
    { label: "أعمال بانتظار المراجعة", value: d?.pendingBusinesses },
    { label: "بلاغات مفتوحة", value: d?.openReports },
    { label: "تقييمات تحت المراجعة", value: d?.reviewsUnderReview },
    { label: "أعمال موقوفة", value: d?.suspendedBusinesses },
    { label: "كل الأعمال", value: d?.totalBusinesses },
    { label: "حجوزات مدفوعة", value: d?.paidBookings },
  ];
  const visible = tiles.filter((t): t is { label: string; value: number } => typeof t.value === "number");

  return (
    <Screen scroll={false}>
      <Text variant="title">نظرة عامة</Text>
      <Text variant="caption" tone="subtle">
        التفاصيل والإجراءات على لوحة الإدارة في الموقع.
      </Text>
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
          emptyTitle="مفيش أرقام متاحة لصلاحيتك"
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
