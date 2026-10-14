import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  SearchField,
  SkeletonCard,
  Text,
  Touchable,
  colors,
  spacing,
  useLocale,
} from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { FavoriteButton } from "@/features/discovery/FavoriteButton";
import { FilterSheet, SortSheet } from "@/features/discovery/FilterSheet";
import { availableLabel, priceLabel, ratingLabel, sortLabel } from "@/features/discovery/labels";
import { useSearchResults } from "@/features/discovery/queries";
import { useRecentSearches } from "@/features/discovery/recentSearches";
import {
  MAX_TERM,
  activeFilterCount,
  termProblem,
  toQuery,
  useSearchState,
  type Filters,
} from "@/features/discovery/searchState";
import { useFacets } from "@/features/customer/queries";
import { num } from "@/lib/format";
import type { Business } from "@/types/api";

/**
 * Search.
 *
 * Built for a phone rather than copied from the website's two-column
 * page: the field and one row of controls stay put at the top, every
 * filter lives on one sheet, and results load as the list scrolls.
 *
 * The search itself lives in features/discovery/searchState.ts, outside
 * this screen, so opening a business and coming back — or leaving for
 * another tab — finds it exactly as it was. Home opening Search with a
 * category or a sort replaces it; that is a new search.
 *
 * A FlatList keeps long result sets virtualised.
 */

/** Requests slower than this get a word of explanation. */
const SLOW_MS = 6000;

export default function Search() {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const { term, filters, arrivals, setTerm, setFilters, patchFilters, clearFilters } = useSearchState();
  const recent = useRecentSearches();
  const [focused, setFocused] = useState(false);
  const [sheet, setSheet] = useState<"filters" | "sort" | null>(null);
  const list = useRef<FlatList<Business>>(null);

  // Debounced: "barber" typed is one request, not six.
  const [debounced, setDebounced] = useState(term);

  // A search Home started (features/discovery/searchState.ts startSearch)
  // replaces the typed term at once — this component's own state, so it
  // may be set while rendering — rather than after the debounce, which
  // would send the old word with the new filters first.
  const [seenArrivals, setSeenArrivals] = useState(arrivals);
  if (arrivals !== seenArrivals) {
    setSeenArrivals(arrivals);
    setDebounced(term);
  }
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 350);
    return () => clearTimeout(id);
  }, [term]);

  const problem = termProblem(debounced);
  const query = useMemo(() => toQuery(debounced, filters), [debounced, filters]);
  const results = useSearchResults(query, problem === null);
  const queryKey = JSON.stringify(query);


  const slow = useSlow(results.isFetching && !results.isFetchingNextPage, SLOW_MS);
  const businesses = useMemo(() => results.data?.pages.flatMap((p) => p.businesses) ?? [], [results.data]);
  const total = results.data?.pages[0]?.total ?? 0;
  const filterCount = activeFilterCount(filters);
  const chips = useActiveChips(filters, lang);

  const showRecent = focused && term.trim() === "" && recent.recent.length > 0;

  const openBusiness = (b: Business) => {
    if (debounced.trim().length >= 2) recent.add(debounced);
    router.push({ pathname: "/business/[slug]", params: { slug: b.slug } });
  };

  return (
    <View style={styles.page}>
      {/* ── Fixed top: the field on night, then one row of controls ── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <Text variant="display" tone="inverse" accessibilityRole="header">
          {T("ابحث", "Search")}
        </Text>
        <SearchField
          value={term}
          onChangeText={setTerm}
          placeholder={T("اسم مكان، خدمة أو منطقة", "A place, service or area")}
          onSubmit={() => {
            setDebounced(term);
            recent.add(term);
          }}
          onFocus={() => setFocused(true)}
          // After a beat: on the web, blur fires before the click on a
          // recent search, which would hide the row being tapped.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          maxLength={MAX_TERM}
        />
      </View>
      <View style={styles.top}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.controls} keyboardShouldPersistTaps="handled">
          <Chip
            label={filterCount > 0 ? T(`الفلاتر (${filterCount})`, `Filters (${filterCount})`) : T("الفلاتر", "Filters")}
            icon="options-outline"
            selected={filterCount > 0}
            onPress={() => setSheet("filters")}
          />
          <Chip
            label={sortLabel(filters.sort, lang)}
            icon="swap-vertical"
            selected={filters.sort !== "recommended"}
            onPress={() => setSheet("sort")}
          />
          {chips.map((c) => (
            <Chip key={c.key} label={c.label} icon="close" onPress={() => patchFilters(c.clear)} />
          ))}
        </ScrollView>
      </View>

      {showRecent ? (
        <View style={styles.recent}>
          <View style={styles.recentHead}>
            <Text variant="label">{T("عمليات بحث سابقة", "Recent searches")}</Text>
            <Text variant="label" tone="jade" accessibilityRole="button" onPress={recent.clear}>
              {T("مسح", "Clear")}
            </Text>
          </View>
          {recent.recent.map((r) => (
            <Touchable
              key={r}
              accessibilityRole="button"
              accessibilityLabel={T(`ابحث عن ${r}`, `Search for ${r}`)}
              onPress={() => {
                setTerm(r);
                setDebounced(r);
              }}
              style={styles.recentRow}
            >
              <Icon name="time-outline" size="sm" color={colors.subtle} />
              <Text variant="body" style={styles.flex} numberOfLines={1}>
                {r}
              </Text>
            </Touchable>
          ))}
        </View>
      ) : null}

      <FlatList
        // One list per search. A new search starts at the top, and a
        // virtualised list scrolled deep into the last one's pages never
        // keeps drawing that one's cards over the new (still loading) one.
        key={queryKey}
        ref={list}
        style={[styles.flex, showRecent && styles.hidden]}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={problem ? [] : businesses}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={Separator}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage && !results.isFetchNextPageError) results.fetchNextPage();
        }}
        ListHeaderComponent={
          !problem && results.data ? (
            <View>
              <View style={styles.countRow} accessibilityLiveRegion="polite">
                <Text variant="caption" tone="subtle">
                  {/* The server's total, not the length of what has loaded. */}
                  {T(`${num(total, lang)} مكان`, `${num(total, lang)} ${total === 1 ? "place" : "places"}`)}
                </Text>
                {results.isFetching && !results.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.jade} /> : null}
              </View>
              {/* A refresh of results already shown, taking long. */}
              {slow ? <SlowNote /> : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          problem === "too-short" ? (
            <EmptyState icon="search" title={T("اكتب حرفين على الأقل", "Type at least two letters")} />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : results.isLoading ? (
            <View style={styles.skeletons}>
              {slow ? <SlowNote /> : null}
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </View>
          ) : (
            <EmptyState
              icon="search-outline"
              title={T("مفيش أماكن مطابقة", "No places match")}
              body={
                filterCount > 0
                  ? T("جرّب تشيل فلتر أو اتنين.", "Try removing a filter or two.")
                  : T("جرّب كلمة تانية.", "Try another word.")
              }
              action={
                <View style={styles.emptyActions}>
                  {filterCount > 0 ? <Button label={T("امسح الفلاتر", "Clear filters")} onPress={clearFilters} /> : null}
                  {debounced.trim() ? (
                    <Button label={T("امسح البحث", "Clear search")} variant="outline" onPress={() => setTerm("")} />
                  ) : null}
                </View>
              }
            />
          )
        }
        ListFooterComponent={
          businesses.length === 0 || problem ? null : results.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.jade} accessibilityLabel={T("بيحمّل المزيد", "Loading more")} />
            </View>
          ) : results.isFetchNextPageError ? (
            <View style={styles.footer}>
              <Text variant="caption" tone="danger" align="center">
                {T("ما قدرناش نحمّل الباقي.", "Couldn't load more.")}
              </Text>
              <Button label={T("حاول تاني", "Try again")} variant="outline" size="sm" onPress={() => results.fetchNextPage()} />
            </View>
          ) : !results.hasNextPage ? (
            <Text variant="caption" tone="subtle" align="center" style={styles.footer}>
              {results.data?.pages[0]?.capped
                ? T(
                    `دي أول ${num(businesses.length, lang)} نتيجة بالترتيب ده. ضيّق البحث عشان تشوف الباقي.`,
                    `These are the first ${num(businesses.length, lang)} in this order. Narrow the search to see the rest.`,
                  )
                : T("ده كل اللي لقيناه.", "That's everything.")}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <BusinessCard
            business={item}
            onPress={() => openBusiness(item)}
            trailing={<FavoriteButton businessId={item.id} name={(!ar && item.nameEn) || item.nameAr} />}
          />
        )}
      />

      <FilterSheet
        open={sheet === "filters"}
        onClose={() => setSheet(null)}
        value={filters}
        onApply={(f) => {
          setFilters(f);
          setSheet(null);
        }}
      />
      <SortSheet
        open={sheet === "sort"}
        onClose={() => setSheet(null)}
        value={filters.sort}
        onChange={(sort) => {
          patchFilters({ sort });
          setSheet(null);
        }}
      />
    </View>
  );
}

function Separator() {
  return <View style={{ height: spacing.md }} />;
}

function SlowNote() {
  const { lang } = useLocale();
  return (
    <Text variant="caption" tone="subtle" align="center" accessibilityLiveRegion="polite">
      {lang === "ar" ? "بياخد وقت أكتر من العادي… لسه بندوّر." : "Taking longer than usual… still looking."}
    </Text>
  );
}

/** True once `active` has stayed true for `ms`. */
function useSlow(active: boolean, ms: number) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setSlow(true), ms);
    return () => {
      clearTimeout(id);
      setSlow(false);
    };
  }, [active, ms]);
  return active && slow;
}

/** One removable chip per applied filter, named from the facets. */
function useActiveChips(f: Filters, lang: "ar" | "en") {
  const facets = useFacets(f.city || undefined);
  const ar = lang === "ar";
  const nameOf = (x?: { nameAr: string; nameEn: string }) => (x ? (ar ? x.nameAr : x.nameEn) : null);
  const cats = facets.data?.categories ?? [];
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];

  if (f.subcategory || f.category) {
    const parent = cats.find((c) => c.slug === f.category);
    const child = parent?.children.find((c) => c.slug === f.subcategory) ?? cats.flatMap((c) => c.children).find((c) => c.slug === f.subcategory);
    chips.push({ key: "category", label: nameOf(child) ?? nameOf(parent) ?? (f.subcategory || f.category), clear: { category: "", subcategory: "" } });
  }
  if (f.city) {
    const city = facets.data?.cities.find((c) => c.slug === f.city);
    const hood = facets.data?.neighborhoods.find((n) => n.slug === f.neighborhood);
    const label = [nameOf(hood), nameOf(city) ?? f.city].filter(Boolean).join(ar ? "، " : ", ");
    chips.push({ key: "city", label, clear: { city: "", neighborhood: "" } });
  }
  if (f.available !== "any") chips.push({ key: "available", label: availableLabel(f.available, lang), clear: { available: "any" } });
  if (f.rating) chips.push({ key: "rating", label: ratingLabel(f.rating, lang), clear: { rating: 0 } });
  const price = priceLabel(f.minPrice, f.maxPrice, lang);
  if (price) chips.push({ key: "price", label: price, clear: { minPrice: null, maxPrice: null } });
  if (f.verified) chips.push({ key: "verified", label: ar ? "موثّق" : "Verified", clear: { verified: false } });
  if (f.instant) chips.push({ key: "instant", label: ar ? "تأكيد فوري" : "Instant", clear: { instant: false } });
  if (f.online) chips.push({ key: "online", label: ar ? "دفع أونلاين" : "Pay online", clear: { online: false } });
  return chips;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  hero: {
    backgroundColor: colors.night,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomStartRadius: 28,
    borderBottomEndRadius: 28,
  },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  controls: { gap: spacing.sm, paddingVertical: spacing.xs },
  flex: { flex: 1 },
  hidden: { display: "none" },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  countRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  skeletons: { gap: spacing.md, paddingTop: spacing.sm },
  emptyActions: { gap: spacing.sm, alignSelf: "stretch" },
  footer: { paddingVertical: spacing.xl, gap: spacing.sm, alignItems: "center" },
  recent: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  recentHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.sm },
  recentRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
});

