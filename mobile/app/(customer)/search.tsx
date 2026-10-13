import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, ListState, SearchField, Text, colors, spacing } from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { useBusinesses, type SearchParams } from "@/features/customer/queries";
import { num } from "@/lib/format";

/**
 * Search.
 *
 * A FlatList rather than the usual Screen, because this is the one
 * screen that can show hundreds of rows and nesting a list inside a
 * ScrollView throws away its virtualisation — the symptom being a list
 * that scrolls fine with five results and stutters with two hundred.
 * The search field rides along as the list header so it scrolls with
 * the results instead of pinning a bar over a short list.
 */
export default function Search() {
  // Home opens Search pre-filtered: a category, a city, a sort.
  // `at` is when Home sent them: tapping the same row twice is two
  // arrivals, so a filter cleared in between is applied again.
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    city?: string;
    sort?: string;
    availability?: string;
    label?: string;
    at?: string;
  }>();
  const insets = useSafeAreaInsets();

  const fromParams = () => ({
    category: params.category ?? "",
    city: params.city ?? "",
    sort: (params.sort ?? "recommended") as SearchParams["sort"],
    availability: (params.availability ?? "any") as NonNullable<SearchParams["availability"]>,
    label: params.label ?? "",
  });
  const [filter, setFilter] = useState(fromParams);
  const [term, setTerm] = useState(params.q ?? "");
  const [query, setQuery] = useState(params.q ?? "");

  // Arriving again from Home with different parameters replaces the
  // filter — adjusted while rendering, not in an effect, so the list
  // never draws once with the old filter first.
  const paramsKey = [params.q, params.category, params.city, params.sort, params.availability, params.label, params.at].join("|");
  const [seenKey, setSeenKey] = useState(paramsKey);
  if (seenKey !== paramsKey) {
    setSeenKey(paramsKey);
    setFilter(fromParams());
    // A new arrival is a new search: the last one's words do not carry
    // over into a category Home opened.
    setTerm(params.q ?? "");
    setQuery(params.q ?? "");
  }

  // Debounced: typing "barber" would otherwise be six requests, five of
  // them already stale by the time they land.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term), 350);
    return () => clearTimeout(timer);
  }, [term]);

  const results = useBusinesses({
    q: query,
    category: filter.category,
    city: filter.city,
    sort: filter.sort,
    availability: filter.availability,
  });
  const filtered = Boolean(
    filter.category || filter.city || filter.sort !== "recommended" || filter.availability !== "any",
  );
  const businesses = results.data?.businesses ?? [];

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.ground }]}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: spacing.xxl,
        paddingHorizontal: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      data={businesses}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="title">ابحث</Text>
          <SearchField
            value={term}
            onChangeText={setTerm}
            placeholder="اسم المكان أو الخدمة"
            accessibilityLabel="ابحث عن مكان"
            onSubmit={() => setQuery(term)}
          />
          {filtered ? (
            <View style={styles.filters}>
              <Chip
                label={filter.label || "فلتر"}
                selected
                onPress={() => setFilter({ category: "", city: "", sort: "recommended", availability: "any", label: "" })}
              />
            </View>
          ) : null}
          {!results.isLoading && results.data ? (
            <Text variant="caption" tone="subtle" style={styles.count}>
              {/* The real total from the server, not the page length. */}
              {num(results.data.total)} نتيجة
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <ListState
          loading={results.isLoading}
          error={results.error}
          isEmpty
          emptyTitle={query ? "مفيش نتايج" : "ابدأ البحث"}
          emptyBody={
            query
              ? "جرّب كلمة تانية، أو امسح البحث عشان تشوف كل الأماكن."
              : "اكتب اسم مكان أو خدمة فوق."
          }
          onRetry={() => results.refetch()}
        >
          <></>
        </ListState>
      }
      renderItem={({ item }) => <BusinessCard business={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: { marginBottom: spacing.lg, gap: spacing.md },
  count: { marginTop: spacing.xs },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
