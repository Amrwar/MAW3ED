import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { Text, colors, radius, spacing, useLocale } from "@/design";
import { regionFor, type MapPoint } from "@/features/discovery/map";

/**
 * Places on a map: a pin for every location an owner set (a business
 * with branches has several), the person's own position shown by the
 * platform's blue dot when they shared it. Apple Maps on iOS, Google
 * Maps on Android.
 *
 * The person's position comes from the screen (one reading), never from
 * the map tracking them: showsUserLocation is only on while they have
 * chosen "near me".
 */
export function PlacesMap({
  points,
  names,
  around,
  onOpen,
  height,
  showOpen = true,
  flat = false,
}: {
  points: MapPoint[];
  /** Business id → display name, in the reader's language. */
  names: Record<string, string>;
  around: { lat: number; lng: number } | null;
  onOpen: (slug: string) => void;
  /** A fixed height for a small map inside a page; fills its parent otherwise. */
  height?: number;
  /** False where the map is already on the place's own page. */
  showOpen?: boolean;
  /** Edge to edge, without the card's rounded corners (map-first screens). */
  flat?: boolean;
}) {
  const { lang } = useLocale();
  const region = useMemo(() => regionFor(points, around), [points, around]);
  if (!region) return null;

  return (
    <View style={[styles.wrap, flat && styles.flat, height ? { height, minHeight: height } : null]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation={Boolean(around)}
        showsMyLocationButton={Boolean(around)}
        toolbarEnabled={false}
        accessibilityLabel={lang === "ar" ? "خريطة الأماكن" : "Map of places"}
      >
        {points.map((p) => {
          const name = names[p.id] ?? p.slug;
          const branch = (lang === "en" && p.branchNameEn) || p.branchNameAr;
          return (
            <Marker
              key={p.key}
              coordinate={{ latitude: p.lat, longitude: p.lng }}
              title={name}
              description={branch ?? undefined}
              pinColor={colors.night}
              onCalloutPress={() => onOpen(p.slug)}
            >
              {/* The marker's onCalloutPress opens it; a press handler here too fires twice on iOS. */}
              <Callout tooltip={false}>
                <View style={styles.callout}>
                  <Text variant="bodyBold" numberOfLines={1}>
                    {name}
                  </Text>
                  {branch ? (
                    <Text variant="caption" tone="subtle" numberOfLines={1}>
                      {branch}
                    </Text>
                  ) : null}
                  {showOpen ? (
                    <Text variant="caption" tone="jade">
                      {lang === "ar" ? "افتح ←" : "Open →"}
                    </Text>
                  ) : null}
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 360, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface3 },
  flat: { borderRadius: 0, minHeight: 0 },
  callout: { minWidth: 160, maxWidth: 240, padding: spacing.xs, gap: 2 },
});
