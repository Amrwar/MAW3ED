import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListState, SearchField, Tabs, TopBar, colors, spacing, useLocale } from "@/design";
import { useOrganizations, useVenues } from "@/features/places/queries";
import { PlaceRow, kindLabel } from "@/features/places/PlaceRow";

/**
 * Malls, groups and venues: the organizations whose directories list
 * businesses, and the physical places (malls, office parks) that host
 * them. From here into one, and from it into a business to book — the
 * same pages the website has at /groups and /venues.
 */
type TabKey = "groups" | "venues";

export default function PlacesScreen() {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const insets = useSafeAreaInsets();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(initialTab === "venues" ? "venues" : "groups");
  const [q, setQ] = useState("");
  const orgs = useOrganizations();
  const venues = useVenues();
  const active = tab === "groups" ? orgs : venues;
  const name = (x: { nameAr: string; nameEn: string | null }) => (lang === "en" && x.nameEn) || x.nameAr;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const hit = (x: { nameAr: string; nameEn: string | null }) => !s || x.nameAr.toLowerCase().includes(s) || (x.nameEn ?? "").toLowerCase().includes(s);
    return tab === "groups"
      ? (orgs.data?.organizations ?? []).filter(hit).map((o) => ({
          key: o.slug, name: name(o), city: o.city ? name({ nameAr: o.city.nameAr, nameEn: o.city.nameEn }) : null,
          logo: o.logoImage, businesses: o.businesses, kind: kindLabel(o.kind, lang),
          open: () => router.push({ pathname: "/org/[slug]", params: { slug: o.slug } }),
        }))
      : (venues.data?.venues ?? []).filter(hit).map((v) => ({
          key: v.slug, name: name(v), city: v.city ? name({ nameAr: v.city.nameAr, nameEn: v.city.nameEn }) : null,
          logo: v.logoImage, businesses: v.businesses, kind: kindLabel(v.kind, lang),
          open: () => router.push({ pathname: "/venue/[slug]", params: { slug: v.slug } }),
        }));
    // name() reads lang; both are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, q, orgs.data, venues.data, lang]);

  return (
    <View style={styles.page}>
      <TopBar title={T("المولات والمجموعات", "Malls and groups")} back backTo="/">
        <Tabs
          tone="night"
          value={tab}
          onChange={setTab}
          options={[
            { value: "groups", label: T("مولات ومجموعات", "Malls & groups") },
            { value: "venues", label: T("أماكن", "Venues") },
          ]}
          testIDPrefix="places-tab"
        />
      </TopBar>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={active.isRefetching} onRefresh={() => active.refetch()} tintColor={colors.jade} />}
      >
        <SearchField value={q} onChangeText={setQ} placeholder={T("دوّر باسم المكان", "Search by name")} accessibilityLabel={T("دوّر", "Search")} />
        <ListState
          loading={active.isLoading}
          error={active.error}
          isEmpty={rows.length === 0}
          emptyTitle={q ? T("مفيش نتيجة", "No match") : T("لسه مفيش أماكن هنا", "Nothing here yet")}
          emptyBody={q ? T("جرّب اسم تاني.", "Try another name.") : T("أول ما مول أو مجموعة تنضم لموعد هتلاقيها هنا.", "Malls and groups appear here as they join Maw3ed.")}
          emptyIcon="business-outline"
          onRetry={() => active.refetch()}
        >
          <View style={styles.list}>
            {rows.map((r) => (
              <PlaceRow key={r.key} name={r.name} city={r.city} logo={r.logo} businesses={r.businesses} kindLabel={r.kind} onPress={r.open} testID={`place-${r.key}`} />
            ))}
          </View>
        </ListState>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface2 },
  body: { padding: spacing.lg, gap: spacing.lg },
  list: { gap: spacing.md },
});
