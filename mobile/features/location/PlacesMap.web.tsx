import { createElement } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { Button, colors, radius, spacing, useLocale } from "@/design";
import { regionFor, type MapPoint } from "@/features/discovery/map";

/**
 * The browser preview has no native map, so it embeds OpenStreetMap's
 * own viewer over the same area the phones would show, with a marker on
 * the nearest place. The phones get the real map with every pin
 * (PlacesMap.tsx); here the list beside it carries the rest.
 */
export function PlacesMap({
  points,
  around,
  height,
  flat = false,
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
}) {
  const { lang } = useLocale();
  const region = regionFor(points, around);
  if (!region) return null;

  const bbox = [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ].join(",");
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
      {points.length === 1 ? (
        <Button
          size="sm"
          variant="secondary"
          icon="map-outline"
          label={lang === "ar" ? "على Google Maps" : "On Google Maps"}
          onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${points[0]!.lat},${points[0]!.lng}`)}
          style={styles.open}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 360, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface3 },
  flat: { borderRadius: 0, minHeight: 0 },
  open: { position: "absolute", bottom: spacing.sm, start: spacing.sm },
});
