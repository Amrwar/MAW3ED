import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  SkeletonCard,
  Text,
  Touchable,
  colors,
  spacing,
  useLayout,
  useLocale,
  useToast,
} from "@/design";
import { useBusinessAccess } from "@/features/business/access";
import {
  BookingRow,
  SectionHead,
  Stat,
  nameOf,
  openBooking,
  roleLabel,
} from "@/features/business/components";
import { useOverview, useUpdateBookingStatus } from "@/features/business/queries";
import { longDate, shortDate, time } from "@/lib/format";

/**
 * Today — the screen a business opens in the morning.
 *
 * In the order the morning asks: how many today, who is next, what is
 * waiting on me, what changed overnight, then the whole day in order.
 * One request (GET /api/business/overview), scoped by the server to what
 * this person may see: a provider's "today" is their own diary.
 */
export default function Today() {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const { contentWidth, gutter } = useLayout();
  const insets = useSafeAreaInsets();
  const access = useBusinessAccess();
  const overview = useOverview();
  const confirm = useUpdateBookingStatus();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const o = overview.data;

  const confirmOne = (id: string) => {
    setBusyId(id);
    confirm.mutate(
      { id, status: "CONFIRMED" },
      {
        onSuccess: () =>
          toast({
            message: T(
              "اتأكد الحجز، والعميل هيوصله إشعار.",
              "Confirmed — the customer will be told.",
            ),
            tone: "ok",
          }),
        onError: () =>
          toast({
            message: T("معرفناش نأكد الحجز. جرّب تاني.", "Couldn't confirm. Try again."),
            tone: "danger",
          }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const column = {
    width: "100%" as const,
    maxWidth: contentWidth + gutter * 2,
    alignSelf: "center" as const,
    paddingHorizontal: gutter,
  };
  const greeting =
    new Date().getHours() < 12 ? T("صباح الخير", "Good morning") : T("مساء الخير", "Good evening");
  const who = o?.actor.staffName ? nameOf(lang, o.actor.staffName) : null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => overview.refetch()}
          tintColor={colors.inverse}
        />
      }
    >
      {/* ── Night hero: who, where, today's date ── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
        <View style={column}>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Text variant="label" tone="inverseMuted">
                {who ? `${greeting}، ${who}` : greeting}
              </Text>
              <Text variant="title" tone="inverse" accessibilityRole="header" numberOfLines={2}>
                {o
                  ? nameOf(lang, { nameAr: o.business.nameAr, nameEn: o.business.nameEn })
                  : T("النهاردة", "Today")}
              </Text>
            </View>
            {access.role === "OWNER" ? (
              <View>
                <IconButton
                  icon="notifications-outline"
                  variant="night"
                  label={
                    o?.counts.unreadNotifications
                      ? T(
                          `الإشعارات، ${o.counts.unreadNotifications} جديد`,
                          `Notifications, ${o.counts.unreadNotifications} new`,
                        )
                      : T("الإشعارات", "Notifications")
                  }
                  onPress={() => router.push("/(business)/notifications")}
                />
                {o?.counts.unreadNotifications ? <View style={styles.dot} /> : null}
              </View>
            ) : null}
          </View>
          <View style={styles.heroMeta}>
            <Text variant="body" style={{ color: colors.gold }}>
              {o ? longDate(o.today, lang) : " "}
            </Text>
            {access.role !== "OWNER" ? (
              <Badge label={roleLabel(access.role, lang)} tone="neutral" />
            ) : null}
          </View>
        </View>
      </View>

      <View style={[column, styles.body]}>
        {overview.isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : overview.error || !o ? (
          <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
        ) : (
          <>
            {/* ── The numbers that start the day ── */}
            <View style={styles.stats}>
              <Stat
                value={o.counts.today}
                label={T("حجز النهارده", "today")}
                onPress={() => router.push("/(business)/calendar")}
              />
              <Stat
                value={o.counts.pending}
                label={T("مستني تأكيد", "awaiting confirmation")}
                tone={o.counts.pending ? "warn" : "plain"}
              />
              <Stat
                value={o.counts.cancelledRecent}
                label={T("اتلغى آخر ٢٤ ساعة", "cancelled, last 24h")}
                tone={o.counts.cancelledRecent ? "danger" : "plain"}
              />
            </View>

            {/* ── Who is next ── */}
            {o.next ? (
              <Card
                onPress={() => openBooking(o.next!.id)}
                accessibilityLabel={T("الميعاد الجاي", "Next appointment")}
                tone="night"
                style={styles.next}
              >
                <Text variant="label" style={{ color: colors.gold }}>
                  {T("الميعاد الجاي", "Next appointment")}
                </Text>
                <View style={styles.nextRow}>
                  <Text variant="display" tone="inverse">
                    {time(o.next.startTime, lang)}
                  </Text>
                  <View style={styles.flex}>
                    <Text variant="bodyBold" tone="inverse" numberOfLines={1}>
                      {o.next.customerName}
                    </Text>
                    <Text variant="caption" tone="inverseMuted" numberOfLines={1}>
                      {[nameOf(lang, o.next.service), nameOf(lang, o.next.staffMember)]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" color={colors.gold} />
                </View>
              </Card>
            ) : null}

            {/* ── Waiting on the business ── */}
            {o.pending.length > 0 ? (
              <View style={styles.section}>
                <SectionHead title={T("مستني تأكيدك", "Waiting for you")} />
                {o.pending.map((p) => (
                  // The row opens the booking; Confirm sits beside it, not
                  // inside it — a button within a button is one control to
                  // a screen reader and invalid on the web.
                  <Card key={p.id} padded={false} style={styles.pendingRow}>
                    <Touchable
                      accessibilityRole="button"
                      accessibilityLabel={`${p.customerName}، ${shortDate(p.date, lang)} ${time(p.startTime, lang)}`}
                      onPress={() => openBooking(p.id)}
                      style={styles.pendingOpen}
                    >
                      <Text variant="bodyBold" numberOfLines={1}>
                        {p.customerName}
                      </Text>
                      <Text variant="caption" tone="subtle" numberOfLines={1}>
                        {`${p.date === o.today ? T("النهارده", "Today") : shortDate(p.date, lang)} · ${time(p.startTime, lang)} · ${nameOf(lang, p.service)}`}
                      </Text>
                    </Touchable>
                    {access.can("bookings.confirm") ? (
                      <Button
                        size="sm"
                        label={T("أكّد", "Confirm")}
                        loading={busyId === p.id}
                        onPress={() => confirmOne(p.id)}
                        style={styles.pendingButton}
                      />
                    ) : null}
                  </Card>
                ))}
              </View>
            ) : null}

            {/* ── Changed since yesterday ── */}
            {o.cancelled.length > 0 ? (
              <View style={styles.section}>
                <SectionHead title={T("اتلغى مؤخراً", "Recently cancelled")} />
                {o.cancelled.map((c) => (
                  <Card
                    key={c.id}
                    onPress={() => openBooking(c.id)}
                    accessibilityLabel={c.customerName}
                    style={styles.cancelled}
                  >
                    <Icon name="close-circle-outline" color={colors.danger} />
                    <Text variant="body" numberOfLines={1} style={styles.flex}>
                      {`${c.customerName} · ${shortDate(c.date, lang)} ${time(c.startTime, lang)}`}
                    </Text>
                  </Card>
                ))}
              </View>
            ) : null}

            {/* ── The whole day ── */}
            <View style={styles.section}>
              <SectionHead
                title={T("جدول النهارده", "Today's schedule")}
                action={T("التقويم", "Calendar")}
                onAction={() => router.push("/(business)/calendar")}
              />
              {o.todays.length === 0 ? (
                <EmptyState
                  icon="sunny-outline"
                  title={T("مفيش حجوزات النهارده", "Nothing booked today")}
                  body={T(
                    "أي حجز جديد هيظهر هنا على طول.",
                    "New bookings show up here as they come in.",
                  )}
                />
              ) : (
                o.todays.map((b) => (
                  <BookingRow
                    key={b.id}
                    id={b.id}
                    startTime={b.startTime}
                    endTime={b.endTime}
                    customerName={b.customerName}
                    service={nameOf(lang, b.service) ?? ""}
                    staff={access.can("bookings.readAll") ? nameOf(lang, b.staffMember) : null}
                    branch={nameOf(lang, b.branch)}
                    status={b.status}
                    highlight={o.next?.id === b.id}
                  />
                ))
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.night,
    paddingBottom: spacing.xxl,
    borderBottomStartRadius: 32,
    borderBottomEndRadius: 32,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  dot: {
    position: "absolute",
    top: 10,
    end: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.night,
  },
  body: { marginTop: -spacing.xl, gap: spacing.lg },
  stats: { flexDirection: "row", gap: spacing.sm },
  next: { gap: spacing.sm },
  nextRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  section: { gap: spacing.sm },
  pendingRow: { flexDirection: "row", alignItems: "center" },
  pendingOpen: { flex: 1, padding: spacing.lg, gap: 2 },
  pendingButton: { marginEnd: spacing.md },
  cancelled: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
