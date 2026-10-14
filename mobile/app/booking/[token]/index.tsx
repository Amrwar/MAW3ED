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
  ConfirmDialog,
  EmptyState,
  ErrorState,
  TopBar,
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
  useToast,
} from "@/design";
import { Notice, Row, Stars } from "@/features/booking/components";
import { trackBooking } from "@/features/booking/events";
import { OUTCOME_TONE, notificationLines, outcomeCopy, outcomeOf, shouldPoll, type Outcome } from "@/features/booking/outcome";
import { POLL_FOR_MS, useBooking } from "@/features/booking/queries";
import { useCancelBooking } from "@/features/booking/manage";
import { forgetPayment, paymentPage, rememberPayment } from "@/features/booking/storage";
import { api } from "@/lib/api/client";
import { directionsUrl, pinDirectionsUrl, telUrl, whatsappUrl } from "@/features/profile/profile";
import { ApiError, messageFor } from "@/lib/api/errors";
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
      <View style={styles.page}>
        <TopBar title={ar ? "الحجز" : "Booking"} back onBack={close} />
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
  const [cancelling, setCancelling] = useState(false);
  const cancel = useCancelBooking(token);
  const toast = useToast();

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

  // The website's return page hands an app booking back with
  // maw3ed://booking/<token>; when it does, the in-app browser is closed
  // and the status re-read — the deep link itself is not trusted for it.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (url.includes(`booking/${token}`)) {
        WebBrowser.dismissBrowser();
        onRefresh();
      }
    });
    return () => sub.remove();
  }, [token, onRefresh]);

  /**
   * A new payment page from the server, for a booking whose page was lost
   * or expired. The server refuses while an earlier page could still be
   * paid — two live pages could both be paid.
   */
  const [payNote, setPayNote] = useState<string | null>(null);
  const resumePayment = async () => {
    setPayNote(null);
    setPaying(true);
    try {
      const { paymentUrl } = await api.post<{ paymentUrl: string }>(`/api/public/booking/${encodeURIComponent(token)}/pay`, undefined, {
        anonymous: true,
        timeoutMs: 30_000,
      });
      await rememberPayment(token, paymentUrl, (!ar && b.business.nameEn) || b.business.nameAr);
      setPayUrl(paymentUrl);
      await openPayment(paymentUrl);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === "payment-in-progress") {
        const at = e instanceof ApiError && typeof e.detail.retryAt === "string" ? new Date(e.detail.retryAt) : null;
        const when = at ? at.toLocaleTimeString(ar ? "ar-EG" : "en-GB", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }) : "";
        setPayNote(
          when
            ? T(
                `في صفحة دفع لسه شغالة. لو دفعت فيها، التأكيد جاي. لو لأ، تقدر تفتح صفحة جديدة بعد ${when}.`,
                `A payment page is still open for this booking. If you paid there, confirmation is on its way. If not, you can open a new page after ${when}.`,
              )
            : T(
                "في صفحة دفع لسه شغالة. لو دفعت فيها، التأكيد جاي. لو لأ، جرّب تاني بعد شوية.",
                "A payment page is still open for this booking. If you paid there, confirmation is on its way. If not, try again shortly.",
              ),
        );
      } else if (code === "already-paid" || code === "not-awaiting-payment") {
        onRefresh();
      } else {
        setPayNote(T("معرفناش نفتح صفحة الدفع. جرّب تاني بعد شوية.", "We couldn't open the payment page. Try again in a moment."));
      }
      setPaying(false);
    }
  };

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
  // The pin the owner set for the branch or business; otherwise a search for the written address.
  const pinned = b.branch?.location ?? (b.branch ? null : b.business.location);
  const directions = pinned ? pinDirectionsUrl(pinned) : where ? directionsUrl([where, ar ? b.business.cityNameAr : b.business.cityNameEn]) : null;
  const phone = b.business.phone ? telUrl(b.business.phone) : null;
  const wa = b.business.whatsapp ? whatsappUrl(b.business.whatsapp) : null;
  const notes = notificationLines(b.notifications, lang);
  const live = outcome === "confirmed" || outcome === "awaiting-business";
  const paidDeposit = b.payment?.status === "SUCCEEDED" || b.payment?.status === "PARTIALLY_REFUNDED" || b.payment?.status === "REFUNDED";

  return (
    <View style={styles.page}>
      <TopBar title={T("الحجز", "Booking")} back onBack={onClose} />
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
            <Button
              label={T("كمّل الدفع", "Continue to payment")}
              icon="card-outline"
              fullWidth
              loading={paying}
              onPress={() => (payUrl ? openPayment(payUrl) : resumePayment())}
            />
            {payNote ? (
              <Notice icon="information-circle-outline" tone="warn">
                <Text variant="body">{payNote}</Text>
              </Notice>
            ) : (
              <Text variant="caption" tone="subtle">
                {T(
                  "الميعاد محجوز لك لحد ما تدفع. لو مدفعتش، بيتساب لوحده بعد ساعتين.",
                  "Your time is held until you pay. If you don't, it's released automatically after two hours.",
                )}
              </Text>
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
          {b.payment && b.payment.refunded > 0 ? (
            <Row
              label={T("اترجّع", "Refunded")}
              value={`${fmt(b.payment.refunded)}${b.payment.status === "PARTIALLY_REFUNDED" ? T(" (جزء من العربون)", " (part of the deposit)") : ""}`}
              tone="ok"
            />
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

        {/* ── Change it ── */}
        {b.canChange ? (
          <View style={styles.contact}>
            <Button
              label={T("غيّر الميعاد", "Reschedule")}
              icon="swap-horizontal-outline"
              variant="outline"
              style={styles.flex}
              onPress={() => router.push({ pathname: "/booking/[token]/reschedule", params: { token } })}
            />
            <Button label={T("إلغاء الحجز", "Cancel booking")} icon="close-circle-outline" variant="danger" style={styles.flex} onPress={() => setCancelling(true)} />
          </View>
        ) : null}

        {/* ── Review: only when the server says this booking may have one ── */}
        {b.review ? (
          <Card>
            <View style={styles.between}>
              <Text variant="label" tone="ink2" accessibilityRole="header">
                {T("تقييمك", "Your review")}
              </Text>
              <Stars value={b.review.rating} />
            </View>
            {b.review.comment ? <Text variant="body" tone="ink2">{b.review.comment}</Text> : null}
            {b.review.status !== "PUBLISHED" ? (
              <Text variant="caption" tone="subtle">
                {T("التقييم ده مش ظاهر للناس حاليًا.", "This review isn't currently shown publicly.")}
              </Text>
            ) : null}
            {b.review.response ? (
              <View style={styles.response}>
                <Text variant="caption" tone="subtle">
                  {T("رد المكان", "Business response")}
                </Text>
                <Text variant="body" tone="ink2">{b.review.response}</Text>
              </View>
            ) : null}
            {b.review.canEdit ? (
              <Button
                size="sm"
                variant="ghost"
                icon="create-outline"
                label={T("عدّل التقييم", "Edit review")}
                onPress={() => router.push({ pathname: "/booking/[token]/review", params: { token } })}
                style={styles.start}
              />
            ) : null}
          </Card>
        ) : b.canReview ? (
          <Button
            label={T("قيّم زيارتك", "Rate your visit")}
            icon="star-outline"
            fullWidth
            onPress={() => router.push({ pathname: "/booking/[token]/review", params: { token } })}
          />
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

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        destructive
        title={T("تلغي الحجز؟", "Cancel this booking?")}
        body={
          paidDeposit
            ? T(
                "الإلغاء مابيرجّعش العربون أوتوماتيك. لو اترجّع جزء منه أو كله، هيظهر هنا بعد ما يتعمل.",
                "Cancelling doesn't refund the deposit automatically. If any of it is refunded, it will show here once it's issued.",
              )
            : T("المكان هيعرف إنك لغيت، والميعاد هيتاح لغيرك.", "The business will be told, and the time will be freed for someone else.")
        }
        confirmLabel={T("أيوه، الغي الحجز", "Yes, cancel it")}
        onConfirm={async () => {
          try {
            await cancel.mutateAsync();
            trackBooking("booking_cancelled", { slug: b.business.slug, reference: b.reference ?? undefined });
            toast({ message: T("الحجز اتلغى", "Booking cancelled"), tone: "ok" });
          } catch (e) {
            toast({ message: cancelError(e, lang), tone: "danger" });
          } finally {
            setCancelling(false);
          }
        }}
      />
    </View>
  );
}

/** The server's reasons, in either language. */
function cancelError(e: unknown, lang: "ar" | "en"): string {
  const code = e instanceof ApiError ? e.code : undefined;
  if (lang === "ar") return messageFor(e);
  if (code === "too-late") return "It's too close to the appointment to cancel here. Please contact the business.";
  if (code === "not-cancellable") return "This booking can no longer be cancelled.";
  return "We couldn't cancel the booking. Please try again.";
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
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  response: { marginTop: spacing.sm, paddingStart: spacing.md, borderStartWidth: 2, borderStartColor: colors.line2, gap: spacing.xxs },
  start: { alignSelf: "flex-start" },
});
