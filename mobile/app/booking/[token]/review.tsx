import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, ErrorState, TopBar, RatingInput, Skeleton, Text, TextField, colors, spacing, useLocale, useToast } from "@/design";
import { Notice } from "@/features/booking/components";
import { trackBooking } from "@/features/booking/events";
import { useSubmitReview } from "@/features/booking/manage";
import { useBooking } from "@/features/booking/queries";
import { messageFor } from "@/lib/api/errors";
import { longDate, num } from "@/lib/format";

/**
 * Rating a visit, or rewriting a review already left.
 *
 * Only offered when the server says so (PublicBooking.canReview /
 * review.canEdit — lib/review-policy): the appointment was completed,
 * the window is open, there is not one already. The review route checks
 * the same rule again, so a screen left open past the window cannot post.
 * Reviews come only from bookings that happened; there is no other way in.
 */
const MAX = 1000;

export default function ReviewScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const booking = useBooking(token);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const toast = useToast();

  const b = booking.data;
  const editing = Boolean(b?.review);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string | null>(null);
  const submit = useSubmitReview(token, editing);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/booking/[token]", params: { token } }));

  if (booking.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.body}>
          <Skeleton height={28} width="50%" />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }
  if (!b) {
    return (
      <View style={styles.page}>
        <TopBar title={T("التقييم", "Review")} back onBack={back} />
        <ErrorState error={booking.error} onRetry={() => booking.refetch()} />
      </View>
    );
  }

  const allowed = editing ? Boolean(b.review?.canEdit) : b.canReview;
  if (!allowed) {
    const why =
      b.reviewBlock === "not-completed"
        ? T("التقييم بيتفتح بعد ما الميعاد يخلص والمكان يسجّله.", "Reviews open once the appointment is completed.")
        : b.reviewBlock === "too-late"
          ? T("فات وقت التقييم على الحجز ده.", "The review window for this booking has closed.")
          : T("مينفعش تعدّل التقييم ده دلوقتي.", "This review can't be edited now.");
    return (
      <View style={styles.page}>
        <TopBar title={T("التقييم", "Review")} back onBack={back} />
        <EmptyState icon="star-outline" title={T("التقييم مش متاح", "Reviews aren't available")} body={why} action={<Button label={T("رجوع", "Back")} onPress={back} />} />
      </View>
    );
  }

  const value = rating ?? b.review?.rating ?? 0;
  const text = comment ?? b.review?.comment ?? "";
  const name = (!ar && b.business.nameEn) || b.business.nameAr;

  const send = async () => {
    if (value < 1 || submit.isPending) return;
    setError(null);
    try {
      await submit.mutateAsync({ rating: value, comment: text.trim() || null });
      trackBooking("review_submitted", { slug: b.business.slug, rating: value, edited: editing });
      toast({ message: T("شكرًا! التقييم اتسجّل", "Thanks — your review is saved"), tone: "ok" });
      back();
    } catch (e) {
      setError(messageFor(e, lang, { "400": "We couldn't save your review. Please try again.", "409": "We couldn't save your review. Please try again." }));
    }
  };

  return (
    <View style={styles.page}>
      <TopBar title={editing ? T("عدّل تقييمك", "Edit your review") : T("قيّم زيارتك", "Rate your visit")} subtitle={name} back onBack={back} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]} keyboardShouldPersistTaps="handled">
        <Text variant="body" tone="muted">
          {T(`زيارتك يوم ${longDate(b.date, lang)}`, `Your visit on ${longDate(b.date, lang)}`)}
        </Text>
        <RatingInput value={value} onChange={setRating} />
        <TextField
          label={T("اكتب رأيك (اختياري)", "Tell others about it (optional)")}
          value={text}
          onChangeText={(v) => setComment(v.slice(0, MAX))}
          multiline
          maxLength={MAX}
          hint={`${num(text.length, lang)}/${num(MAX, lang)}`}
        />
        <Text variant="caption" tone="subtle">
          {T("التقييمات بتيجي بس من ناس حجزوا وراحوا فعلاً.", "Reviews only come from people who actually booked and went.")}
        </Text>
        {error ? (
          <Notice icon="alert-circle-outline" tone="danger">
            <Text variant="body">{error}</Text>
          </Notice>
        ) : null}
        <Button label={T("ابعت التقييم", "Submit review")} fullWidth disabled={value < 1} loading={submit.isPending} onPress={send} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
});
