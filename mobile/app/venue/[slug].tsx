import { useMemo, useState } from "react";
import { Image, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Chip, EmptyState, ErrorState, SkeletonCard, Text, TopBar, colors, radius, spacing, useLocale } from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { useVenue } from "@/features/places/queries";
import { businessRoute, categoriesOf, filterEntries, SLUG } from "@/features/places/logic";
import { entryCard, kindLabel } from "@/features/places/PlaceRow";
import { ApiError } from "@/lib/api/errors";
import { sized } from "@/lib/image";
import type { VenueDetail } from "@/types/places";

/**
 * One venue — a mall, an office park — and the businesses in it, by floor
 * and category, with its hours and the organization that runs it. A
 * visitor pass, where the venue offers them, belongs to a booking: it is
 * asked for from the booking's own screen, never here.
 */
export default function VenueScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const valid = typeof slug === "string" && SLUG.test(slug);
  const q = useVenue(valid ? slug : undefined);
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);

  if (!valid || (q.error instanceof ApiError && q.error.status === 404)) {
    return (
      <View style={styles.page}>
        <TopBar title={T("مش موجود", "Not found")} back backTo="/places" />
        <EmptyState icon="business-outline" title={T("المكان ده مش موجود", "This venue doesn't exist")} action={<Button label={T("الأماكن", "Venues")} onPress={() => router.replace({ pathname: "/places", params: { tab: "venues" } })} />} />
      </View>
    );
  }
  if (q.isLoading) {
    return (
      <View style={styles.page}>
        <TopBar title={T("بنحمّل…", "Loading…")} back backTo="/places" />
        <View style={styles.body}><SkeletonCard /><SkeletonCard /></View>
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={styles.page}>
        <TopBar title={T("الأماكن", "Venues")} back backTo="/places" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </View>
    );
  }
  return <Venue v={q.data.venue} refreshing={q.isRefetching} onRefresh={() => q.refetch()} />;
}

const DAYS: [string, string][] = [["الأحد", "Sun"], ["الاتنين", "Mon"], ["التلات", "Tue"], ["الأربع", "Wed"], ["الخميس", "Thu"], ["الجمعة", "Fri"], ["السبت", "Sat"]];

function Venue({ v, refreshing, onRefresh }: { v: VenueDetail; refreshing: boolean; onRefresh: () => void }) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const nm = (x: { nameAr: string; nameEn: string | null }) => (lang === "en" && x.nameEn) || x.nameAr;
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<string | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const cats = useMemo(() => categoriesOf(v.directory), [v.directory]);
  const zones = useMemo(() => v.zones.filter((z) => v.directory.some((e) => e.zone?.id === z.id)), [v.zones, v.directory]);
  const shown = useMemo(() => filterEntries(v.directory, { category, zone }), [v.directory, category, zone]);
  const name = nm(v);
  const description = lang === "en" ? v.descriptionEn || v.descriptionAr : v.descriptionAr;
  const city = v.city ? { nameAr: v.city.nameAr, nameEn: v.city.nameEn } : null;
  const directions =
    v.latitude !== null && v.longitude !== null
      ? Platform.OS === "ios"
        ? `https://maps.apple.com/?daddr=${v.latitude},${v.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${v.latitude},${v.longitude}`
      : null;

  return (
    <View style={styles.page}>
      <TopBar title={name} subtitle={kindLabel(v.kind, lang)} back backTo="/places" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.jade} />}
      >
        {v.coverImage ? <Image source={{ uri: sized(v.coverImage, 600) }} style={styles.cover} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        <Card>
          <Text variant="title" accessibilityRole="header">{name}</Text>
          {v.address || city ? <Text variant="caption" tone="muted">{[v.address, city ? nm({ nameAr: city.nameAr, nameEn: city.nameEn }) : null].filter(Boolean).join(" · ")}</Text> : null}
          {description ? <Text variant="body" tone="ink2">{description}</Text> : null}
          <View style={styles.actions}>
            {directions ? <Button label={T("الاتجاهات", "Directions")} icon="navigate-outline" variant="outline" size="sm" onPress={() => Linking.openURL(directions)} /> : null}
            {v.phone ? <Button label={T("اتصل", "Call")} icon="call-outline" variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${v.phone}`)} /> : null}
          </View>
          {v.organization ? (
            <Button label={T(`تبع ${nm(v.organization)}`, `Run by ${nm(v.organization)}`)} variant="ghost" size="sm" icon="git-network-outline" onPress={() => router.push({ pathname: "/org/[slug]", params: { slug: v.organization!.slug } })} />
          ) : null}
        </Card>

        {v.hours.length ? (
          <Card>
            <Text variant="label" accessibilityRole="header">{T("مواعيد المكان", "Opening hours")}</Text>
            {v.hours.map((h) => (
              <View key={h.dayOfWeek} style={styles.hour}>
                <Text variant="caption">{lang === "ar" ? DAYS[h.dayOfWeek]?.[0] : DAYS[h.dayOfWeek]?.[1]}</Text>
                <Text variant="caption" tone={h.isClosed ? "muted" : "ink"}>{h.isClosed ? T("مقفول", "Closed") : `${h.openTime} – ${h.closeTime}`}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.list}>
          <Text variant="heading" accessibilityRole="header">{T("الأنشطة", "Businesses")}</Text>
          {zones.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={T("كل الأدوار", "All floors")} selected={!zone} onPress={() => setZone(null)} />
              {zones.map((z) => (
                <Chip key={z.id} label={nm(z)} selected={zone === z.id} onPress={() => setZone(zone === z.id ? null : z.id)} />
              ))}
            </ScrollView>
          ) : null}
          {cats.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {cats.map((c) => (
                <Chip key={c.slug} label={lang === "en" ? c.nameEn : c.nameAr} count={c.count} selected={category === c.slug} onPress={() => setCategory(category === c.slug ? null : c.slug)} />
              ))}
            </ScrollView>
          ) : null}
          {shown.length ? (
            shown.map((e) => (
              <View key={e.membershipId} style={styles.entry}>
                <BusinessCard business={entryCard(e, city)} onPress={() => router.push(businessRoute(e.slug))} />
                {e.zone || e.unit ? (
                  <Text variant="tiny" tone="muted">{[e.zone ? nm(e.zone) : null, e.unit].filter(Boolean).join(" · ")}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <EmptyState icon="storefront-outline" title={v.directory.length ? T("مفيش نتيجة", "No match") : T("لسه مفيش أنشطة هنا", "No businesses listed yet")} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface2 },
  body: { padding: spacing.lg, gap: spacing.lg },
  cover: { width: "100%", aspectRatio: 2.2, borderRadius: radius.lg, backgroundColor: colors.surface },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  hour: { flexDirection: "row", justifyContent: "space-between" },
  list: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  entry: { gap: spacing.xs },
});
