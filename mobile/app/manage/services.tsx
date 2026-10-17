import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Card, EmptyState, ErrorState, SkeletonCard, Text, TopBar, colors, spacing, useLocale } from "@/design";
import { pick } from "@/features/business/components";
import { useServices } from "@/features/business/queries";
import { duration, money } from "@/lib/format";
import { count } from "@/lib/plural";

/**
 * The menu of services, to answer a customer at the counter: what it is,
 * how long, how much, and whether it is being offered right now. Edited
 * on the web dashboard.
 */
export default function ServicesScreen() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const services = useServices();
  const list = services.data ?? [];

  return (
    <View style={styles.page}>
      <TopBar title={T("الخدمات", "Services")} subtitle={services.data ? count(list.length, "service", lang) : undefined} back backTo="/(business)/account" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={services.isRefetching} onRefresh={() => services.refetch()} tintColor={colors.jade} />}
      >
        {services.isLoading ? (
          <SkeletonCard />
        ) : services.error ? (
          <ErrorState error={services.error} onRetry={() => services.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState icon="pricetags-outline" title={T("لسه مفيش خدمات", "No services yet")} />
        ) : (
          list.map((s) => (
            <Card key={s.id} style={!s.isAvailable ? styles.off : undefined}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text variant="bodyBold">{pick(lang, s.nameAr, s.nameEn)}</Text>
                  <Text variant="caption" tone="subtle">
                    {duration(s.duration, lang)}
                  </Text>
                </View>
                <Text variant="bodyBold" style={{ color: colors.night }}>
                  {money(Number(s.price), "EGP", lang) ?? "—"}
                </Text>
              </View>
              {s.descriptionAr ? (
                <Text variant="caption" tone="muted" numberOfLines={3} style={styles.desc}>
                  {s.descriptionAr}
                </Text>
              ) : null}
              {!s.isAvailable ? <Badge label={T("مش متاحة دلوقتي", "Not offered now")} tone="neutral" /> : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  desc: { marginTop: spacing.sm },
  // Not faded: the badge says it isn't offered; fading took the text under 4.5:1.
  off: { backgroundColor: colors.surface2 },
});
