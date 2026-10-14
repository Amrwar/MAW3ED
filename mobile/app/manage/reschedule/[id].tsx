import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  DateStrip,
  EmptyState,
  ErrorState,
  Skeleton,
  Text,
  TimeSlots,
  TopBar,
  colors,
  elevation,
  spacing,
  useLocale,
  useToast,
} from "@/design";
import { nameOf } from "@/features/business/components";
import { useBookingDetail, useRescheduleBooking, useRescheduleSlots } from "@/features/business/queries";
import { ApiError } from "@/lib/api/errors";
import { longDate, time } from "@/lib/format";

/**
 * The business moves a booking — owner or manager. Times come from the
 * same engine the customer books against, with this booking left out so
 * it can move within its own day. If somebody takes the time while this
 * screen is open, the server says so and the times reload.
 */
export default function RescheduleBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const booking = useBookingDetail(id ?? "");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const slots = useRescheduleSlots(id ?? "", date);
  const save = useRescheduleBooking(id ?? "");
  const b = booking.data;

  const submit = () => {
    if (!date || !slot) return;
    save.mutate(
      { date, startTime: slot },
      {
        onSuccess: () => {
          toast({ message: T("اتغيّر الميعاد، والعميل هيوصله إشعار.", "Moved — the customer will be told."), tone: "ok" });
          router.back();
        },
        onError: (e) => {
          const taken = e instanceof ApiError && e.status === 409;
          toast({
            message: taken ? T("الوقت ده اتحجز دلوقتي، اختار وقت تاني.", "That time was just taken. Pick another.") : T("معرفناش نغيّر الميعاد. جرّب تاني.", "Couldn't move it. Try again."),
            tone: "danger",
          });
          if (taken) {
            setSlot(null);
            void slots.refetch();
          }
        },
      },
    );
  };

  return (
    <View style={styles.page}>
      <TopBar
        title={T("غيّر الميعاد", "Reschedule")}
        subtitle={b ? `${b.customerName} · ${b.service ? nameOf(lang, b.service) : ""}` : undefined}
        back
      />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 160 + insets.bottom }]}>
        {booking.error ? (
          <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
        ) : !b ? (
          <Skeleton height={86} />
        ) : !b.canReschedule ? (
          <EmptyState icon="lock-closed-outline" title={T("مينفعش تغيّر ميعاد الحجز ده", "This booking can't be moved")} />
        ) : (
          <>
            <Text variant="caption" tone="subtle">
              {T(`الميعاد الحالي: ${longDate(b.date, "ar")} ${time(b.startTime, "ar")}`, `Now: ${longDate(b.date, "en")} ${time(b.startTime, "en")}`)}
            </Text>
            <Text variant="heading" accessibilityRole="header">
              {T("اختار اليوم", "Pick a day")}
            </Text>
            <DateStrip
              value={date}
              onChange={(d) => {
                setDate(d);
                setSlot(null);
              }}
            />
            {date ? (
              <>
                <Text variant="heading" accessibilityRole="header">
                  {T("اختار الوقت", "Pick a time")}
                </Text>
                {slots.isLoading ? (
                  <Skeleton height={54} />
                ) : slots.error ? (
                  <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
                ) : (
                  <TimeSlots slots={slots.data?.slots ?? []} value={slot} onChange={setSlot} />
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      {b?.canReschedule ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {date && slot ? (
            <Text variant="bodyBold" align="center">
              {`${longDate(date, lang)} · ${time(slot, lang)}`}
            </Text>
          ) : null}
          <Button fullWidth label={T("انقل الحجز", "Move booking")} disabled={!date || !slot} loading={save.isPending} onPress={submit} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  body: { padding: spacing.lg, gap: spacing.md },
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
