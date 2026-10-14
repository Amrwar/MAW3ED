import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../tokens";
import { useLocale } from "../locale";
import { Icon } from "./Icon";
import { Text } from "./Text";

/**
 * "You're offline" across the top of every screen while there is no
 * connection. Requests wait meanwhile (lib/query/connectivity.ts) and the
 * screen keeps what it last loaded, so this says why nothing is
 * changing; it goes away by itself when the connection returns and the
 * screen refreshes.
 *
 * Announced to screen readers when it appears. Never covers a tap
 * target for long: it is short, and sits under the status bar.
 */
export function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  if (isOnline) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.xs }]}>
      <View style={styles.pill} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="offline-banner">
        <Icon name="cloud-offline-outline" size="sm" color={colors.night} />
        <Text variant="label" style={{ color: colors.night }}>
          {lang === "ar" ? "مفيش إنترنت — بنعرض آخر حاجة اتحمّلت" : "You're offline — showing what was last loaded"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", start: 0, end: 0, alignItems: "center", zIndex: 100 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
});
