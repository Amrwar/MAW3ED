import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button, Card, Chip, EmptyState, ErrorState, IconButton, SearchField, SkeletonCard, Text, TopBar,
  colors, radius, spacing, useLocale, useToast,
} from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { useOrganization, countOrganizationVisit } from "@/features/places/queries";
import { businessRoute, categoriesOf, filterEntries, ORG_SLUG, sectionsOf } from "@/features/places/logic";
import { PlaceRow, entryCard, kindLabel } from "@/features/places/PlaceRow";
import { ApiError } from "@/lib/api/errors";
import { config } from "@/lib/config";
import { sized } from "@/lib/image";
import { shareLink } from "@/lib/share";
import type { OrgDetail } from "@/types/places";

/**
 * One organization: a mall, a restaurant or clinic group, a building. Its
 * profile, where it belongs, its venues, and its directory — the
 * businesses it lists, filtered by category and the organization's own
 * sections. Opening a business from here carries the organization, so a
 * booking made there is credited to it (the website's ?org=). The same
 * page as /groups/<slug>; its QR code opens here with ?src=qr.
 */
export default function OrgScreen() {
  const { slug, src } = useLocalSearchParams<{ slug: string; src?: string }>();
  const valid = typeof slug === "string" && ORG_SLUG.test(slug);
  const q = useOrganization(valid ? slug : undefined);
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);

  // One visit per opening, by channel (a QR code, a shared link), as the website counts it.
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || !q.data?.organization) return;
    counted.current = true;
    countOrganizationVisit(q.data.organization.slug, src);
  }, [q.data, src]);

  if (!valid || (q.error instanceof ApiError && q.error.status === 404)) {
    return (
      <View style={styles.page}>
        <TopBar title={T("مش موجود", "Not found")} back backTo="/places" />
        <EmptyState icon="business-outline" title={T("الصفحة دي مش موجودة", "This page doesn't exist")} body={T("ممكن تكون اتشالت أو لسه مش منشورة.", "It may have been removed, or isn't published yet.")} action={<Button label={T("المولات والمجموعات", "Malls and groups")} onPress={() => router.replace("/places")} />} />
      </View>
    );
  }
  if (q.isLoading) {
    return (
      <View style={styles.page}>
        <TopBar title={T("بنحمّل…", "Loading…")} back backTo="/places" />
        <View style={styles.body}><SkeletonCard /><SkeletonCard /><SkeletonCard /></View>
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={styles.page}>
        <TopBar title={T("المولات والمجموعات", "Malls and groups")} back backTo="/places" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </View>
    );
  }
  return <Org o={q.data.organization} refreshing={q.isRefetching} onRefresh={() => q.refetch()} />;
}

function Org({ o, refreshing, onRefresh }: { o: OrgDetail; refreshing: boolean; onRefresh: () => void }) {
  const { lang } = useLocale();
  const T = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const nm = (x: { nameAr: string; nameEn: string | null }) => (lang === "en" && x.nameEn) || x.nameAr;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const name = nm(o);
  const description = lang === "en" ? o.descriptionEn || o.descriptionAr : o.descriptionAr;
  const cats = useMemo(() => categoriesOf(o.directory), [o.directory]);
  const sections = useMemo(() => sectionsOf(o.directory), [o.directory]);
  const shown = useMemo(() => filterEntries(o.directory, { q: search, category, section }), [o.directory, search, category, section]);
  const city = o.city ? { nameAr: o.city.nameAr, nameEn: o.city.nameEn } : null;
  const url = `${config.apiUrl}/groups/${encodeURIComponent(o.slug)}`;

  return (
    <View style={styles.page}>
      <TopBar
        title={name}
        subtitle={kindLabel(o.kind, lang)}
        back
        backTo="/places"
        actions={
          <IconButton
            icon="share-outline"
            color={colors.surface}
            label={T(`شارك ${name}`, `Share ${name}`)}
            onPress={() =>
              void shareLink(
                { url, title: name, message: T(`${name} على موعد: ${url}`, `${name} on Maw3ed: ${url}`) },
                (message, tone) => toast({ message, tone }),
                T("اتنسخ اللينك", "Link copied"),
              )
            }
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.jade} />}
      >
        {o.coverImage ? <Image source={{ uri: sized(o.coverImage, 600) }} style={styles.cover} accessibilityElementsHidden importantForAccessibility="no" /> : null}
        <Card>
          <View style={styles.head}>
            {o.logoImage ? <Image source={{ uri: sized(o.logoImage, 96) }} style={styles.logo} accessibilityElementsHidden importantForAccessibility="no" /> : null}
            <View style={styles.flex}>
              <Text variant="title" accessibilityRole="header">{name}</Text>
              <Text variant="caption" tone="muted">{[kindLabel(o.kind, lang), city ? nm({ nameAr: city.nameAr, nameEn: city.nameEn }) : null].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          {description ? <Text variant="body" tone="ink2">{description}</Text> : null}
          <View style={styles.actions}>
            {o.phone ? <Button label={T("اتصل", "Call")} icon="call-outline" variant="outline" size="sm" onPress={() => Linking.openURL(`tel:${o.phone}`)} /> : null}
            {o.website ? <Button label={T("الموقع", "Website")} icon="globe-outline" variant="outline" size="sm" onPress={() => Linking.openURL(o.website!)} /> : null}
          </View>
          {o.parent ? (
            <Button label={T(`جزء من ${nm(o.parent)}`, `Part of ${nm(o.parent)}`)} variant="ghost" size="sm" icon="git-network-outline" onPress={() => router.push({ pathname: "/org/[slug]", params: { slug: o.parent!.slug } })} />
          ) : null}
        </Card>

        {o.children.length ? (
          <View style={styles.list}>
            <Text variant="heading" accessibilityRole="header">{T("جوّاها", "Within it")}</Text>
            {o.children.map((c) => (
              <PlaceRow key={c.slug} name={nm(c)} city={null} logo={null} businesses={0} kindLabel={kindLabel(c.kind, lang)} onPress={() => router.push({ pathname: "/org/[slug]", params: { slug: c.slug } })} />
            ))}
          </View>
        ) : null}

        {o.venues.length ? (
          <View style={styles.list}>
            <Text variant="heading" accessibilityRole="header">{T("الأماكن", "Venues")}</Text>
            {o.venues.map((v) => (
              <PlaceRow key={v.slug} name={nm(v)} city={v.address} logo={null} businesses={v._count?.memberships ?? 0} kindLabel={kindLabel(v.kind, lang)} onPress={() => router.push({ pathname: "/venue/[slug]", params: { slug: v.slug } })} />
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          <Text variant="heading" accessibilityRole="header">{T("الأنشطة", "Businesses")}</Text>
          {o.directory.length > 6 ? (
            <SearchField value={search} onChangeText={setSearch} placeholder={T("دوّر في الأنشطة", "Search the businesses")} accessibilityLabel={T("دوّر في الأنشطة", "Search the businesses")} />
          ) : null}
          {sections.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={T("الكل", "All")} selected={!section} onPress={() => setSection(null)} />
              {sections.map((s) => (
                <Chip key={s} label={s} selected={section === s} onPress={() => setSection(section === s ? null : s)} />
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
              <BusinessCard key={e.associationId} business={entryCard(e, city)} onPress={() => router.push(businessRoute(e.slug, o.slug))} />
            ))
          ) : (
            <EmptyState
              icon="storefront-outline"
              title={o.directory.length ? T("مفيش نتيجة", "No match") : T("لسه مفيش أنشطة هنا", "No businesses listed yet")}
              body={o.directory.length ? T("جرّب كلمة أو تصنيف تاني.", "Try another word or category.") : undefined}
            />
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
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logo: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface2 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  list: { gap: spacing.md },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
});
