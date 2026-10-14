import { StyleSheet, View } from "react-native";
import { colors } from "@/design";

/**
 * A drawn street plan — river, roads, a park, three pins. Decoration for
 * the map-first ways in (Home's "Near you", the Near me prompt): it says
 * what the next step shows, and is hidden from screen readers because it
 * shows nothing real.
 */
export function MapArt({ height = 120 }: { height?: number }) {
  return (
    <View style={[styles.map, { height }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.river} />
      <View style={[styles.road, styles.roadH]} />
      <View style={[styles.road, styles.roadV]} />
      <View style={[styles.road, styles.roadV2]} />
      <View style={styles.park} />
      <View style={[styles.pin, styles.pin1]} />
      <View style={[styles.pin, styles.pinMain]} />
      <View style={[styles.pin, styles.pin3]} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { backgroundColor: colors.mapLand, overflow: "hidden" },
  river: { position: "absolute", start: -30, end: -30, top: "28%", height: 26, backgroundColor: colors.mapWater, transform: [{ rotate: "-8deg" }] },
  road: { position: "absolute", backgroundColor: colors.surface },
  roadH: { start: 0, end: 0, top: "70%", height: 8 },
  roadV: { top: 0, bottom: 0, start: "38%", width: 8 },
  roadV2: { top: 0, bottom: 0, start: "74%", width: 6 },
  park: { position: "absolute", start: "48%", top: "55%", width: 64, height: 46, borderRadius: 10, backgroundColor: colors.mapPark },
  pin: { position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: colors.surface, backgroundColor: colors.jade },
  pin1: { start: "18%", top: "15%" },
  pinMain: { start: "56%", top: "33%", width: 24, height: 24, borderRadius: 12, backgroundColor: colors.night },
  pin3: { start: "84%", top: "76%" },
});
