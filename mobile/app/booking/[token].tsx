import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Skeleton,
  SkeletonCard,
  Text,
  colors,
  ltr,
  radius,
  spacing,
  tones,
  useLocale,
} from "@/design";
import { Notice, Row } from "@/features/booking/components";
import { trackBooking } from "@/features/booking/events";
import { OUTCOME_TONE, notificationLines, outcomeCopy, outcomeOf, shouldPoll, type Outcome } from "@/features/booking/outcome";
import { POLL_FOR_MS, useBooking } from "@/features/booking/queries";
import { forgetPayment, paymentPage } from "@/features/booking/storage";
import { directionsUrl, telUrl, whatsappUrl } from "@/features/profile/profile";
import { ApiError } from "@/lib/api/errors";
import { config } from "@/lib/config";
import { duration, longDate, money, time } from "@/lib/format";
import { keys } from "@/lib/query/keys";
import type { PublicBooking } from "@/types/api";

/**
 * One booking, as the server has it — the screen a new booking lands on,
 * and where a link to /booking/<token> opens.
 *
 * Everything shown comes from GET /api/public/booking/[token], read
 * fresh. While a deposit is being confirmed it asks every few seconds
 * and again whenever the app returns to the foreground (the moment
 * somebody comes back from the payment page). It says "confirmed" only
 * when the status is CONFIRMED: a booking the business has yet to accept
 * is "received", one waiting on a deposit is "held".
 *
 * `pay=1` means it was just created and a deposit is due: the payment
 * page opens once, by itself. The page is Paymob's, in the system
 * browser — the app never sees a card number.
 */

export default function BookingScreen() {
  const { token, pay } = useLocalSearchParams<{ token: string; pay?: string }>();
  const booking = useBooking(token);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";

  const close = () => (router.canGoBack() ? router.back() : router.replace("/(customer)/bookings"));

  if (booking.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]} accessibilityLabel={ar ? "بيحمّل" : "Loading"}>
        <View style={styles.body}>
          <Skeleton width={72} height={72} radius={36} />
          <Skeleton width="70%" height={28} />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (!booking.data) {
    const missing = booking.error instanceof ApiError && (booking.error.status === 404 || booking.error.status === 400);
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header title={ar ? "الحجز" : "Booking"} back onBack={close} />
        {missing ? (
          <EmptyState
            icon="calendar-clear-outline"
            title={ar ? "الحجز ده مش موجود" : "Booking not found"}
            body={ar ? "اللينك ده مش شغال. حجوزاتك كلها في صفحة حجوزاتي." : "This link doesn't work. All your bookings are under My bookings."}
            action={<Button label={ar ? "حجوزاتي" : "My bookings"} onPress={() => router.replace("/(customer)/bookings")} />}
          />
        ) : (
          <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
        )}
      </View>
    );
  }

  return (
    <Details
      b={booking.data}
      token={token}
      autoPay={pay === "1"}
      refreshing={booking.isRefetching}
      onRefresh={() => {
        booking.restartPolling();
        void booking.refetch();
      }}
      onClose={close}
    />
  );
}

function Details({
  b,
  token,
  autoPay,
  refreshing,
  onRefresh,
  onClose,
}: {
  b: PublicBooking;
  token: string;
  autoPay: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const queryClient = useQueryClient();

  const outcome = outcomeOf(b.status);
  const copy = outcomeCopy(outcome, lang, b);
  const tone = tones[toneKey(OUTCOME_TONE[outcome])];
  const [storedPayUrl, setPayUrl] = useState<string | null>(null);
  // Only while a deposit is still owed; a stale page is never offered.
  const payUrl = outcome === "awaiting-payment" ? storedPayUrl : null;
  const [paying, setPaying] = useState(false);
  const opened = useRef(false);
  const [stillWaiting, setStillWaiting] = useState(false);

  const fmt = (v: number) => money(v, b.currency, lang) ?? `${v} ${b.currency}`;
  const businessName = (!ar && b.business.nameEn) || b.business.nameAr;

  // The payment page this device opened, if it is still usable.
  useEffect(() => {
    if (outcome !== "awaiting-payment") {
      void forgetPayment(token);
      return;
    }
    paymentPage(token)
      .then(setPayUrl)
      .catch(() => setPayUrl(null));
  }, [outcome, token]);

  const openPayment = useCallback(
    async (url: string) => {
      setPaying(true);
      trackBooking("booking_payment_started", { slug: b.business.slug, reference: b.reference ?? undefined });
      try {
        // An in-app browser tab: Paymob's own page, card details never
        // touch the app. It returns when the customer closes it.
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: "close",
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        });
      } catch {
        await Linking.openURL(url).catch(() => undefined);
      } finally {
        setPaying(false);
        trackBooking("booking_payment_returned", { slug: b.business.slug });
        onRefresh();
      }
    },
    [b.business.slug, b.reference, onRefresh],
  );

  // Straight from the summary: open the payment page once, by itself.
  useEffect(() => {
    if (!autoPay || opened.current || outcome !== "awaiting-payment" || !payUrl) return;
    opened.current = true;
    router.setParams({ pay: undefined });
    void openPayment(payUrl);
  }, [autoPay, outcome, payUrl, openPayment]);

  // Each outcome reported once, when the server first says it.
  const reported = useRef<Outcome | null>(null);
  useEffect(() => {
    if (reported.current === outcome) return;
    reported.current = outcome;
    const props = { slug: b.business.slug, reference: b.reference ?? undefined };
    if (outcome === "confirmed") trackBooking("booking_confirmed", props);
    if (outcome === "awaiting-business") trackBooking("booking_awaiting_business", props);
    if (outcome === "payment-failed") trackBooking("booking_payment_failed", props);
    void queryClient.invalidateQueries({ queryKey: keys.myBookings.all });
  }, [outcome, b.business.slug, b.reference, queryClient]);

  // Past the polling window, hand the check over to the person.
  useEffect(() => {
    if (!shouldPoll(b.status)) return;
    const id = setTimeout(() => setStillWaiting(true), POLL_FOR_MS);
    return () => clearTimeout(id);
  }, [b.status]);

  const addToCalendar = () => {
    trackBooking("booking_calendar_added", { slug: b.business.slug });
    // The .ics the website serves, with the same token. iOS offers to
    // add it to Calendar; Android hands it to the calendar app.
    const url = `${config.apiUrl}/api/public/booking/${encodeURIComponent(token)}/calendar`;
    if (Platform.OS === "web") void Linking.openURL(url);
    else void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
  };

  const where = b.branch?.address ?? b.business.address;
  const directions = where ? directionsUrl([where, ar ? b.business.cityNameAr : b.business.cityNameEn]) : null;
  const phone = b.business.phone ? telUrl(b.business.phone) : null;
  const wa = b.business.whatsapp ? whatsappUrl(b.business.whatsapp) : null;
  const notes = notificationLines(b.notifications, lang);
  const live = outcome === "confirmed" || outcome === "awaiting-business";
  const paidDeposit = b.payment?.status === "SUCCEEDED" || b.payment?.status === "PARTIALLY_REFUNDED" || b.payment?.status === "REFUNDED";

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Header title={T("الحجز", "Booking")} back onBack={onClose} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.jade} />}
      >
        {/* ── What the server says ── */}
        <View style={styles.hero} accessibilityLiveRegion="polite">
          <View style={[styles.badge, { backgroundColor: tone.bg }]}>
            {shouldPoll(b.status) && !stillWaiting ? (
              <ActivityIndicator color={tone.fg} />
            ) : (
              <Icon name={heroIcon(outcome)} size="xl" color={tone.fg} />
            )}
          </View>
          <Text variant="title" align="center" accessibilityRole="header">
            {copy.title}
          </Text>
          {copy.body ? (
            <Text variant="body" tone="muted" align="center">
              {copy.body}
            </Text>
          ) : null}
          {b.reference ? (
            <View style={styles.reference} accessible accessibilityLabel={`${T("رقم الحجز", "Booking reference")}: ${b.reference.split("").join(" ")}`}>
              <Text variant="caption" tone="subtle">
                {T("رقم الحجز", "Booking reference")}
              </Text>
              <Text variant="heading" style={[styles.refText, ltr]} selectable>
                {b.reference}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Payment that still needs doing ── */}
        {outcome === "awaiting-payment" ? (
          <View style={styles.list}>
            {payUrl ? (
              <Button
                label={T("كمّل الدفع", "Continue to payment")}
                icon="card-outline"
                fullWidth
                loading={paying}
                onPress={() => openPayment(payUrl)}
              />
            ) : (
              <Notice icon="information-circle-outline" tone="warn">
                <Text variant="body">
                  {T(
                    "صفحة الدفع مش متاحة على الجهاز ده. لو مدفعتش، الميعاد هيتساب لوحده خلال ساعتين وتقدر تحجز من جديد.",
                    "The payment page isn't available on this device. If you didn't pay, the time is released automatically within two hours and you can book again.",
                  )}
                </Text>
              </Notice>
            )}
            {stillWaiting ? (
              <Button variant="outline" icon="refresh" label={T("اتأكد تاني", "Check again")} fullWidth onPress={onRefresh} />
            ) : null}
          </View>
        ) : null}

        {/* ── The appointment ── */}
        <Card>
          <View style={styles.biz}>
            <Avatar name={businessName} uri={b.business.logoImage} size="md" shape="rounded" />
            <View style={styles.flex}>
              <Text variant="bodyBold">{businessName}</Text>
              <Text variant="caption" tone="subtle">
                {ar ? b.business.cityNameAr : b.business.cityNameEn}
              </Text>
            </View>
            <Badge tone={OUTCOME_TONE[outcome]} label={statusWord(b.status, lang)} />
          </View>
          {b.branch ? <Row label={T("الفرع", "Branch")} value={(!ar && b.branch.nameEn) || b.branch.nameAr} /> : null}
          {where ? <Row label={T("العنوان", "Address")} value={where} tone="muted" /> : null}
          <Row label={T("الخدمة", "Service")} value={(!ar && b.service.nameEn) || b.service.nameAr} />
          {b.staff ? <Row label={T("مع", "With")} value={(!ar && b.staff.nameEn) || b.staff.nameAr} /> : null}
          {b.resource ? <Row label={T("المكان", "Spot")} value={b.resource.name} /> : null}
          {b.partySize ? <Row label={T("عدد الأشخاص", "Guests")} value={String(b.partySize)} /> : null}
          <Row label={T("اليوم", "Date")} value={longDate(b.date, lang)} />
          <Row label={T("الميعاد", "Time")} value={`${time(b.startTime, lang)} – ${time(b.endTime, lang)} · ${duration(b.durationMinutes, lang)}`} />
        </Card>

        {/* ── Money ── */}
        <Card>
          {b.totalPrice > 0 ? (
            <>
              {b.discountAmount > 0 ? <Row label={T("خصم", "Discount")} value={`− ${fmt(b.discountAmount)}`} tone="ok" /> : null}
              <Row label={T("الإجمالي", "Total")} value={fmt(b.totalPrice)} strong />
              {b.depositAmount ? (
                <>
                  <Row label={T("العربون", "Deposit")} value={`${fmt(b.depositAmount)} · ${paymentWord(b.payment?.status, lang)}`} tone={paidDeposit ? "ok" : undefined} />
                  <Row label={T("الباقي في المكان", "Pay at the venue")} value={fmt(Math.max(0, b.totalPrice - (paidDeposit ? b.depositAmount : 0)))} />
                </>
              ) : (
                <Row label={T("الدفع", "Payment")} value={T("في المكان", "At the venue")} />
              )}
            </>
          ) : (
            <Row label={T("السعر", "Price")} value={T("بيتحدد في المكان", "Priced at the venue")} />
          )}
          {b.payment?.status === "REFUNDED" || b.payment?.status === "PARTIALLY_REFUNDED" ? (
            <Text variant="caption" tone="subtle">
              {T("العربون اترجّع (كله أو جزء منه) حسب سجل الدفع.", "The deposit was refunded (fully or in part), as recorded by the payment provider.")}
            </Text>
          ) : null}
        </Card>

        {/* ── Who has been told ── */}
        {live ? (
          <Card tone="tint">
            <Text variant="label" tone="ink2" accessibilityRole="header">
              {T("الإشعارات", "Notifications")}
            </Text>
            {notes.length > 0 ? (
              notes.map((n) => (
                <View key={n.label} style={styles.noteLine}>
                  <Icon name={n.ok ? "checkmark-circle" : "alert-circle-outline"} size="sm" color={n.ok ? colors.ok : colors.warn} />
                  <Text variant="body" tone="ink2">
                    {n.label}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="body" tone="muted">
                {T("لسه مفيش رسايل اتبعتت. التحديثات بتظهر هنا وفي إشعاراتك.", "No messages sent yet. Updates appear here and in your notifications.")}
              </Text>
            )}
          </Card>
        ) : null}

        {/* ── Policy ── */}
        {live ? (
          <Text variant="caption" tone="subtle">
            {b.canChange
              ? T(
                  `تقدر تلغي أو تغيّر الميعاد لحد ${duration(b.changeCutoffHours * 60, "ar")} قبله.`,
                  `You can cancel or reschedule up to ${b.changeCutoffHours} hours before.`,
                )
              : T(
                  `الإلغاء والتغيير بيقفلوا قبل الميعاد بـ${duration(b.changeCutoffHours * 60, "ar")}. لو محتاج تغيّر، كلّم المكان.`,
                  `Cancelling and rescheduling close ${b.changeCutoffHours} hours before. To change it now, contact the business.`,
                )}
          </Text>
        ) : null}

        {/* ── What next ── */}
        <View style={styles.list}>
          {live ? <Button label={T("ضيفه للتقويم", "Add to calendar")} icon="calendar-outline" variant="outline" fullWidth onPress={addToCalendar} /> : null}
          {directions && live ? (
            <Button label={T("الاتجاهات", "Directions")} icon="navigate-outline" variant="outline" fullWidth onPress={() => Linking.openURL(directions)} />
          ) : null}
          {(phone || wa) && outcome !== "finished" ? (
            <View style={styles.contact}>
              {wa ? <Button label={T("واتساب", "WhatsApp")} icon="logo-whatsapp" variant="outline" style={styles.flex} onPress={() => Linking.openURL(wa)} /> : null}
              {phone ? <Button label={T("اتصال", "Call")} icon="call-outline" variant="outline" style={styles.flex} onPress={() => Linking.openURL(phone)} /> : null}
            </View>
          ) : null}
          {outcome === "payment-failed" || outcome === "cancelled" ? (
            <Button
              label={T("احجز من جديد", "Book again")}
              icon="refresh"
              fullWidth
              onPress={() =>
                router.replace({ pathname: "/book/[slug]", params: { slug: b.business.slug, service: b.service.id } })
              }
            />
          ) : null}
          <Button label={T("حجوزاتي", "My bookings")} variant="ghost" fullWidth onPress={() => router.replace("/(customer)/bookings")} />
        </View>
      </ScrollView>
    </View>
  );
}

function toneKey(t: string): keyof typeof tones {
  return (t in tones ? t : "neutral") as keyof typeof tones;
}

function heroIcon(o: Outcome) {
  switch (o) {
    case "confirmed":
      return "checkmark-circle" as const;
    case "awaiting-business":
      return "hourglass-outline" as const;
    case "awaiting-payment":
      return "card-outline" as const;
    case "payment-failed":
    case "cancelled":
      return "close-circle" as const;
    case "finished":
      return "flag-outline" as const;
  }
}

function statusWord(status: PublicBooking["status"], lang: "ar" | "en"): string {
  const words: Record<PublicBooking["status"], [string, string]> = {
    PENDING_PAYMENT: ["في انتظار الدفع", "Awaiting payment"],
    PENDING: ["في انتظار التأكيد", "Awaiting confirmation"],
    CONFIRMED: ["مؤكد", "Confirmed"],
    ARRIVED: ["وصلت", "Checked in"],
    IN_PROGRESS: ["جاري", "In progress"],
    COMPLETED: ["مكتمل", "Completed"],
    CANCELLED: ["ملغي", "Cancelled"],
    NO_SHOW: ["لم يحضر", "No-show"],
    FAILED_PAYMENT: ["الدفع ماكملش", "Payment failed"],
  };
  return words[status][lang === "ar" ? 0 : 1];
}

function paymentWord(status: NonNullable<PublicBooking["payment"]>["status"] | undefined, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (status) {
    case "SUCCEEDED":
      return ar ? "اتدفع" : "paid";
    case "PENDING":
      return ar ? "مستني الدفع" : "awaiting payment";
    case "FAILED":
      return ar ? "الدفع فشل" : "payment failed";
    case "ABANDONED":
      return ar ? "الدفع ماكملش" : "not completed";
    case "REFUNDED":
      return ar ? "اترجّع" : "refunded";
    case "PARTIALLY_REFUNDED":
      return ar ? "اترجّع جزء" : "partly refunded";
    default:
      return ar ? "مش مدفوع" : "not paid";
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  reference: {
    alignItems: "center",
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.line2,
    backgroundColor: colors.surface,
  },
  refText: { letterSpacing: 1.5 },
  list: { gap: spacing.sm },
  biz: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  noteLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  contact: { flexDirection: "row", gap: spacing.md },
});
