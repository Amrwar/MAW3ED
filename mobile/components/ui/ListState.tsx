import type { ReactNode } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { Text } from "./Typography";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ApiError, NetworkError, messageFor } from "@/lib/api/errors";
import { colors, spacing } from "@/constants/theme";

/**
 * The four states every list is in, handled once.
 *
 * Loading, failed, empty, or showing something. Screens that write this
 * themselves get it subtly wrong — the usual one being an empty list
 * rendered while a request is still in flight, which reads as "you have
 * nothing" when it means "we have not asked yet".
 *
 * A failure tells the person what to do about it. A dropped connection
 * is worth a retry button; a 422 is not, because pressing it again
 * sends exactly the same bad request.
 */
export function ListState({
  loading,
  error,
  isEmpty,
  emptyTitle,
  emptyBody,
  emptyAction,
  onRetry,
  children,
}: {
  loading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <View style={styles.centered} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.jade} />
        {/* Announced for screen readers, which cannot see a spinner. */}
        <Text variant="caption" tone="subtle" style={styles.spacedTop}>
          لحظة…
        </Text>
      </View>
    );
  }

  if (error) {
    const offline = error instanceof NetworkError;
    // A client error means the request itself was wrong; retrying sends
    // the same one again. Only offer it when another attempt could work.
    const worthRetrying = offline || !(error instanceof ApiError && error.isClientError);

    return (
      <View style={styles.centered}>
        <Text variant="heading" style={styles.center}>
          {offline ? "مفيش اتصال" : "حصلت مشكلة"}
        </Text>
        <Text variant="body" tone="muted" style={[styles.center, styles.spacedTop]}>
          {offline
            ? "اتأكد من الإنترنت وجرّب تاني."
            : messageFor(error)}
        </Text>
        {worthRetrying && onRetry ? (
          <Button label="جرّب تاني" variant="outline" onPress={onRetry} style={styles.retry} />
        ) : null}
      </View>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: spacing.xxxl,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  spacedTop: { marginTop: spacing.sm },
  retry: { marginTop: spacing.lg, alignSelf: "center" },
});
