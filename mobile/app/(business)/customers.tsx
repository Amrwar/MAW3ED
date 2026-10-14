import { useEffect, useState } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, ListState, SearchField, Text, colors, spacing } from "@/design";
import { useBusinessCustomers } from "@/features/business/queries";
import { money, num, shortDate } from "@/lib/format";

/**
 * The customer book.
 *
 * A list that grows without limit, so it is a FlatList — the same
 * reason search is one. Search runs on the server, not over a slice
 * already fetched, because filtering the first page client-side quietly
 * hides everybody on page two.
 */
export default function Customers() {
  const insets = useSafeAreaInsets();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const query = useBusinessCustomers(search);
  const customers = query.data?.customers ?? [];

  return (
    <View style={[styles.list, { backgroundColor: colors.ground }]}>
      {/* Bold Cairo: title, count and search on a night block that stays put. */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.titleRow}>
          <Text variant="display" tone="inverse" accessibilityRole="header">
            العملاء
          </Text>
          {query.data ? (
            <Text variant="title" style={{ color: colors.gold }}>
              {num(query.data.total)}
            </Text>
          ) : null}
        </View>
        <SearchField
          value={term}
          onChangeText={setTerm}
          placeholder="اسم أو رقم"
          accessibilityLabel="ابحث في العملاء"
          onSubmit={() => setSearch(term)}
        />
      </View>
      <FlatList
        style={styles.list}
        contentContainerStyle={{
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
        data={customers}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <ListState
            loading={query.isLoading}
            error={query.error}
            isEmpty
            emptyTitle={search ? "مفيش نتايج" : "لسه مفيش عملاء"}
            emptyBody={search ? "جرّب اسم أو رقم تاني." : "أول ما حد يحجز هيتسجل هنا تلقائي."}
            onRetry={() => query.refetch()}
          >
            <></>
          </ListState>
        }
        renderItem={({ item }) => (
          <Card>
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
                  {/* Spend can be zero and that is a real number here —
                    unlike a price, where zero would be a lie. */}
                  {money(item.totalSpend, item.currency) ?? "—"}
                </Text>
                <Text variant="caption" tone="subtle">
                  {num(item.bookingCount)} حجز
                </Text>
              </View>
            </View>

            {item.lastBookingDate ? (
              <Text variant="caption" tone="muted" style={styles.last}>
                آخر زيارة: {shortDate(item.lastBookingDate)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  hero: {
    backgroundColor: colors.night,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  who: { flex: 1, gap: 2 },
  stats: { alignItems: "flex-end", gap: 2 },
  last: { marginTop: spacing.md },
  notes: { marginTop: spacing.xs },
});
