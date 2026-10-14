import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  DateStrip,
  EmptyState,
  ErrorState,
  TopBar,
  Skeleton,
  Text,
  TimeSlots,
  colors,
  spacing,
  useLocale,
  useToast,
} from "@/design";
import { cairoToday } from "@/design/calendar";
import { Notice, Row } from "@/features/booking/components";
import { trackBooking } from "@/features/booking/events";
import { emptyDayReason } from "@/features/booking/flow";
import { useReschedule, useRescheduleSlots } from "@/features/booking/manage";
import { useBooking } from "@/features/booking/queries";
import { ApiError, NetworkError, messageFor } from "@/lib/api/errors";
import { duration, longDate, time } from "@/lib/format";
import { keys } from "@/lib/query/keys";

/**
 * Moving a booking.
 *
 * The times come from the booking's own slots endpoint, which runs the
 * same availability engine with this booking left out — so its own
 * current time does not block the times beside it. Nothing assumes the
 * old slot is still there, or that a time shown a minute ago still is:
 * the reschedule route checks again, inside its write, and a time taken
 * in between comes back as "taken" and the grid refreshes.
 *
 * A moved booking goes back to "awaiting confirmation" — the business
 * reviews the new time, exactly as on the website.
 */
export default function RescheduleScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const booking = useBooking(token);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const toast = useToast();
  const client = useQueryClient();

  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slots = useRescheduleSlots(token, date);
  const move = useReschedule(token);

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/booking/[token]", params: { token } }));
  const b = booking.data;

  if (booking.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.body}>
          <Skeleton height={28} width="50%" />
          <Skeleton height={84} />
        </View>
      </View>
    );
  }

  if (!b) {
    return (
      <View style={styles.page}>
        <TopBar title={T("غيّر الميعاد", "Reschedule")} back onBack={back} />
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </View>
    );
  }

  if (!b.canChange) {
    return (
      <View style={styles.page}>
        <TopBar title={T("غيّر الميعاد", "Reschedule")} back onBack={back} />
        <EmptyState
          icon="time-outline"
          title={T("مينفعش تغيّر الميعاد ده", "This booking can't be moved")}
          body={T(
            `التغيير بيقفل قبل الميعاد بـ${duration(b.changeCutoffHours * 60, "ar")}، أو الحجز خلص أو اتلغى. كلّم المكان لو محتاج حاجة.`,
            `Changes close ${b.changeCutoffHours} hours before, or the booking has ended or been cancelled. Contact the business if you need help.`,
          )}
          action={<Button label={T("رجوع", "Back")} onPress={back} />}
        />
      </View>
    );
  }

  const submit = async () => {
    if (!date || !slot || move.isPending) return;
    setError(null);
    try {
      await move.mutateAsync({ date, startTime: slot });
      trackBooking("booking_rescheduled", { slug: b.business.slug, reference: b.reference ?? undefined });
      toast({ message: T("الميعاد اتغيّر — مستني تأكيد المكان", "Moved — waiting for the business to confirm"), tone: "ok" });
      back();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === "slot-taken" || code === "slot-unavailable") {
        setSlot(null);
        void client.invalidateQueries({ queryKey: keys.booking.moveSlots(token, date) });
        setError(T("الميعاد ده اتحجز أو مبقاش متاح. اختار ميعاد تاني.", "That time was just taken or is no longer available. Pick another."));
      } else if (e instanceof NetworkError) {
        setError(T("الاتصال وقع. افتح الحجز تاني واتأكد هو اتغيّر ولا لأ قبل ما تحاول.", "Connection lost. Reopen the booking to check whether it moved before trying again."));
      } else {
        setError(ar ? messageFor(e) : "We couldn't move the booking. Please try again.");
      }
    }
  };

  return (
    <View style={styles.page}>
      <TopBar title={T("غيّر الميعاد", "Reschedule")} subtitle={(!ar && b.service.nameEn) || b.service.nameAr} back onBack={back} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 140 + insets.bottom }]}>
        <Card tone="tint">
          <Row label={T("الميعاد الحالي", "Current time")} value={`${longDate(b.date, lang)} · ${time(b.startTime, lang)}`} />
          <Text variant="caption" tone="subtle">
            {T("بعد التغيير، الحجز بيرجع مستني تأكيد المكان.", "After moving, the booking waits for the business to confirm again.")}
          </Text>
        </Card>

        <Text variant="heading" accessibilityRole="header">
          {T("اختار يوم جديد", "Choose a new day")}
        </Text>
        <DateStrip
          value={date}
          from={cairoToday()}
          days={60}
          onChange={(iso) => {
            setDate(iso);
            setSlot(null);
            setError(null);
          }}
        />

        {error ? (
          <Notice icon="alert-circle-outline" tone="warn">
            <Text variant="body">{error}</Text>
          </Notice>
        ) : null}

        {!date ? null : slots.isLoading ? (
          <Skeleton height={48} />
        ) : slots.error ? (
          <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
        ) : slots.data && slots.data.slots.length === 0 ? (
          <EmptyState icon="time-outline" title={T("مفيش مواعيد", "No times")} body={emptyDayReason(slots.data.reason, lang)} />
        ) : slots.data ? (
          <TimeSlots slots={slots.data.slots} value={slot} onChange={setSlot} />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          fullWidth
          label={slot && date ? T(`انقله لـ ${time(slot, lang)}، ${longDate(date, lang)}`, `Move to ${time(slot, lang)}, ${longDate(date, lang)}`) : T("اختار ميعاد", "Pick a time")}
          disabled={!slot || !date}
          loading={move.isPending}
          onPress={submit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  footer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
