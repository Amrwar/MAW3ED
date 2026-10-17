import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, ErrorState, SkeletonCard, Tabs, Text, TopBar, colors, radius, spacing, useLocale } from "@/design";
import { addDays, cairoToday } from "@/design/calendar";
import { useBusinessAccess } from "@/features/business/access";
import { useAnalytics } from "@/features/business/queries";
import { money, num } from "@/lib/format";

/**
 * Basic reports, for the owner: bookings and completed revenue over a
 * week, a month or three, and which services carry them. The same
 * analytics the web dashboard draws (GET /api/business/analytics), so
 * the phone and the laptop cannot disagree. Every figure is measured;
 * nothing is projected.
 */

type Range = "7" | "30" | "90";

export default function Reports() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const access = useBusinessAccess();
  const [range, setRange] = useState<Range>("30");
  const to = useMemo(() => cairoToday(), []);
  const from = addDays(to, -(Number(range) - 1));
  const allowed = access.can("reports.read");
  const analytics = useAnalytics(from, to, allowed);
  const a = analytics.data;
  const fmt = (n: number) => (a ? (money(n, a.kpis.currency, lang) ?? "—") : "—");
  const top = (a?.bookingsByService ?? []).slice(0, 6);
  const max = Math.max(1, ...top.map((s) => s.bookings));

  return (
    <View style={styles.page}>
      <TopBar title={T("التقارير", "Reports")} back backTo="/(business)/account">
        {/* No period to pick when there are no figures to show. */}
        {allowed ? (
          <Tabs
            tone="night"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: T("7 أيام", "7 days") },
              { value: "30", label: T("30 يوم", "30 days") },
              { value: "90", label: T("90 يوم", "90 days") },
            ]}
          />
        ) : null}
      </TopBar>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={analytics.isRefetching} onRefresh={() => analytics.refetch()} tintColor={colors.jade} />}
      >
        {!allowed ? (
          <EmptyState icon="lock-closed-outline" title={T("التقارير لصاحب النشاط بس", "Reports are for the owner")} />
        ) : analytics.isLoading ? (
          <SkeletonCard />
        ) : analytics.error || !a ? (
          <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} />
        ) : (
          <>
            <View style={styles.grid}>
              <Kpi label={T("الحجوزات", "Bookings")} value={num(a.kpis.totalBookings, lang)} />
              <Kpi label={T("إيراد مكتمل", "Completed revenue")} value={fmt(a.kpis.completedRevenue)} />
              <Kpi label={T("متوسط الحجز", "Average booking")} value={fmt(a.kpis.avgBookingValue)} />
              <Kpi label={T("عملاء رجعوا تاني", "Returning customers")} value={`${num(Math.round(a.kpis.repeatCustomerRate * 100), lang)}%`} />
            </View>

            <Card>
              <Text variant="label" tone="ink2" accessibilityRole="header">
                {T("أكتر الخدمات حجزاً", "Most booked services")}
              </Text>
              {top.length === 0 ? (
                <Text variant="caption" tone="subtle">
                  {T("مفيش حجوزات في الفترة دي.", "No bookings in this period.")}
                </Text>
              ) : (
                top.map((s) => (
                  <View key={s.serviceName} style={styles.bar} accessibilityLabel={`${s.serviceName}: ${s.bookings}`}>
                    <View style={styles.barHead}>
                      <Text variant="body" numberOfLines={1} style={styles.flex}>
                        {s.serviceName}
                      </Text>
                      <Text variant="label">{num(s.bookings, lang)}</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${(s.bookings / max) * 100}%` }]} />
                    </View>
                  </View>
                ))
              )}
            </Card>
            <Text variant="caption" tone="subtle" align="center">
              {T("تقارير أكتر على لوحة التحكم في الموقع.", "More reports on the web dashboard.")}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.kpi}>
      <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="subtle">
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  kpi: { width: "48%", flexGrow: 1, gap: spacing.xxs },
  bar: { gap: spacing.xs, marginTop: spacing.md },
  barHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  track: { height: 8, borderRadius: radius.full, backgroundColor: colors.surface3, overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.full, backgroundColor: colors.night },
});
