import { View, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { spacing } from "@/constants/theme";

/**
 * Nothing here yet.
 *
 * Always names what to do next. "No bookings" on its own tells somebody
 * nothing they can act on — the same rule the web's EmptyState follows.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Text variant="heading" style={styles.centered}>
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" style={[styles.centered, styles.body]}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, alignItems: "center" },
  centered: { textAlign: "center" },
  body: { marginTop: spacing.sm, maxWidth: 320 },
  action: { marginTop: spacing.xl },
});
