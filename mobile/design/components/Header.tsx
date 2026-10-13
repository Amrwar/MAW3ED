import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { colors, spacing } from "../tokens";
import { useLocale } from "../locale";
import { Text } from "./Text";
import { IconButton } from "./IconButton";

/**
 * The top of a screen. `title` is the screen's heading for screen
 * readers too (role "header"), so moving by headings lands on it.
 *
 * The back button points the way back — rightward in Arabic, leftward
 * in English — because the chevron is a directional icon. `tone="night"`
 * gives the Deep Anchor top: the screen opens on the anchor colour.
 */
export function Header({
  title,
  subtitle,
  back = false,
  onBack,
  actions,
  tone = "light",
  large = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
  tone?: "light" | "night";
  /** A big title for the top of a tab, rather than a pushed screen. */
  large?: boolean;
}) {
  const { t } = useLocale();
  const night = tone === "night";

  return (
    <View style={[styles.bar, night && styles.night]}>
      <View style={styles.row}>
        {back ? (
          <IconButton
            icon="chevron-back"
            label={t("back")}
            variant={night ? "night" : "plain"}
            onPress={onBack ?? (() => router.back())}
          />
        ) : null}
        <View style={styles.titles}>
          <Text variant={large ? "title" : "heading"} tone={night ? "inverse" : "ink"} accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone={night ? "inverseMuted" : "subtle"} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingBottom: spacing.md },
  night: { backgroundColor: colors.night },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 48 },
  titles: { flex: 1, gap: spacing.xxs },
  actions: { flexDirection: "row", alignItems: "center" },
});
