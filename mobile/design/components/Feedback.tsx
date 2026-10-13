import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../tokens";
import { useLocale } from "../locale";
import { ApiError, NetworkError, messageFor } from "@/lib/api/errors";
import { Text } from "./Text";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

/* ─── Loading ────────────────────────────────────────────── */

/**
 * Waiting, said in words as well as a spinner — a screen reader cannot
 * see a spinner. For a whole area; use Skeleton where the layout of
 * what is coming is known.
 */
export function Loading({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <View style={styles.centred} accessible role="progressbar" aria-label={label ?? t("loading")}>
      {/* The spinner is decoration; the container carries the label. */}
      <ActivityIndicator color={colors.jade} size="large" aria-hidden />
      <Text variant="caption" tone="subtle" align="center">
        {label ?? t("loading")}
      </Text>
    </View>
  );
}

/* ─── Skeleton ───────────────────────────────────────────── */

/**
 * The shape of content before it arrives, so the screen does not jump
 * when it does. A slow pulse rather than a shimmer sweep: a sweep runs
 * left-to-right and is wrong in Arabic, and a pulse has no direction.
 * Hidden from screen readers; the container announces "loading".
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius: r = radius.sm,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
}) {
  const [pulse] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (reduce || cancelled) return;
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
          ]),
        ).start();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      pulse.stopAnimation();
    };
  }, [pulse]);

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width, height, borderRadius: r, backgroundColor: colors.surface3, opacity: pulse }}
    />
  );
}

/** A card's worth of skeleton: picture, two lines, a short line. */
export function SkeletonCard() {
  const { t } = useLocale();
  return (
    <View style={styles.skeletonCard} accessible role="progressbar" aria-label={t("loading")}>
      <Skeleton height={120} radius={radius.md} />
      <Skeleton width="70%" height={18} />
      <Skeleton width="45%" height={14} />
    </View>
  );
}

/* ─── Empty and error ────────────────────────────────────── */

/**
 * Nothing here yet — said kindly, with what to do about it. An empty
 * list with no words looks broken.
 */
export function EmptyState({
  title,
  body,
  icon = "file-tray-outline",
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Icon name={icon} size="xl" color={colors.jade} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

/**
 * Something failed. Offline says so and offers a retry; a server
 * refusal shows the server's own Arabic message (it is written for a
 * person) and offers a retry only when another attempt could work — a
 * 4xx sends the same wrong request again.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLocale();
  const offline = error instanceof NetworkError;
  const retryable = offline || !(error instanceof ApiError && error.isClientError);

  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <View style={[styles.stateIcon, styles.stateIconError]}>
        <Icon name={offline ? "cloud-offline-outline" : "alert-circle-outline"} size="xl" color={colors.danger} />
      </View>
      <Text variant="heading" align="center">
        {offline ? t("offlineTitle") : t("errorTitle")}
      </Text>
      <Text variant="body" tone="muted" align="center">
        {offline ? t("offlineBody") : error ? messageFor(error) : t("errorBody")}
      </Text>
      {onRetry && retryable ? (
        <View style={styles.stateAction}>
          <Button label={t("retry")} variant="outline" icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The three states every list goes through, in one place, so no screen
 * forgets one: loading, failed, empty — then the content.
 */
export function ListState({
  loading,
  error,
  isEmpty,
  emptyTitle,
  emptyBody,
  emptyIcon,
  emptyAction,
  onRetry,
  skeleton,
  children,
}: {
  loading: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody?: string;
  emptyIcon?: IconName;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  /** Show skeleton cards instead of a spinner while loading. */
  skeleton?: number;
  children: ReactNode;
}) {
  if (loading) {
    return skeleton ? (
      <View style={styles.skeletons}>
        {Array.from({ length: skeleton }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    ) : (
      <Loading />
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} body={emptyBody} icon={emptyIcon} action={emptyAction} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  centred: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxxl },
  skeletonCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  skeletons: { gap: spacing.md },
  state: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.jadeSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  stateIconError: { backgroundColor: colors.dangerSoft },
  stateAction: { marginTop: spacing.md, alignSelf: "stretch", alignItems: "center" },
});
