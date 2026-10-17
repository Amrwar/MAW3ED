import { useMemo, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { goBack } from "@/lib/nav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  TopBar,
  Icon,
  IconButton,
  SkeletonCard,
  Text,
  Touchable,
  colors,
  elevation,
  radius as radii,
  spacing,
  useLocale,
} from "@/design";
import { BusinessCard } from "@/features/discovery/BusinessCard";
import { mapPoints } from "@/features/discovery/map";
import { startSearch } from "@/features/discovery/searchState";
import { useFacets } from "@/features/customer/queries";
import { formatDistance, locate, ROUGH_ACCURACY_M, type Fix } from "@/features/location/location";
import { PlacesMap } from "@/features/location/PlacesMap";
import { MapArt } from "@/features/location/MapArt";
import { api } from "@/lib/api/client";
import { track } from "@/lib/analytics";
import { num } from "@/lib/format";
import { keys } from "@/lib/query/keys";
import type { NearbyResponse } from "@/types/api";
import { count } from "@/lib/plural";

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
/** How much of the screen the list sheet covers in the map-first layout. */
const SHEET_SHARE = 0.52;

export default function NearbyScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);

  // Development only: /nearby?at=lat,lng stands in for the phone's
  // location, so the map-first screen can be checked from anywhere.
  const { at } = useLocalSearchParams<{ at?: string }>();
  const [fix, setFix] = useState<Fix | null>(() => devFix(at));
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState<(typeof RADII)[number]>(5);

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
    // A new radius keeps the map and list on screen while it loads.
    placeholderData: keepPreviousData,
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

  const mapFirst = Boolean(here) && !locating && list.length > 0;
  const { height: screenHeight } = useWindowDimensions();

  // Map-first: once there are places to show, the map is the screen and
  // the list sits over it in a sheet, nearest first.
  if (mapFirst) {
    return (
      <View style={styles.mapPage}>
        <View style={StyleSheet.absoluteFill}>
          <PlacesMap
            points={points}
            names={names}
            around={here}
            onOpen={open}
            flat
            inset={{ top: insets.top + 72, bottom: screenHeight * SHEET_SHARE }}
          />
        </View>

        <View style={[styles.mapTop, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
          <IconButton
            icon="chevron-back"
            variant="filled"
            label={T("رجوع", "Back")}
            onPress={() => goBack("/(customer)")}
            testID="back"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {RADII.map((r) => (
              <Chip key={r} label={formatDistance(r, lang)} selected={radius === r} onPress={() => setRadius(r)} />
            ))}
          </ScrollView>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text variant="title" accessibilityRole="header">
              {T(`${count(list.length, "place", "ar")} جنبك`, `${count(list.length, "place", "en")} nearby`)}
            </Text>
            <Button variant="ghost" size="sm" icon="locate-outline" label={T("حدّث", "Refresh")} onPress={findMe} />
          </View>
          {fix?.ok && (fix.accuracy ?? 0) > ROUGH_ACCURACY_M ? (
            <Text variant="caption" tone="subtle">
              {T(
                `موقعك تقريبي (في حدود ${formatDistance((fix.accuracy ?? 0) / 1000, lang)})، فالمسافات تقريبية.`,
                `Your location is approximate (within ${formatDistance((fix.accuracy ?? 0) / 1000, lang)}), so distances are too.`,
              )}
            </Text>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={nearby.isRefetching} onRefresh={() => nearby.refetch()} tintColor={colors.jade} />}
          >
            {list.map((b) => (
              <BusinessCard key={b.id} business={b} distance={formatDistance(b.distanceKm, lang)} onPress={() => open(b.slug)} />
            ))}
            <Areas />
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <TopBar title={T("قريب مني", "Near me")} back backTo="/(customer)" />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={here ? <RefreshControl refreshing={nearby.isRefetching} onRefresh={() => nearby.refetch()} tintColor={colors.jade} /> : undefined}
      >
        {!fix || (!fix.ok && !locating) ? (
          <Ask fix={fix} locating={locating} onLocate={findMe} />
        ) : locating || nearby.isLoading ? (
          <View style={styles.list}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : nearby.error ? (
          <ErrorState error={nearby.error} onRetry={() => nearby.refetch()} />
        ) : (
          <>
            <View style={styles.row}>
              {RADII.map((r) => (
                <Chip key={r} label={formatDistance(r, lang)} selected={radius === r} onPress={() => setRadius(r)} />
              ))}
            </View>
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
      <Card testID="location-denied">
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
    <View style={styles.askHero}>
      <MapArt height={150} />
      <View style={styles.askBody}>
        <Text variant="title" tone="inverse" accessibilityRole="header">
          {T("شوف اللي ", "See what's ")}
          <Text variant="title" style={{ color: colors.gold }}>
            {T("قريب منك", "near you")}
          </Text>
        </Text>
        <Text variant="caption" tone="inverseMuted">
          {T(
            "بنستخدم موقعك مرة واحدة دلوقتي عشان نرتب الأماكن بالمسافة. مش بنتابعك ولا بنحفظه.",
            "We use your location once, now, to sort places by distance. We don't track or keep it.",
          )}
        </Text>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={locating ? T("بنحدد موقعك", "Finding you") : T("استخدم موقعي", "Use my location")}
          accessibilityState={{ busy: locating, disabled: locating }}
          disabled={locating}
          onPress={onLocate}
          style={styles.goldButton}
          testID="use-location"
        >
          <Icon name="navigate" size="sm" color={colors.night} />
          <Text variant="label" style={{ color: colors.night }}>
            {locating ? T("بنحدد موقعك…", "Finding you…") : T("استخدم موقعي", "Use my location")}
          </Text>
        </Touchable>
      </View>
    </View>
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
    <View style={styles.areas} testID="area-picker">
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

function devFix(at: string | undefined): Fix | null {
  if (!__DEV__ || !at) return null;
  const [lat, lng] = at.split(",").map(Number);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { ok: true, lat: lat!, lng: lng!, accuracy: 10 } : null;
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
  askHero: { borderRadius: radii.xl, overflow: "hidden", backgroundColor: colors.night },
  askBody: { padding: spacing.lg, gap: spacing.sm },
  goldButton: {
    marginTop: spacing.sm,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.gold,
    overflow: "hidden",
  },
  mapPage: { flex: 1, backgroundColor: colors.surface3 },
  mapTop: {
    position: "absolute",
    top: 0,
    start: 0,
    end: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    height: `${SHEET_SHARE * 100}%`,
    backgroundColor: colors.surface,
    borderTopStartRadius: 28,
    borderTopEndRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    ...elevation.float,
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: radii.full, backgroundColor: colors.line2 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
});
