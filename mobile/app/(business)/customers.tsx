import { useEffect, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, Icon, ListState, SearchField, Text, colors, spacing, useLocale } from "@/design";
import { useBusinessAccess } from "@/features/business/access";
import { useBusinessCustomers } from "@/features/business/queries";
import { money, num, shortDate } from "@/lib/format";

/**
 * The customer book, for the owner and managers.
 *
 * A list that grows without limit, so it is a FlatList. Search runs on
 * the server, not over a page already fetched, because filtering page
 * one on the phone quietly hides everybody on page two. Each customer
 * opens their file (app/manage/customer/[id].tsx).
 *
 * A provider has no customer book — the tab is hidden for them, and the
 * server refuses the request if it is made anyway.
 */
export default function Customers() {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const access = useBusinessAccess();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const allowed = access.can("customers.read");
  const query = useBusinessCustomers(search, allowed);
  const customers = allowed ? (query.data?.customers ?? []) : [];

  return (
    <View style={styles.list}>
      {/* Title, count and search on a night block that stays put. */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            {T("العملاء", "Customers")}
          </Text>
          {allowed && query.data ? (
            <Text variant="title" style={{ color: colors.gold }}>
              {num(query.data.total, lang)}
            </Text>
          ) : null}
        </View>
        {allowed ? (
          <SearchField
            value={term}
            onChangeText={setTerm}
            placeholder={T("اسم أو رقم", "Name or phone")}
            accessibilityLabel={T("ابحث في العملاء", "Search customers")}
            onSubmit={() => setSearch(term)}
          />
        ) : null}
      </View>

      {!allowed ? (
        <EmptyState icon="lock-closed-outline" title={T("دفتر العملاء لصاحب النشاط والمديرين", "The customer book is for the owner and managers")} />
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          data={customers}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <ListState
              loading={query.isLoading}
              error={query.error}
              isEmpty
              emptyTitle={search ? T("مفيش نتايج", "No matches") : T("لسه مفيش عملاء", "No customers yet")}
              emptyBody={search ? T("جرّب اسم أو رقم تاني.", "Try another name or number.") : T("أول ما حد يحجز هيتسجل هنا تلقائي.", "Everyone who books is added here.")}
              onRetry={() => query.refetch()}
            >
              <></>
            </ListState>
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: "/manage/customer/[id]", params: { id: item.id } })} accessibilityLabel={`${item.name}، ${item.phone}`}>
              <View style={styles.row}>
                <View style={styles.who}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text variant="caption" tone="subtle">
                    {item.phone}
                  </Text>
                </View>
                <View style={styles.stats}>
                  <Text variant="label" tone="jade">
                    {/* Spend can be zero and that is a real number here. */}
                    {money(item.totalSpend, item.currency, lang) ?? "—"}
                  </Text>
                  <Text variant="caption" tone="subtle">
                    {T(`${num(item.bookingCount, lang)} حجز`, `${item.bookingCount} bookings`)}
                  </Text>
                </View>
                <Icon name="chevron-forward" color={colors.faint} />
              </View>
              {item.lastBookingDate ? (
                <Text variant="caption" tone="muted" style={styles.last}>
                  {T(`آخر زيارة: ${shortDate(item.lastBookingDate, "ar")}`, `Last visit: ${shortDate(item.lastBookingDate, "en")}`)}
                </Text>
              ) : null}
              {item.notes ? (
                <Text variant="caption" tone="muted" style={styles.notes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.ground },
  hero: {
    backgroundColor: colors.night,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28,
  },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  who: { flex: 1, gap: spacing.xxs },
  stats: { alignItems: "flex-end", gap: spacing.xxs },
  last: { marginTop: spacing.sm },
  notes: { marginTop: spacing.xs },
});
