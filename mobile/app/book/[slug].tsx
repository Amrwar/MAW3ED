import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, BackHandler, Platform, ScrollView, StyleSheet, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  DateStrip,
  Dialog,
  EmptyState,
  ErrorState,
  Header,
  ServiceCard,
  Skeleton,
  SkeletonCard,
  Text,
  TextField,
  TimeSlots,
  colors,
  ltr,
  spacing,
  useLocale,
} from "@/design";
import { useAuth } from "@/features/auth/AuthProvider";
import { signInThenReturn } from "@/features/auth/AuthShell";
import { Choice, Counter, Notice, Progress, Row } from "@/features/booking/components";
import { trackBooking } from "@/features/booking/events";
import {
  EMPTY_DRAFT,
  asksPartySize,
  bookableDays,
  canAdvance,
  change,
  depositPreviewCents,
  describeFailure,
  detailsErrors,
  emptyDayReason,
  fingerprint,
  firstOpenStep,
  keepsKey,
  mightBeOpen,
  newIdempotencyKey,
  nextStep,
  peopleFor,
  previousStep,
  reconcile,
  requestBody,
  resourcesFor,
  stepsFor,
  tooSmall,
  type Draft,
  type Failure,
  type Step,
} from "@/features/booking/flow";
import { createBooking, useQuote, useSlots } from "@/features/booking/queries";
import { clearSaved, loadSaved, rememberPayment, save, type Attempt } from "@/features/booking/storage";
import { useProfile } from "@/features/customer/queries";
import { nextFreeLabel } from "@/features/discovery/BusinessCard";
import { useBusinessProfile } from "@/features/discovery/queries";
import { KIND_WORDS, profileKind } from "@/features/profile/profile";
import { duration, longDate, money, num, time } from "@/lib/format";
import { keys } from "@/lib/query/keys";
import type { PublicProfile } from "@/types/api";

/**
 * Booking, in the app — from a business's profile to a booking the
 * server has accepted.
 *
 * Service, then the person (when there is a choice), branch, table or
 * room, day and time, the customer's details, and a summary. The steps a
 * business does not need are not shown at all (features/booking/flow.ts).
 *
 * The server decides everything that matters. The times offered are
 * GET /slots; the price is POST /quote; the booking is POST /bookings,
 * which re-derives the slot inside a transaction with a database
 * constraint underneath, so two people tapping the same time at once get
 * one booking and one "that time was just taken". The app never shows a
 * booking as confirmed — the result screen (app/booking/[token].tsx)
 * reads the booking back and says what the server says.
 *
 * Every answer is saved as it is given (features/booking/storage.ts), so
 * backgrounding, a killed app or a dropped connection lose nothing; a
 * submission carries an idempotency key, so retrying it after a lost
 * reply returns the same booking instead of making a second.
 */

export default function BookScreen() {
  const { slug, service, staff } = useLocalSearchParams<{ slug: string; service?: string; staff?: string }>();
  const profile = useBusinessProfile(slug);
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";

  const [restored, setRestored] = useState<{ draft: Draft; attempt: Attempt | null; resumed: boolean } | null>(null);

  // Signing in clears the query cache, so the profile disappears and the
  // flow unmounts for a moment. When it comes back it must start from
  // what was saved since, not from the draft it first opened with.
  // Adjusted while rendering, React's pattern for state derived from a change.
  const [seen, setSeen] = useState(profile.data);
  if (seen !== profile.data) {
    setSeen(profile.data);
    if (!profile.data && restored) setRestored(null);
  }

  // The saved draft, read once and checked against the business as it is now.
  useEffect(() => {
    if (!profile.data || restored) return;
    let cancelled = false;
    (async () => {
      const p = profile.data;
      const saved = await loadSaved(p.slug);
      if (cancelled) return;
      // A link that names a service starts from that service, unless the
      // saved draft is already about it.
      const fromLink = service && p.services.some((s) => s.id === service) ? service : null;
      if (saved && (!fromLink || saved.draft.serviceId === fromLink)) {
        setRestored({ draft: reconcile(p, saved.draft), attempt: saved.attempt, resumed: true });
        trackBooking("booking_resumed", { slug: p.slug, step: saved.draft.step });
        return;
      }
      let d: Draft = { ...EMPTY_DRAFT };
      if (fromLink) {
        d = change(p, d, { serviceId: fromLink });
        if (staff && peopleFor(p, fromLink).some((m) => m.id === staff)) d = { ...d, staffId: staff };
        d = { ...d, step: firstOpenStep(p, d) };
      } else if (p.services.length === 1 && p.services[0]) {
        d = change(p, d, { serviceId: p.services[0].id });
        d = { ...d, step: firstOpenStep(p, d) };
      }
      setRestored({ draft: d, attempt: null, resumed: false });
      trackBooking("booking_started", { slug: p.slug, preselected: Boolean(fromLink), category: p.category.slug });
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.data, restored, service, staff]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace(`/business/${slug}`));

  if (profile.isLoading || (profile.data && !restored)) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]} accessibilityLabel={ar ? "بيحمّل" : "Loading"}>
        <View style={styles.body}>
          <Skeleton width="50%" height={24} />
          <Skeleton height={4} />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  if (!profile.data || !restored) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header title={ar ? "الحجز" : "Booking"} back onBack={leave} />
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      </View>
    );
  }

  if (profile.data.services.length === 0) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <Header title={ar ? "الحجز" : "Booking"} back onBack={leave} />
        <EmptyState
          icon="calendar-outline"
          title={ar ? "مفيش خدمات تتحجز هنا" : "Nothing to book here yet"}
          body={ar ? "المكان لسه ماضافش خدمات. تقدر تتواصل معاهم." : "This business hasn't added bookable services. You can still contact them."}
          action={<Button label={ar ? "رجوع" : "Back"} onPress={leave} />}
        />
      </View>
    );
  }

  return <Flow p={profile.data} initial={restored.draft} initialAttempt={restored.attempt} resumed={restored.resumed} onLeave={leave} />;
}

/* ─── The flow ───────────────────────────────────────────── */

function Flow({
  p,
  initial,
  initialAttempt,
  resumed,
  onLeave,
}: {
  p: PublicProfile;
  initial: Draft;
  initialAttempt: Attempt | null;
  resumed: boolean;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const account = useProfile();
  const me = user ? account.data : undefined;

  const [d, setD] = useState<Draft>(() => ({
    ...initial,
    // A signed-in customer's name, unless they typed one already.
    name: initial.name || user?.name || "",
    email: initial.email || user?.email || "",
  }));
  const attempt = useRef<Attempt | null>(initialAttempt);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [showResumed, setShowResumed] = useState(resumed && initial.step !== "service");
  const [timeLost, setTimeLost] = useState(false);
  const [codeInput, setCodeInput] = useState(initial.code);
  const [touched, setTouched] = useState(false);
  const finished = useRef(false);
  const scroll = useRef<ScrollView>(null);

  const kind = profileKind(p);
  const words = KIND_WORDS[kind];
  const steps = useMemo(() => stepsFor(p, d), [p, d]);
  const step = steps.includes(d.step) ? d.step : firstOpenStep(p, d);
  const index = steps.indexOf(step);
  const name = (!ar && p.nameEn) || p.nameAr;

  const svc = p.services.find((s) => s.id === d.serviceId) ?? null;
  const people = peopleFor(p, d.serviceId);
  const person = people.find((m) => m.id === d.staffId) ?? null;
  const branch = p.branches.find((b) => b.id === d.branchId) ?? null;
  const resources = resourcesFor(p, d.branchId);
  const resource = resources.find((r) => r.id === d.resourceId) ?? null;

  // Saved on every change, so nothing is lost to a backgrounded or killed app.
  useEffect(() => {
    void save(p.slug, { ...d, step }, attempt.current);
  }, [d, step, p.slug]);

  // Name and email arrive with the account; fill them only if still empty.
  const [seenMe, setSeenMe] = useState(me);
  if (seenMe !== me) {
    setSeenMe(me);
    if (me && (!d.name || !d.email)) setD((x) => ({ ...x, name: x.name || me.name || "", email: x.email || me.email || "" }));
  }

  // Abandonment, said once, with where it happened.
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(
    () => () => {
      if (!finished.current) trackBooking("booking_abandoned", { slug: p.slug, step: stepRef.current });
    },
    [p.slug],
  );

  useEffect(() => {
    trackBooking("booking_step_viewed", { slug: p.slug, step, index, total: steps.length });
    if (step === "summary") trackBooking("booking_summary_viewed", { slug: p.slug, hasDeposit: Boolean(p.policies.depositPercent) });
    scroll.current?.scrollTo({ y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const update = useCallback((patch: Partial<Draft>) => setD((x) => change(p, x, patch)), [p]);
  const go = (s: Step) => setD((x) => ({ ...x, step: s }));

  const back = useCallback(() => {
    const prev = previousStep(steps, step);
    if (prev) {
      setD((x) => ({ ...x, step: prev }));
      return true;
    }
    onLeave();
    return true;
  }, [steps, step, onLeave]);

  // Android's back button walks back through the steps, not out of them.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const sub = BackHandler.addEventListener("hardwareBackPress", back);
      return () => sub.remove();
    }, [back]),
  );

  /* ── Availability ── */

  const slotQuery =
    d.serviceId && d.date
      ? { serviceId: d.serviceId, date: d.date, staffMemberId: d.staffId, resourceId: d.resourceId, branchId: d.branchId }
      : null;
  const slots = useSlots(p.slug, step === "when" || step === "summary" ? slotQuery : null);

  // Back from the background on the time screen: the times may have moved.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void queryClient.invalidateQueries({ queryKey: ["booking", "slots"] });
    });
    return () => sub.remove();
  }, [queryClient]);

  // A chosen time that the server no longer offers is let go, and said
  // so — checked whenever fresh times arrive.
  const [seenSlots, setSeenSlots] = useState(slots.data);
  if (seenSlots !== slots.data) {
    setSeenSlots(slots.data);
    if (slots.data && d.time && !slots.data.slots.includes(d.time)) {
      setD((x) => ({ ...x, time: null, step: x.step === "summary" ? "when" : x.step }));
      setTimeLost(true);
    }
  }

  useEffect(() => {
    if (slots.data && slotQuery) {
      trackBooking("booking_slots_loaded", { slug: p.slug, count: slots.data.slots.length, reason: slots.data.reason ?? undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.data]);

  /* ── Price ── */

  const quote = useQuote(p.slug, d.serviceId, d.code || null);
  const codeRejected = quote.data?.codeError ?? null;
  const appliedCode = d.code && quote.data && !quote.data.codeError ? d.code : null;
  const totalCents = quote.data ? quote.data.totalCents : svc?.price ? Math.round(svc.price * 100) : 0;
  const depositCents = depositPreviewCents(totalCents, p.policies.depositPercent);
  const currency = quote.data?.currency ?? svc?.currency ?? p.currency;
  const fmt = (cents: number) => money(cents / 100, currency, lang) ?? `${num(cents / 100, lang)} ${currency}`;

  /* ── Moving on ── */

  const phone = me?.phoneVerified ? me.phone : null;
  const ready = canAdvance(p, d, step);

  const onNext = () => {
    setTouched(true);
    if (!ready) return;
    if (step === "details") {
      trackBooking("booking_details_completed", { slug: p.slug, email: Boolean(d.email.trim()), notes: Boolean(d.notes.trim()) });
    }
    const n = nextStep(steps, step);
    if (n) {
      setTouched(false);
      go(n);
    }
  };

  /* ── Submitting ── */

  const submit = async () => {
    if (inFlight.current) return; // a second tap, while the first is still out
    if (!phone) return;
    const body = requestBody(p, d, phone, appliedCode);
    if (!body) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    // The same body keeps the same key: a retry after a lost reply finds
    // the booking the first attempt made rather than making another.
    const fp = fingerprint(body);
    const key = attempt.current && attempt.current.fp === fp ? attempt.current.key : newIdempotencyKey();
    attempt.current = { key, fp };
    await save(p.slug, d, attempt.current);
    trackBooking("booking_submitted", { slug: p.slug, deposit: Boolean(depositCents), discount: Boolean(appliedCode) });

    try {
      const res = await createBooking(p.slug, { ...body, idempotencyKey: key });
      const b = res.booking;

      // A replay of an attempt whose payment session never opened: the
      // server holds a failed booking under this key. Not a success.
      if (b.status === "FAILED_PAYMENT") {
        attempt.current = null;
        await save(p.slug, d, null);
        setFailure({ ...paymentUnavailable(lang), recovery: "retry", code: "payment-unavailable" });
        trackBooking("booking_failed", { slug: p.slug, code: "payment-unavailable" });
        return;
      }

      attempt.current = { key, fp, token: b.accessToken, paymentUrl: res.paymentUrl };
      trackBooking("booking_created", {
        slug: p.slug,
        reference: b.reference ?? undefined,
        status: b.status,
        replay: Boolean(res.idempotentReplay),
      });
      if (res.paymentUrl) await rememberPayment(b.accessToken, res.paymentUrl, (!ar && p.nameEn) || p.nameAr);

      finished.current = true;
      await clearSaved(p.slug);
      void queryClient.invalidateQueries({ queryKey: keys.myBookings.all });
      void queryClient.invalidateQueries({ queryKey: keys.booking.all });
      router.replace({
        pathname: "/booking/[token]",
        params: { token: b.accessToken, ...(res.requiresPayment ? { pay: "1" } : {}) },
      });
    } catch (e) {
      const f = describeFailure(e, lang);
      if (!keepsKey(f.recovery, f.code)) {
        attempt.current = null;
        await save(p.slug, d, null);
      }
      trackBooking(f.recovery === "pick-time" ? "booking_slot_conflict" : "booking_failed", { slug: p.slug, code: f.code });
      setFailure(f);
      if (f.recovery === "pick-time") void queryClient.invalidateQueries({ queryKey: ["booking", "slots"] });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const recover = () => {
    const f = failure;
    setFailure(null);
    if (!f) return;
    switch (f.recovery) {
      case "pick-time":
        setD((x) => ({ ...x, time: null, step: "when" }));
        return;
      case "edit":
        if (f.code.startsWith("discount")) {
          setCodeInput("");
          setD((x) => ({ ...x, code: "" }));
        }
        go("details");
        return;
      case "retry":
        void submit();
        return;
      case "sign-in":
        signInThenReturn(`/book/${p.slug}`);
        return;
      case "none":
        return;
    }
  };

  /* ── Screens ── */

  const stepTitle: Record<Step, string> = {
    service: words.services[lang],
    staff: kind === "clinic" ? T("اختار الدكتور", "Choose a doctor") : T("مع مين؟", "Choose who"),
    branch: T("اختار الفرع", "Choose a branch"),
    resource: resourceTitle(resources[0]?.kind, lang),
    when: T("اليوم والميعاد", "Date & time"),
    details: T("بياناتك", "Your details"),
    summary: T("راجع حجزك", "Review your booking"),
  };

  let content: React.ReactNode = null;

  if (step === "service") {
    content = (
      <View style={styles.list} accessibilityRole="radiogroup">
        {p.services.map((s) => (
          <ServiceCard
            key={s.id}
            name={(!ar && s.nameEn) || s.nameAr}
            description={ar ? s.descriptionAr : null}
            durationMinutes={s.durationMinutes}
            price={s.price}
            currency={s.currency}
            selected={d.serviceId === s.id}
            onPress={() => {
              update({ serviceId: s.id });
              trackBooking("booking_service_selected", { slug: p.slug, serviceId: s.id });
            }}
          />
        ))}
      </View>
    );
  } else if (step === "staff") {
    content = (
      <View style={styles.list} accessibilityRole="radiogroup">
        <Choice
          selected={d.staffId === null}
          icon="people-outline"
          title={T("أي حد متاح", "Anyone available")}
          subtitle={T("أسرع طريقة تلاقي ميعاد", "The quickest way to an opening")}
          onPress={() => {
            update({ staffId: null });
            trackBooking("booking_staff_selected", { slug: p.slug, anyone: true });
          }}
        />
        {people.map((m) => (
          <Choice
            key={m.id}
            selected={d.staffId === m.id}
            photo={m.photo}
            title={(!ar && m.nameEn) || m.nameAr}
            subtitle={[m.role, nextFreeLabel(m.nextSlot, lang)].filter(Boolean).join(" · ") || null}
            onPress={() => {
              update({ staffId: m.id });
              trackBooking("booking_staff_selected", { slug: p.slug, anyone: false, staffId: m.id });
            }}
          />
        ))}
      </View>
    );
  } else if (step === "branch") {
    content = (
      <View style={styles.list} accessibilityRole="radiogroup">
        {p.branches.map((b) => (
          <Choice
            key={b.id}
            selected={d.branchId === b.id}
            icon="location-outline"
            title={(!ar && b.nameEn) || b.nameAr}
            subtitle={b.address}
            onPress={() => {
              update({ branchId: b.id });
              trackBooking("booking_branch_selected", { slug: p.slug, branchId: b.id });
            }}
          />
        ))}
      </View>
    );
  } else if (step === "resource") {
    const seats = Math.max(1, ...resources.map((r) => r.capacity ?? 1));
    content = (
      <View style={styles.list}>
        {asksPartySize(resources) ? (
          <Card>
            <Counter
              label={T("عدد الأشخاص", "Number of guests")}
              value={d.partySize}
              min={1}
              max={Math.min(50, seats)}
              onChange={(n) => update({ partySize: n })}
            />
          </Card>
        ) : null}
        <View style={styles.list} accessibilityRole="radiogroup">
          {resources.map((r) => {
            const small = tooSmall(r, d.partySize);
            return (
              <Choice
                key={r.id}
                selected={d.resourceId === r.id}
                disabled={small}
                icon={r.kind === "TABLE" ? "restaurant-outline" : r.kind === "ROOM" ? "business-outline" : "cube-outline"}
                title={r.name}
                subtitle={[r.area, r.capacity !== null ? T(`${num(r.capacity, lang)} أشخاص`, `Seats ${r.capacity}`) : null].filter(Boolean).join(" · ") || null}
                note={small ? T("مش هتكفي العدد ده", "Too small for your party") : null}
                onPress={() => {
                  update({ resourceId: r.id });
                  trackBooking("booking_resource_selected", { slug: p.slug, kind: r.kind });
                }}
              />
            );
          })}
        </View>
      </View>
    );
  } else if (step === "when") {
    const { from, count } = bookableDays(p);
    content = (
      <View style={styles.list}>
        <DateStrip
          value={d.date}
          from={from}
          days={count}
          isAvailable={(iso) => mightBeOpen(iso, p.hours, person)}
          onChange={(iso) => {
            setTimeLost(false);
            update({ date: iso });
            trackBooking("booking_date_selected", { slug: p.slug, date: iso });
          }}
        />
        {timeLost ? (
          <Notice icon="alert-circle-outline" tone="warn">
            <Text variant="body">{T("الميعاد اللي اخترته اتحجز. اختار ميعاد تاني.", "The time you picked has just been taken. Please choose another.")}</Text>
          </Notice>
        ) : null}
        {!d.date ? (
          <Text variant="body" tone="muted">
            {T("اختار يوم عشان تشوف المواعيد الفاضية.", "Pick a day to see the free times.")}
          </Text>
        ) : slots.isLoading ? (
          <View style={styles.list} accessibilityLabel={T("بيدوّر على مواعيد", "Finding times")}>
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        ) : slots.error ? (
          <ErrorState error={slots.error} onRetry={() => slots.refetch()} />
        ) : slots.data && slots.data.slots.length === 0 ? (
          <EmptyState icon="time-outline" title={T("مفيش مواعيد", "No times")} body={emptyDayReason(slots.data.reason, lang)} />
        ) : slots.data ? (
          <>
            <View style={styles.between}>
              <Text variant="label" tone="muted">
                {longDate(d.date, lang)}
              </Text>
              <Button
                size="sm"
                variant="ghost"
                icon="refresh"
                label={T("تحديث", "Refresh")}
                loading={slots.isFetching}
                onPress={() => slots.refetch()}
              />
            </View>
            <TimeSlots
              slots={slots.data.slots}
              value={d.time}
              onChange={(t) => {
                setTimeLost(false);
                update({ time: t });
                trackBooking("booking_time_selected", { slug: p.slug, time: t });
              }}
            />
          </>
        ) : null}
      </View>
    );
  } else if (step === "details") {
    const errors = touched ? detailsErrors(d) : [];
    content = !user ? (
      <EmptyState
        icon="person-circle-outline"
        title={T("سجّل دخولك عشان تحجز", "Sign in to book")}
        body={T(
          "بنأكد رقم موبايلك مرة واحدة، والحجز يظهر في حجوزاتك. اختياراتك محفوظة.",
          "We confirm your phone number once, and the booking appears in your bookings. Your choices are saved.",
        )}
        action={<Button label={T("تسجيل الدخول", "Sign in")} onPress={() => signInThenReturn(`/book/${p.slug}`)} />}
      />
    ) : account.isLoading ? (
      <View style={styles.list}>
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    ) : account.error ? (
      <ErrorState error={account.error} onRetry={() => account.refetch()} />
    ) : !phone ? (
      <EmptyState
        icon="call-outline"
        title={T("محتاجين رقم موبايل متأكد", "A verified phone number is needed")}
        body={T("الحجز بيتسجل على رقم موبايلك، وعليه بتوصلك التأكيدات. ضيفه من حسابك.", "Bookings are made under your phone number, and confirmations go to it. Add one in your account.")}
        action={<Button label={T("حسابي", "My account")} onPress={() => router.push("/(customer)/account")} />}
      />
    ) : (
      <View style={styles.list}>
        <TextField
          label={T("الاسم", "Full name")}
          required
          value={d.name}
          onChangeText={(v) => setD((x) => ({ ...x, name: v }))}
          autoComplete="name"
          textContentType="name"
          error={errors.includes("name") ? T("اكتب اسمك (حرفين على الأقل)", "Enter your name (at least 2 letters)") : null}
        />
        <View style={styles.phone} accessible accessibilityLabel={`${T("رقم الموبايل", "Phone")}: ${phone}`}>
          <Text variant="label" tone="ink2">
            {T("رقم الموبايل", "Phone")}
          </Text>
          <Text variant="bodyBold" style={ltr}>
            +{phone.replace(/^\+/, "")}
          </Text>
          <Text variant="caption" tone="subtle">
            {T("رقمك المتأكد — عليه بيوصلك التأكيد والتذكير.", "Your verified number — confirmations and reminders go here.")}
          </Text>
        </View>
        <TextField
          label={T("الإيميل (اختياري)", "Email (optional)")}
          value={d.email}
          onChangeText={(v) => setD((x) => ({ ...x, email: v }))}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          ltr
          error={errors.includes("email") ? T("الإيميل مش مظبوط", "That email doesn't look right") : null}
        />
        <TextField
          label={T("ملاحظات للمكان (اختياري)", "Notes for the business (optional)")}
          value={d.notes}
          onChangeText={(v) => setD((x) => ({ ...x, notes: v.slice(0, 500) }))}
          multiline
          maxLength={500}
          hint={`${num(d.notes.length, lang)}/${num(500, lang)}`}
        />
        <View style={styles.codeRow}>
          <View style={styles.flex}>
            <TextField
              label={T("كود خصم (اختياري)", "Discount code (optional)")}
              value={codeInput}
              onChangeText={setCodeInput}
              autoCapitalize="characters"
              ltr
              error={d.code && codeRejected ? (ar ? codeRejected : "This code can't be used") : null}
              hint={appliedCode && quote.data?.discount ? T(`اتطبق: ${fmt(quote.data.discount.amountCents)} خصم`, `Applied: ${fmt(quote.data.discount.amountCents)} off`) : undefined}
            />
          </View>
          <Button
            size="sm"
            variant="outline"
            label={d.code && d.code === codeInput.trim() ? T("شيل", "Remove") : T("طبّق", "Apply")}
            loading={quote.isFetching && Boolean(codeInput.trim())}
            onPress={() => {
              const next = d.code && d.code === codeInput.trim() ? "" : codeInput.trim();
              if (!next) setCodeInput("");
              setD((x) => ({ ...x, code: next }));
            }}
            style={styles.codeButton}
          />
        </View>
      </View>
    );
  } else if (step === "summary") {
    content = (
      <Summary
        p={p}
        d={d}
        personName={person ? (!ar && person.nameEn) || person.nameAr : people.length > 0 ? T("أي حد متاح", "Anyone available") : null}
        branchName={branch ? (!ar && branch.nameEn) || branch.nameAr : null}
        resourceName={resource?.name ?? null}
        subtotalCents={quote.data?.subtotalCents ?? totalCents}
        discountCents={appliedCode || quote.data?.discount?.automatic ? (quote.data?.discount?.amountCents ?? 0) : 0}
        discountName={quote.data?.discount?.nameAr ?? null}
        totalCents={totalCents}
        depositCents={depositCents}
        priced={Boolean(svc?.price)}
        fmt={fmt}
        phone={phone}
        onEdit={go}
      />
    );
  }

  const isSummary = step === "summary";
  const blockedOnAccount = step === "details" && (!user || !phone);
  const primaryLabel = isSummary
    ? depositCents
      ? T(`ادفع العربون ${fmt(depositCents)} واحجز`, `Pay ${fmt(depositCents)} deposit & book`)
      : p.autoConfirm
        ? T("أكّد الحجز", "Confirm booking")
        : T("ابعت طلب الحجز", "Send booking request")
    : T("التالي", "Continue");

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <Header title={name} subtitle={stepTitle[step]} back onBack={back} />
      <View style={styles.progressWrap}>
        <Progress index={index} total={steps.length} label={stepTitle[step]} />
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={[styles.body, { paddingBottom: 140 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {showResumed ? (
          <Notice icon="bookmark-outline">
            <Text variant="body">{T("كمّلنا من مكان ما وقفت.", "Picked up where you left off.")}</Text>
            <Button
              size="sm"
              variant="ghost"
              label={T("ابدأ من الأول", "Start over")}
              onPress={() => {
                setShowResumed(false);
                attempt.current = null;
                setCodeInput("");
                setD({ ...EMPTY_DRAFT, name: d.name, email: d.email });
              }}
              style={styles.startOver}
            />
          </Notice>
        ) : null}

        {svc && step !== "service" && step !== "summary" ? <Picked p={p} d={d} /> : null}

        <Text variant="title" accessibilityRole="header">
          {stepTitle[step]}
        </Text>
        {content}
      </ScrollView>

      {!blockedOnAccount ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          {isSummary ? (
            <Text variant="caption" tone="subtle" align="center">
              {depositCents
                ? T("هتدفع العربون في صفحة دفع آمنة. الحجز بيتأكد بعد ما الدفع يتم.", "You'll pay on a secure payment page. The booking is confirmed once payment succeeds.")
                : T("مش هتدفع حاجة دلوقتي.", "Nothing is charged now.")}
            </Text>
          ) : step === "when" && !ready && d.date ? (
            <Text variant="caption" tone="subtle" align="center">
              {T("اختار ميعاد عشان تكمّل", "Pick a time to continue")}
            </Text>
          ) : null}
          <Button
            label={primaryLabel}
            icon={isSummary ? (depositCents ? "card-outline" : "checkmark-circle-outline") : undefined}
            fullWidth
            loading={submitting}
            disabled={isSummary ? submitting || !phone : !ready && step !== "details"}
            onPress={isSummary ? submit : onNext}
          />
        </View>
      ) : null}

      <Dialog
        open={failure !== null}
        onClose={() => setFailure(null)}
        title={failure?.title ?? ""}
        body={failure?.body}
        icon={failure?.recovery === "pick-time" ? "time-outline" : failure?.recovery === "retry" ? "cloud-offline-outline" : "alert-circle-outline"}
        tone={failure?.recovery === "none" ? "danger" : "warn"}
        actions={
          <>
            {failure && failure.recovery !== "none" ? (
              <Button
                fullWidth
                label={
                  failure.recovery === "pick-time"
                    ? T("اختار ميعاد تاني", "Choose another time")
                    : failure.recovery === "retry"
                      ? T("حاول تاني", "Try again")
                      : failure.recovery === "sign-in"
                        ? T("تسجيل الدخول", "Sign in")
                        : T("عدّل", "Edit details")
                }
                onPress={recover}
              />
            ) : null}
            <Button fullWidth variant="ghost" label={T("قفل", "Close")} onPress={() => setFailure(null)} />
          </>
        }
      />
    </View>
  );
}

function paymentUnavailable(lang: "ar" | "en"): Pick<Failure, "title" | "body"> {
  return lang === "ar"
    ? { title: "الدفع مش شغال دلوقتي", body: "مفيش فلوس اتخصمت والميعاد اتساب. جرّب تاني بعد شوية." }
    : { title: "Payment couldn't start", body: "Nothing was charged and the time was released. Try again in a moment." };
}

function resourceTitle(kind: string | undefined, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (kind) {
    case "TABLE":
      return ar ? "اختار الترابيزة" : "Choose a table";
    case "ROOM":
      return ar ? "اختار الأوضة" : "Choose a room";
    case "CHAIR":
      return ar ? "اختار الكرسي" : "Choose a chair";
    default:
      return ar ? "اختار المكان" : "Choose a spot";
  }
}

function resourceNoun(kind: string | undefined, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  switch (kind) {
    case "TABLE":
      return ar ? "الترابيزة" : "Table";
    case "ROOM":
      return ar ? "الأوضة" : "Room";
    case "CHAIR":
      return ar ? "الكرسي" : "Chair";
    default:
      return ar ? "المكان" : "Spot";
  }
}

/** What has been chosen so far, kept in view above each later step. */
function Picked({ p, d }: { p: PublicProfile; d: Draft }) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const svc = p.services.find((s) => s.id === d.serviceId);
  if (!svc) return null;
  const person = p.staff.find((m) => m.id === d.staffId);
  const bits = [
    (!ar && svc.nameEn) || svc.nameAr,
    duration(svc.durationMinutes, lang),
    person ? (!ar && person.nameEn) || person.nameAr : null,
    d.date ? longDate(d.date, lang) : null,
    d.time ? time(d.time, lang) : null,
  ].filter(Boolean);
  return (
    <View style={styles.picked}>
      {bits.map((b) => (
        <Badge key={b as string} tone="neutral" label={b as string} />
      ))}
    </View>
  );
}

function Summary({
  p,
  d,
  personName,
  branchName,
  resourceName,
  subtotalCents,
  discountCents,
  discountName,
  totalCents,
  depositCents,
  priced,
  fmt,
  phone,
  onEdit,
}: {
  p: PublicProfile;
  d: Draft;
  personName: string | null;
  branchName: string | null;
  resourceName: string | null;
  subtotalCents: number;
  discountCents: number;
  discountName: string | null;
  totalCents: number;
  depositCents: number | null;
  priced: boolean;
  fmt: (cents: number) => string;
  phone: string | null;
  onEdit: (step: Step) => void;
}) {
  const { lang } = useLocale();
  const ar = lang === "ar";
  const T = (a: string, e: string) => (ar ? a : e);
  const svc = p.services.find((s) => s.id === d.serviceId);
  if (!svc || !d.date || !d.time) return null;
  const resource = p.resources.find((r) => r.id === d.resourceId);
  const branchAddress = p.branches.find((b) => b.id === d.branchId)?.address ?? p.address;

  return (
    <View style={styles.list}>
      <Card>
        <Row label={T("المكان", "Business")} value={(!ar && p.nameEn) || p.nameAr} strong />
        {branchName ? <Row label={T("الفرع", "Branch")} value={branchName} /> : null}
        {branchAddress ? <Row label={T("العنوان", "Address")} value={branchAddress} tone="muted" /> : null}
        <Row label={T("الخدمة", "Service")} value={(!ar && svc.nameEn) || svc.nameAr} />
        {personName ? <Row label={profileKind(p) === "clinic" ? T("الدكتور", "Doctor") : T("مع", "With")} value={personName} /> : null}
        {resourceName ? <Row label={resourceNoun(resource?.kind, lang)} value={resourceName} /> : null}
        {resource && resource.capacity !== null ? <Row label={T("عدد الأشخاص", "Guests")} value={num(d.partySize, lang)} /> : null}
        <Row label={T("اليوم", "Date")} value={longDate(d.date, lang)} />
        <Row label={T("الميعاد", "Time")} value={`${time(d.time, lang)} · ${duration(svc.durationMinutes, lang)}`} />
        <Button size="sm" variant="ghost" icon="calendar-outline" label={T("غيّر الميعاد", "Change time")} onPress={() => onEdit("when")} style={styles.edit} />
      </Card>

      <Card>
        {priced ? (
          <>
            {discountCents > 0 ? (
              <>
                <Row label={T("السعر", "Price")} value={fmt(subtotalCents)} tone="muted" />
                <Row label={discountName ?? T("خصم", "Discount")} value={`− ${fmt(discountCents)}`} tone="ok" />
              </>
            ) : null}
            <Row label={T("الإجمالي", "Total")} value={fmt(totalCents)} strong />
            {depositCents ? (
              <>
                <Row label={T("عربون دلوقتي", "Deposit due now")} value={fmt(depositCents)} strong />
                <Row label={T("الباقي في المكان", "Pay at the venue")} value={fmt(Math.max(0, totalCents - depositCents))} />
              </>
            ) : (
              <Row label={T("الدفع", "Payment")} value={T("في المكان", "At the venue")} />
            )}
            <Text variant="caption" tone="subtle">
              {T("الأسعار زي ما المكان حاططها، من غير رسوم حجز.", "Prices are as set by the business. No booking fee.")}
            </Text>
          </>
        ) : (
          <Row label={T("السعر", "Price")} value={T("السعر بيتحدد في المكان", "Priced at the venue")} />
        )}
      </Card>

      <Card tone="tint">
        <Text variant="label" tone="ink2" accessibilityRole="header">
          {T("سياسة الحجز", "Booking policy")}
        </Text>
        <Text variant="body" tone="ink2">
          {T(
            `تقدر تلغي أو تغيّر ميعادك بنفسك لحد ${duration(p.policies.changeCutoffHours * 60, "ar")} قبل الميعاد.`,
            `You can cancel or reschedule yourself up to ${p.policies.changeCutoffHours} hours before the appointment.`,
          )}
        </Text>
        <Text variant="body" tone="ink2">
          {p.autoConfirm
            ? T("الحجز بيتأكد على طول.", "Bookings here are confirmed instantly.")
            : T("المكان بيراجع الحجز ويأكده — هيوصلك إشعار.", "The business reviews and confirms each booking — you'll be notified.")}
        </Text>
        {depositCents ? (
          <Text variant="body" tone="ink2">
            {T("العربون بيتدفع أونلاين عشان يتثبت الميعاد، والباقي في المكان.", "The deposit is paid online to secure the time; the rest is paid at the venue.")}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Row label={T("باسم", "Name")} value={d.name.trim()} />
        {phone ? <Row label={T("الموبايل", "Phone")} value={`+${phone.replace(/^\+/, "")}`} ltrValue /> : null}
        {d.email.trim() ? <Row label={T("الإيميل", "Email")} value={d.email.trim()} ltrValue /> : null}
        {d.notes.trim() ? <Row label={T("ملاحظات", "Notes")} value={d.notes.trim()} /> : null}
        <Button size="sm" variant="ghost" icon="create-outline" label={T("عدّل البيانات", "Edit details")} onPress={() => onEdit("details")} style={styles.edit} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
  progressWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  list: { gap: spacing.sm },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  picked: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  phone: { gap: spacing.xxs, paddingVertical: spacing.xs },
  codeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  codeButton: { marginTop: 26 },
  startOver: { alignSelf: "flex-start" },
  edit: { alignSelf: "flex-start" },
  footer: {
    position: "absolute",
    start: 0,
    end: 0,
    bottom: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
