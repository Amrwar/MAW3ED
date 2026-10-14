import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  SkeletonCard,
  Text,
  TopBar,
  colors,
  elevation,
  ltr,
  radius,
  spacing,
  useLocale,
  useToast,
  type ButtonVariant,
  type IconName,
} from "@/design";
import { BOOKING_STATUS_TONE, statusLabelFor } from "@/features/bookings/status";
import { nameOf } from "@/features/business/components";
import { useBookingDetail, useUpdateBookingStatus } from "@/features/business/queries";
import type { BookingStatus } from "@/features/business/types";
import { telUrl, whatsappUrl } from "@/features/profile/profile";
import { ApiError } from "@/lib/api/errors";
import { duration, longDate, money, num, time } from "@/lib/format";

/**
 * One booking, for the business: everything about it, the customer to
 * call, and the actions this person may take now.
 *
 * Which actions: the server's list (`actions`, already filtered by the
 * caller's role), so a provider never sees Cancel and an owner does. A
 * cancellation asks first — the customer is told the moment it happens.
 */

const ACTION: Partial<Record<BookingStatus, { ar: string; en: string; icon: IconName; variant: ButtonVariant }>> = {
  CONFIRMED: { ar: "أكّد الحجز", en: "Confirm", icon: "checkmark-circle-outline", variant: "primary" },
  ARRIVED: { ar: "العميل وصل", en: "Checked in", icon: "enter-outline", variant: "primary" },
  IN_PROGRESS: { ar: "بدأ", en: "Start", icon: "play-outline", variant: "outline" },
  COMPLETED: { ar: "خلص", en: "Complete", icon: "checkmark-done-outline", variant: "primary" },
  NO_SHOW: { ar: "مجاش", en: "No-show", icon: "person-remove-outline", variant: "outline" },
};

export default function ManageBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const booking = useBookingDetail(id ?? "");
  const setStatus = useUpdateBookingStatus();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [busy, setBusy] = useState<BookingStatus | null>(null);
  const b = booking.data;

  const move = async (status: BookingStatus) => {
    setBusy(status);
    try {
      await setStatus.mutateAsync({ id: id ?? "", status });
      await booking.refetch();
      toast({ message: T(`بقى ${statusLabelFor(status, "ar")}`, `Now: ${statusLabelFor(status, "en")}`), tone: "ok" });
    } catch (e) {
      const forbidden = e instanceof ApiError && e.status === 403;
      toast({
        message: forbidden ? T("مش مسموح لك بالإجراء ده.", "You're not allowed to do that.") : T("معرفناش نغيّر الحالة. جرّب تاني.", "Couldn't change it. Try again."),
        tone: "danger",
      });
    } finally {
      setBusy(null);
    }
  };

  if (!b) {
    return (
      <View style={styles.page}>
        <TopBar title={T("الحجز", "Booking")} back />
        <View style={styles.body}>
          {booking.isLoading ? (
            <SkeletonCard />
          ) : booking.error instanceof ApiError && booking.error.status === 404 ? (
            // Gone, or not this person's to see: the same answer either way.
            <EmptyState
              icon="calendar-clear-outline"
              title={T("الحجز ده مش متاح", "This booking isn't available")}
              body={T("ممكن يكون اتشال، أو مش من حجوزاتك.", "It may have been removed, or it isn't one of yours.")}
              action={<Button label={T("التقويم", "Calendar")} variant="outline" onPress={() => router.replace("/(business)/calendar")} />}
            />
          ) : (
            <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
          )}
        </View>
      </View>
    );
  }

  const fmt = (n: number) => money(n, b.currency, lang) ?? String(n);
  const main = b.actions.filter((s) => s !== "CANCELLED");
  const canCancel = b.actions.includes("CANCELLED");
  const call = telUrl(b.customerPhone);
  const whatsapp = whatsappUrl(b.customerPhone);
  const facts = [
    { icon: "calendar-outline" as IconName, text: longDate(b.date, lang) },
    { icon: "time-outline" as IconName, text: `${time(b.startTime, lang)}${b.endTime ? ` – ${time(b.endTime, lang)}` : ""}${b.service ? ` · ${duration(b.service.duration, lang)}` : ""}` },
    b.staffMember ? { icon: "person-outline" as IconName, text: nameOf(lang, b.staffMember) ?? "" } : null,
    b.branch ? { icon: "location-outline" as IconName, text: nameOf(lang, b.branch) ?? "" } : null,
    b.resourceName ? { icon: "cube-outline" as IconName, text: b.resourceName } : null,
    b.partySize ? { icon: "people-outline" as IconName, text: T(`${num(b.partySize, lang)} أشخاص`, `${b.partySize} people`) } : null,
  ].filter(Boolean) as { icon: IconName; text: string }[];

  const hasFooter = main.length > 0 || canCancel || b.canReschedule;

  return (
    <View style={styles.page}>
      <TopBar title={T("الحجز", "Booking")} subtitle={b.reference ?? undefined} back>
        <View style={styles.heroRow}>
          <Text variant="title" tone="inverse" numberOfLines={1} style={styles.flex}>
            {b.service ? nameOf(lang, b.service) : T("حجز", "Booking")}
          </Text>
          <Badge label={statusLabelFor(b.status, lang)} tone={BOOKING_STATUS_TONE[b.status] ?? "neutral"} />
        </View>
      </TopBar>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: (hasFooter ? 200 : spacing.xxl) + insets.bottom }]}>
        <Card>
          {facts.map((f) => (
            <View key={f.icon} style={styles.fact}>
              <Icon name={f.icon} size="sm" color={colors.night} />
              <Text variant="body" style={styles.flex}>
                {f.text}
              </Text>
            </View>
          ))}
        </Card>

        {/* ── The customer ── */}
        <Card>
          <Text variant="label" tone="subtle">
            {T("العميل", "Customer")}
          </Text>
          <Text variant="heading">{b.customerName}</Text>
          <Text variant="body" tone="muted" style={ltr}>
            {b.customerPhone}
          </Text>
          <View style={styles.actionsRow}>
            {call ? <Button size="sm" variant="outline" icon="call-outline" label={T("اتصل", "Call")} onPress={() => void Linking.openURL(call)} /> : null}
            {whatsapp ? <Button size="sm" variant="outline" icon="logo-whatsapp" label={T("واتساب", "WhatsApp")} onPress={() => void Linking.openURL(whatsapp)} /> : null}
            {b.customer ? (
              <Button
                size="sm"
                variant="ghost"
                icon="person-circle-outline"
                label={T("ملف العميل", "Customer file")}
                onPress={() => router.push({ pathname: "/manage/customer/[id]", params: { id: b.customer!.id } })}
              />
            ) : null}
          </View>
          {b.customer?.completedVisits ? (
            <Text variant="caption" tone="subtle">
              {T(`زيارات مكتملة قبل كده: ${num(b.customer.completedVisits, lang)}`, `Completed visits: ${b.customer.completedVisits}`)}
            </Text>
          ) : null}
          {b.customer?.notes ? (
            <View style={styles.note}>
              <Icon name="document-text-outline" size="sm" color={colors.warn} />
              <Text variant="caption" tone="ink2" style={styles.flex}>
                {b.customer.notes}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* ── Money ── */}
        <Card>
          <View style={styles.between}>
            <Text variant="body" tone="muted">
              {T("الإجمالي", "Total")}
            </Text>
            <Text variant="bodyBold">{fmt(b.totalPrice)}</Text>
          </View>
          {b.depositAmount ? (
            <View style={styles.between}>
              <Text variant="body" tone="muted">
                {T("العربون", "Deposit")}
              </Text>
              <Text variant="body">{fmt(b.depositAmount)}</Text>
            </View>
          ) : null}
        </Card>

        {b.notes ? (
          <Card tone="tint">
            <Text variant="label" tone="ink2">
              {T("ملاحظات الحجز", "Booking notes")}
            </Text>
            <Text variant="body" tone="ink2">
              {b.notes}
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      {hasFooter ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {main.length > 0 ? (
            <View style={styles.actionsRow}>
              {main.map((s, i) => {
                const a = ACTION[s];
                if (!a) return null;
                return (
                  <Button
                    key={s}
                    label={ar ? a.ar : a.en}
                    icon={a.icon}
                    variant={i === 0 ? "primary" : "outline"}
                    loading={busy === s}
                    disabled={busy !== null}
                    onPress={() => void move(s)}
                    style={i === 0 ? styles.grow : undefined}
                  />
                );
              })}
            </View>
          ) : null}
          <View style={styles.actionsRow}>
            {b.canReschedule ? (
              <Button
                variant="outline"
                icon="calendar-outline"
                label={T("غيّر الميعاد", "Reschedule")}
                onPress={() => router.push({ pathname: "/manage/reschedule/[id]", params: { id: b.id } })}
                style={styles.grow}
              />
            ) : null}
            {canCancel ? (
              <Button
                variant="ghost"
                icon="close-circle-outline"
                label={b.status === "PENDING" ? T("ارفض", "Decline") : T("إلغاء", "Cancel")}
                onPress={() => setCancelling(true)}
                style={styles.grow}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={b.status === "PENDING" ? T("ترفض الحجز ده؟", "Decline this booking?") : T("تلغي الحجز ده؟", "Cancel this booking?")}
        body={T(
          `${b.customerName} هيوصله إشعار إن الحجز اتلغى. مفيش رجوع في الخطوة دي.`,
          `${b.customerName} will be told it's cancelled. This can't be undone.`,
        )}
        confirmLabel={b.status === "PENDING" ? T("ارفض", "Decline") : T("إلغاء الحجز", "Cancel booking")}
        destructive
        onConfirm={async () => {
          await move("CANCELLED");
          setCancelling(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  body: { padding: spacing.lg, gap: spacing.md },
  heroRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fact: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 32 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  note: { flexDirection: "row", gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warnSoft },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 28 },
  footer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopStartRadius: 24,
    borderTopEndRadius: 24,
    ...elevation.raised,
  },
});
