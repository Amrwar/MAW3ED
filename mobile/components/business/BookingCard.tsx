import { View, StyleSheet } from "react-native";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Typography";
import { Badge } from "@/components/ui/Badge";
import { statusLabel, statusTone } from "@/constants/bookingStatus";
import { longDate, money, relativeTime, time } from "@/lib/format";
import { spacing } from "@/constants/theme";

/**
 * One appointment, from either side.
 *
 * The customer's list and the owner's list show the same facts with the
 * other party's name on top: a customer sees the business, an owner
 * sees the customer. Everything else — when, what, how much, what state
 * it is in — is identical, so it is one component with a `title` rather
 * than two that will drift.
 */
export function BookingCard({
  title,
  subtitle,
  date,
  startTime,
  endTime,
  status,
  price,
  currency,
  minutesUntil,
  meta,
  actions,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  price?: number | null;
  currency?: string;
  /** From the server, so a phone with the wrong clock cannot mislead. */
  minutesUntil?: number;
  meta?: string | null;
  actions?: React.ReactNode;
  onPress?: () => void;
}) {
  const amount = money(price ?? null, currency ?? "EGP");

  return (
    <Card onPress={onPress} accessibilityLabel={`${title} — ${longDate(date)} ${time(startTime)}`}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="bodyBold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="subtle" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Badge label={statusLabel(status)} tone={statusTone(status)} />
      </View>

      <View style={styles.when}>
        <Text variant="body">{longDate(date)}</Text>
        <Text variant="body" tone="muted">
          {endTime ? `${time(startTime)} – ${time(endTime)}` : time(startTime)}
        </Text>
      </View>

      <View style={styles.footer}>
        {/* Omitted entirely when there is no price, never shown as 0. */}
        {amount ? (
          <Text variant="label" tone="jade">
            {amount}
          </Text>
        ) : null}
        {typeof minutesUntil === "number" ? (
          <Text variant="caption" tone="subtle">
            {relativeTime(minutesUntil)}
          </Text>
        ) : null}
        {meta ? (
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  when: { marginTop: spacing.md, gap: 2 },
  footer: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  actions: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
});
