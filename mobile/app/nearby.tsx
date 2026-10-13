import { useMemo, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  SkeletonCard,
  Tabs,
  Text,
  colors,
  spacing,
  useLocale,
} from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { mapPoints, type ResultsMode } from "@/features/discovery/map";
import { startSearch } from "@/features/discovery/searchState";
import { useFacets } from "@/features/customer/queries";
import { formatDistance, locate, ROUGH_ACCURACY_M, type Fix } from "@/features/location/location";
import { PlacesMap } from "@/features/location/PlacesMap";
import { api } from "@/lib/api/client";
import { track } from "@/lib/analytics";
import { num } from "@/lib/format";
import { keys } from "@/lib/query/keys";
import type { NearbyResponse } from "@/types/api";

/**
 * Places near me.
 *
 * Location is asked for here, and only when the person taps "use my
 * location" — the screen opens on what it is for and an alternative
 * (choosing an area), never on a system prompt. One reading, kept in
 * memory, sent to the nearby query and nothing else.
 *
 * The server sorts by distance (GET /api/public/businesses/nearby); the
 * phone never downloads the catalogue. Only businesses whose owners set
 * a pin can appear — nothing is placed from an address — so a quiet
 * result says so honestly and offers a wider radius or an area search.
 */

const RADII = [2, 5, 10, 25] as const;

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(5);
  const [mode, setMode] = useState<ResultsMode>("list");

  const here = fix?.ok ? { lat: fix.lat, lng: fix.lng } : null;

  const nearby = useQuery({
    enabled: here !== null,
    // Rounded to ~100 m in the key, so a jittery reading does not refetch.
    queryKey: keys.businesses.nearby(here ? round(here.lat) : 0, here ? round(here.lng) : 0, radius),
    queryFn: ({ signal }) =>
      api.get<NearbyResponse>(`/api/public/businesses/nearby?lat=${here!.lat}&lng=${here!.lng}&radius=${radius}&limit=40`, {
        anonymous: true,
        signal,
      }),
    staleTime: 60_000,
  });

  const findMe = async () => {
    setLocating(true);
    const result = await locate();
    setFix(result);
    setLocating(false);
    track("nearby_location", { result: result.ok ? "ok" : result.reason, rough: result.ok && (result.accuracy ?? 0) > ROUGH_ACCURACY_M });
  };

  const list = useMemo(() => nearby.data?.businesses ?? [], [nearby.data]);
  const points = useMemo(() => mapPoints(list), [list]);
  const names = useMemo(() => Object.fromEntries(list.map((b) => [b.id, (!ar && b.nameEn) || b.nameAr])), [list, ar]);
  const open = (slug: string) => router.push({ pathname: "/business/[slug]", params: { slug } });

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Header title={T("قريب مني", "Near me")} back />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={here ? <RefreshControl refreshing={nearby.isRefetching} onRefresh={() => nearby.refetch()} tintColor={colors.jade} /> : undefined}
      >
        {!fix || (!fix.ok && !locating) ? (
          <Ask fix={fix} locating={locating} onLocate={findMe} />
        ) : locating ? (
          <SkeletonCard />
        ) : (
          <>
            {fix.ok && (fix.accuracy ?? 0) > ROUGH_ACCURACY_M ? (
              <Card tone="tint">
                <Text variant="caption" tone="ink2">
                  {T(
                    `موقعك تقريبي (في حدود ${formatDistance((fix.accuracy ?? 0) / 1000, lang)})، فالمسافات تقريبية.`,
                    `Your location is approximate (within ${formatDistance((fix.accuracy ?? 0) / 1000, lang)}), so distances are too.`,
                  )}
                </Text>
              </Card>
            ) : null}

            <View style={styles.row}>
              {RADII.map((r) => (
                <Chip key={r} label={formatDistance(r, lang)} selected={radius === r} onPress={() => setRadius(r)} />
              ))}
            </View>

            {list.length > 0 ? (
              <Tabs
                value={mode}
                onChange={setMode}
                options={[
                  { value: "list", label: T("قائمة", "List") },
                  { value: "map", label: T("خريطة", "Map") },
                ]}
              />
            ) : null}

            {nearby.isLoading ? (
              <View style={styles.list}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : nearby.error ? (
              <ErrorState error={nearby.error} onRetry={() => nearby.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState
                icon="location-outline"
                title={T(`مفيش أماكن في حدود ${formatDistance(radius, lang)}`, `Nothing within ${formatDistance(radius, lang)}`)}
                body={T(
                  "الأماكن بتظهر هنا لما أصحابها يحددوا موقعهم على الخريطة. وسّع المسافة أو دوّر بالمنطقة.",
                  "Places appear here once their owners pin them on the map. Widen the distance or search by area.",
                )}
                action={
                  radius < RADII[RADII.length - 1]! ? (
                    <Button label={T("وسّع المسافة", "Widen the distance")} onPress={() => setRadius(RADII[RADII.indexOf(radius) + 1] ?? radius)} />
                  ) : undefined
                }
              />
            ) : mode === "map" ? (
              <PlacesMap points={points} names={names} around={here} onOpen={open} />
            ) : (
              <View style={styles.list}>
                <Text variant="caption" tone="subtle">
                  {T(`${num(list.length, lang)} مكان، الأقرب الأول`, `${list.length} places, nearest first`)}
                </Text>
                {list.map((b) => (
                  <BusinessCard key={b.id} business={b} distance={formatDistance(b.distanceKm, lang)} onPress={() => open(b.slug)} />
                ))}
              </View>
            )}

            <Button variant="ghost" icon="locate-outline" label={T("حدّث موقعي", "Update my location")} onPress={findMe} />
          </>
        )}

        <Areas />
      </ScrollView>
    </View>
  );
}

/** Before a location, or after one could not be had: why, and what to do. */
function Ask({ fix, locating, onLocate }: { fix: Fix | null; locating: boolean; onLocate: () => void }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  if (fix && !fix.ok) {
    const copy =
      fix.reason === "blocked"
        ? T("الموقع مقفول لموعد من إعدادات الموبايل. تقدر تفتحه، أو تدوّر بالمنطقة تحت.", "Location is off for Maw3ed in your phone's settings. Turn it on, or search by area below.")
        : fix.reason === "denied"
          ? T("من غير الموقع مش هنقدر نرتب الأماكن بالقرب. تقدر تدوّر بالمنطقة تحت.", "Without your location we can't sort places by distance. You can search by area below.")
          : fix.reason === "services-off"
            ? T("خدمة الموقع مقفولة في الموبايل. افتحها وجرّب تاني.", "Location services are off on your phone. Turn them on and try again.")
            : T("معرفناش نحدد موقعك دلوقتي. جرّب تاني في مكان مفتوح، أو دوّر بالمنطقة.", "We couldn't get your location just now. Try again in the open, or search by area.");
    return (
      <Card>
        <View style={styles.askRow}>
          <Icon name="location-outline" color={colors.warn} />
          <Text variant="body" tone="ink2" style={styles.flex}>
            {copy}
          </Text>
        </View>
        <View style={styles.row}>
          {fix.reason === "blocked" ? <Button size="sm" label={T("افتح الإعدادات", "Open settings")} onPress={() => void Linking.openSettings()} /> : null}
          {fix.reason !== "blocked" ? <Button size="sm" label={T("حاول تاني", "Try again")} loading={locating} onPress={onLocate} /> : null}
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.askRow}>
        <Icon name="navigate-circle-outline" color={colors.jade} size="lg" />
        <View style={styles.flex}>
          <Text variant="bodyBold">{T("شوف الأماكن القريبة منك", "See places close to you")}</Text>
          <Text variant="caption" tone="subtle">
            {T(
              "بنستخدم موقعك مرة واحدة دلوقتي عشان نرتب الأماكن بالمسافة. مش بنتابعك ولا بنحفظه.",
              "We use your location once, now, to sort places by distance. We don't track or keep it.",
            )}
          </Text>
        </View>
      </View>
      <Button label={T("استخدم موقعي", "Use my location")} icon="locate-outline" loading={locating} onPress={onLocate} style={styles.gap} />
    </Card>
  );
}

/** The alternative that needs no permission: choose an area. */
function Areas() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const facets = useFacets();
  const cities = (facets.data?.cities ?? []).filter((c) => c.count > 0);
  if (cities.length === 0) return null;
  return (
    <View style={styles.areas}>
      <Text variant="label" tone="ink2" accessibilityRole="header">
        {ar ? "أو دوّر بالمنطقة" : "Or search by area"}
      </Text>
      <View style={styles.wrap}>
        {cities.map((c) => (
          <Chip
            key={c.slug}
            label={`${ar ? c.nameAr : c.nameEn} (${num(c.count, lang)})`}
            onPress={() => {
              startSearch({ city: c.slug });
              router.push("/(customer)/search");
            }}
          />
        ))}
      </View>
    </View>
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  flex: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  list: { gap: spacing.md },
  askRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  gap: { marginTop: spacing.md },
  areas: { gap: spacing.sm, marginTop: spacing.md },
});
