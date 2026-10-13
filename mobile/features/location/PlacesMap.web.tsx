import { Linking, StyleSheet, View } from "react-native";
import { Button, Card, Text, spacing, useLocale } from "@/design";
import type { MapPoint } from "@/features/discovery/map";

/**
 * The browser preview has no native map. Rather than an empty frame, it
 * lists the same pins with a link each to the place on Google Maps —
 * the phones get the real map (PlacesMap.tsx).
 */
export function PlacesMap({
  points,
  names,
  onOpen,
}: {
  points: MapPoint[];
  names: Record<string, string>;
  around: { lat: number; lng: number } | null;
  onOpen: (slug: string) => void;
  /** A fixed height for a small map inside a page; fills its parent otherwise. */
  height?: number;
  showOpen?: boolean;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  return (
    <View style={styles.list}>
      <Text variant="caption" tone="subtle">
        {ar ? "الخريطة بتظهر في تطبيق الموبايل. دي نفس الأماكن:" : "The map shows in the phone app. The same places:"}
      </Text>
      {points.map((p) => (
        <Card key={p.key}>
          <Text variant="bodyBold">{names[p.id] ?? p.slug}</Text>
          {p.branchNameAr ? (
            <Text variant="caption" tone="subtle">
              {(!ar && p.branchNameEn) || p.branchNameAr}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button size="sm" variant="ghost" icon="storefront-outline" label={ar ? "افتح" : "Open"} onPress={() => onOpen(p.slug)} />
            <Button
              size="sm"
              variant="ghost"
              icon="map-outline"
              label={ar ? "على Google Maps" : "On Google Maps"}
              onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`)}
            />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
