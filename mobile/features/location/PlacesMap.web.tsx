import { createElement } from "react";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import { Button, colors, radius, spacing, useLocale } from "@/design";
import { regionFor, type MapPoint } from "@/features/discovery/map";

/**
 * The browser preview has no native map, so it embeds OpenStreetMap's
 * own viewer over the same area the phones would show, with a marker on
 * the nearest place, and a Google Maps link for every pin. The phones
 * get the real map with every pin (PlacesMap.tsx).
 */
export function PlacesMap({
  points,
  around,
  names,
  height,
  flat = false,
  inset,
}: {
  points: MapPoint[];
  names: Record<string, string>;
  around: { lat: number; lng: number } | null;
  onOpen: (slug: string) => void;
  /** A fixed height for a small map inside a page; fills its parent otherwise. */
  height?: number;
  showOpen?: boolean;
  /** Edge to edge, without the card's rounded corners. */
  flat?: boolean;
  /** Screen covered by other things (a bar, a sheet), in px: pins are fitted into what is left. */
  inset?: { top: number; bottom: number };
}) {
  const { lang } = useLocale();
  const { height: screen } = useWindowDimensions();
  const region = regionFor(points, around);
  if (!region) return null;

  // The iframe has no padding option: grow the box so the pins land in
  // the part of the screen nothing covers.
  const top = inset ? Math.min(0.45, inset.top / screen) : 0;
  const bottom = inset ? Math.min(0.7, inset.bottom / screen) : 0;
  const visible = Math.max(0.2, 1 - top - bottom);
  const latSpan = region.latitudeDelta / visible;
  const north = region.latitude + region.latitudeDelta / 2 + latSpan * top;
  const south = north - latSpan;
  const bbox = [
    region.longitude - region.longitudeDelta / 2,
    south,
    region.longitude + region.longitudeDelta / 2,
    north,
  ].join(",");
  const google = (p: MapPoint) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  const marker = points[0] ?? around;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${marker ? `&marker=${marker.lat},${marker.lng}` : ""}`;

  return (
    <View style={[styles.wrap, flat && styles.flat, height ? { height, minHeight: height } : null]}>
      {createElement("iframe", {
        src,
        title: lang === "ar" ? "خريطة الأماكن" : "Map of places",
        style: { border: 0, width: "100%", height: "100%" },
        loading: "lazy",
      })}
      {/* Every pin, each with its own way to Google Maps: the embed marks only one. */}
      {!flat ? (
        <View style={styles.links}>
          {points.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant="secondary"
              icon="map-outline"
              label={
                points.length === 1
                  ? lang === "ar"
                    ? "على Google Maps"
                    : "On Google Maps"
                  : ((lang === "en" && p.branchNameEn) || p.branchNameAr || names[p.id] || p.slug)
              }
              onPress={() => void Linking.openURL(google(p))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 360, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface3 },
  flat: { borderRadius: 0, minHeight: 0 },
  links: { position: "absolute", bottom: spacing.sm, start: spacing.sm, end: spacing.sm, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
