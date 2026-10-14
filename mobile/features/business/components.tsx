import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Badge, Icon, Text, Touchable, colors, radius, spacing, useLocale } from "@/design";
import { BOOKING_STATUS_TONE, statusLabelFor } from "@/features/bookings/status";
import { time } from "@/lib/format";
import type { BookingStatus } from "./types";

/**
 * Shared pieces of the business screens.
 */

const name = (lang: "ar" | "en", n: { nameAr: string; nameEn: string | null } | null | undefined) =>
  n ? (lang === "en" && n.nameEn) || n.nameAr : null;

export function pick(lang: "ar" | "en", ar: string | null | undefined, en: string | null | undefined): string {
  return (lang === "en" && en) || ar || "";
}

export { name as nameOf };

/** The staff role in the reader's language. */
export function roleLabel(role: "OWNER" | "MANAGER" | "PROVIDER", lang: "ar" | "en"): string {
  const ar = { OWNER: "صاحب النشاط", MANAGER: "مدير", PROVIDER: "مقدّم خدمة" } as const;
  const en = { OWNER: "Owner", MANAGER: "Manager", PROVIDER: "Provider" } as const;
  return (lang === "ar" ? ar : en)[role];
}

export function openBooking(id: string) {
  router.push({ pathname: "/manage/booking/[id]", params: { id } });
}

/**
 * One booking in a day's list: the time down the start edge, then who,
 * what and with whom, and the status. The whole row opens the booking.
 */
export function BookingRow({
  id,
  startTime,
  endTime,
  customerName,
  service,
  staff,
  branch,
  status,
  highlight = false,
}: {
  id: string;
  startTime: string;
  endTime?: string | null;
  customerName: string;
  service: string;
  staff?: string | null;
  branch?: string | null;
  status: BookingStatus;
  highlight?: boolean;
}) {
  const { lang } = useLocale();
  const dim = status === "CANCELLED" || status === "NO_SHOW" || status === "FAILED_PAYMENT";
  const meta = [service, staff, branch].filter(Boolean).join(" · ");
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${time(startTime, lang)}، ${customerName}، ${meta}، ${statusLabelFor(status, lang)}`}
      onPress={() => openBooking(id)}
      style={[styles.row, highlight && styles.rowOn, dim && styles.rowDim]}
    >
      <View style={[styles.when, highlight && styles.whenOn]}>
        <Text variant="bodyBold" style={{ color: highlight ? colors.gold : colors.night }}>
          {time(startTime, lang)}
        </Text>
        {endTime ? (
          <Text variant="tiny" style={{ color: highlight ? colors.nightText : colors.subtle }}>
            {time(endTime, lang)}
          </Text>
        ) : null}
      </View>
      <View style={styles.flex}>
        <Text variant="bodyBold" tone={highlight ? "inverse" : "ink"} numberOfLines={1} style={dim ? styles.struck : undefined}>
          {customerName}
        </Text>
        <Text variant="caption" tone={highlight ? "inverseMuted" : "subtle"} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Badge label={statusLabelFor(status, lang)} tone={BOOKING_STATUS_TONE[status] ?? "neutral"} />
    </Touchable>
  );
}

/** A number with its label: tappable, so a count leads to what it counts. */
export function Stat({
  value,
  label,
  tone = "plain",
  onPress,
}: {
  value: number;
  label: string;
  tone?: "plain" | "warn" | "danger";
  onPress?: () => void;
}) {
  const color = tone === "warn" ? colors.warn : tone === "danger" ? colors.danger : colors.night;
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={`${value} ${label}`} onPress={onPress} style={styles.stat} disabled={!onPress}>
      <Text variant="display" style={{ color }}>
        {value}
      </Text>
      <Text variant="caption" tone="subtle" numberOfLines={2}>
        {label}
      </Text>
    </Touchable>
  );
}

/** A section heading with an optional action on the end. */
export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.head}>
      <Text variant="heading" accessibilityRole="header" style={styles.flex}>
        {title}
      </Text>
      {action && onAction ? (
        <Touchable accessibilityRole="button" onPress={onAction} style={styles.headAction}>
          <Text variant="label" tone="jade">
            {action}
          </Text>
          <Icon name="chevron-forward" size="sm" color={colors.jade} />
        </Touchable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  rowOn: { backgroundColor: colors.night },
  rowDim: { opacity: 0.6 },
  struck: { textDecorationLine: "line-through" },
  when: {
    width: 64,
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.goldSoft,
  },
  whenOn: { backgroundColor: colors.night2 },
  stat: {
    flex: 1,
    minHeight: 92,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headAction: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 40, paddingHorizontal: spacing.xs },
});
