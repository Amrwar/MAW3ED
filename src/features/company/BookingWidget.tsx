"use client";

import { useState, useEffect, useRef, useId } from "react";
import type { TrafficSource } from "@prisma/client";
import {
  ChevronRight, ChevronLeft, CheckCircle,
  Loader2, CalendarDays, Clock, Check, Users, Scissors,
} from "lucide-react";
import type { Service } from "@/types/service";
import type { PublicResource, PublicStaff } from "./CompanyContent";
import { money, duration as fmtDuration, arCount, clock12, dayPart } from "@/lib/fmt";
import { depositCents } from "@/lib/payments/money";
import { normalisePhone } from "@/lib/phone";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  chooseResourceLabel,
  providerLabel,
  resourceLabel,
} from "@/lib/scheduling/resource-labels";

// ─── Types ────────────────────────────────────────────────

interface BookingWidgetProps {
  services:            Service[];
  businessName:        string;
  slug:                string;
  openDays:            number[];
  preselectedService?: Service | null;
  /**
   * A provider chosen before arriving (the app's staff list). Applied
   * once, with the first preselected service, and only when they perform
   * it; the provider step still shows, with them already picked.
   */
  initialStaffId?:     string | null;
  businessType:        "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  /** The channel that brought this visitor, for attribution. */
  source?:             TrafficSource;
  /** Tables, rooms, chairs, machines — whatever an appointment holds. */
  resources:           PublicResource[];
  staffMembers:        PublicStaff[];
  /** Locations. Most businesses have none, and the step is skipped. */
  branches?:           PublicBranch[];
  /** Only for the summary's preview; the server decides what is owed. */
  depositEnabled?:     boolean;
  depositPercent?:     number;
  /**
   * Customers can cancel or move a booking themselves until this many
   * hours before it (CUTOFF_HOURS in lib/bookings/self-service.ts, which
   * the cancel and reschedule routes enforce). Passed in so the policy
   * shown here is the one the API applies.
   */
  changeCutoffHours?:  number;
}

export type PublicBranch = {
  id:      string;
  nameAr:  string;
  address: string | null;
};

type BookingConfirmation = {
  id:            string;
  reference:     string | null;
  accessToken:   string | null;
  businessName:  string;
  serviceName:   string;
  date:          string;
  startTime:     string;
  endTime:       string;
  customerName:  string;
  totalPrice:    number;
  depositAmount: number | null;
  currency:      string;
  status?:       string;
};

type Lang = "ar" | "en";

/**
 * The steps, in the order a person answers them.
 *
 * `provider` and `resource` are independent dimensions, not two names
 * for one choice: a salon may schedule both a stylist and a chair, a
 * clinic a doctor and a room. Each appears when the business has
 * something to offer in it, which is what the availability engine and
 * the dashboard already do — a business that has configured neither is
 * asked about neither.
 *
 * Steps that do not apply are left out of the list entirely rather than
 * skipped through, so the stepper never counts to a number nobody will
 * reach.
 */
type Step =
  | "service"
  | "provider"
  | "resource"
  | "branch"
  | "date"
  | "time"
  | "details"
  | "summary"
  | "done";

// ─── Constants ────────────────────────────────────────────

const AR_DAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

// For the date strip, where there is room for a short name only. Not a
// prefix of AR_DAYS: three characters of "الأحد" and "الأربعاء" are
// both "الأ", so Sunday and Wednesday looked the same.
const AR_DAYS_SHORT = [
  "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت",
];

const EN_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const EN_DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ─── Helpers ──────────────────────────────────────────────

/**
 * A key that survives a retry of the same submission but not a fresh
 * run through the form. crypto.randomUUID where it exists; some older
 * in-app browsers on Android do not have it.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mwd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** What the server said about an empty day, in words. */
function emptyDayMessage(reason: string | null, lang: Lang): string {
  const en = lang === "en";
  switch (reason) {
    case "business-closed": return en ? "Closed on this day" : "المكان مقفول في اليوم ده";
    case "staff-off":       return en ? "This provider isn't available on this day" : "مقدّم الخدمة ده مش متاح في اليوم ده";
    case "holiday":         return en ? "Public holiday" : "إجازة رسمية";
    case "vacation":        return en ? "The provider is on leave" : "مقدّم الخدمة في إجازة";
    case "same-day-cutoff": return en ? "Booking for today has closed" : "الحجز قفل للنهارده";
    case "too-far-ahead":   return en ? "Booking isn't open for this date yet" : "الحجز مش مفتوح للتاريخ ده لسه";
    case "past":            return en ? "This day has passed" : "اليوم ده عدّى";
    default:                return en ? "No available times" : "مفيش مواعيد متاحة";
  }
}

/** Back and next, which four of the steps render identically. */
function StepButtons({
  onBack,
  onNext,
  nextEnabled,
  nextLabel,
  lang,
}: {
  onBack: () => void;
  onNext: () => void;
  nextEnabled: boolean;
  nextLabel?: string;
  lang: Lang;
}) {
  const en = lang === "en";
  return (
    <div className="flex gap-2 mt-5">
      <button
        onClick={onBack}
        className="flex-1 py-3.5 rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] text-[var(--color-muted)] font-bold text-sm flex items-center justify-center gap-1 transition-all"
      >
        <ChevronRight size={15} aria-hidden="true" className={en ? "rotate-180" : undefined} /> {en ? "Back" : "رجوع"}
      </button>
      <button
        disabled={!nextEnabled}
        onClick={onNext}
        className={`flex-1 py-3.5 rounded-[var(--radius-lg)] font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          nextEnabled
            ? "bg-[var(--color-jade)] hover:bg-[var(--color-jade-hover)] text-[var(--color-inverse)]"
            : "bg-[var(--color-surface-3)] text-[var(--color-faint)] cursor-not-allowed"
        }`}
      >
        {nextLabel ?? (en ? "Next" : "التالي")} <span className="text-base leading-none" aria-hidden="true">{en ? "→" : "←"}</span>
      </button>
    </div>
  );
}


/**
 * The next `count` days, counted from today in Cairo.
 *
 * Deliberately not the browser's today. A customer in London at 23:00
 * is already on tomorrow in Cairo, and the strip used to offer them a
 * day the server then refused as past — the kind of bug that looks like
 * the site is broken rather than like a timezone.
 */
function getUpcomingDays(count: number) {
  const todayCairo = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [y, m, d] = todayCairo.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);

  return Array.from({ length: count }, (_, i) => {
    // UTC arithmetic on a date with no time component: no hour can
    // shift it onto the wrong day.
    const day = new Date(base + i * 86_400_000);
    return {
      iso:     day.toISOString().slice(0, 10),
      dayAr:   AR_DAYS_SHORT[day.getUTCDay()],
      dayEn:   EN_DAYS_SHORT[day.getUTCDay()],
      dayNum:  day.getUTCDate(),
      monthAr: AR_MONTHS[day.getUTCMonth()],
      monthEn: EN_MONTHS[day.getUTCMonth()],
      dow:     day.getUTCDay(),
    };
  });
}

function formatDateAr(iso: string, lang: Lang = "ar"): string {
  const [y, m, d] = iso.split("-").map(Number);
  // UTC, to match how the strip above builds its days.
  const date = new Date(Date.UTC(y, m - 1, d));
  if (lang === "en") return `${EN_DAYS[date.getUTCDay()]}, ${d} ${EN_MONTHS[m - 1]} ${y}`;
  return `${AR_DAYS[date.getUTCDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

/** "ساعتين" / "3 ساعات" / "2 hours". */
function hoursPhrase(h: number, lang: Lang): string {
  if (lang === "en") return `${h} ${h === 1 ? "hour" : "hours"}`;
  return arCount(h, { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" });
}

/**
 * The self-service rule, as the cancel and reschedule routes apply it.
 * Nothing refunds a deposit when a customer cancels (refunds are a
 * manual support action), so the text does not promise one.
 */
export function changePolicyText(hours: number, lang: Lang, deposit: boolean): string {
  if (lang === "en") {
    return `You can cancel or change this booking yourself, from its booking page, up to ${hoursPhrase(hours, lang)} before the appointment.` +
      (deposit ? " A deposit is not refunded automatically when you cancel; contact the business about it." : "");
  }
  return `تقدر تلغي أو تغيّر ميعاد الحجز بنفسك من صفحة الحجز لحد ${hoursPhrase(hours, lang)} قبل الميعاد.` +
    (deposit ? " العربون مش بيترجع تلقائيًا لو لغيت، كلّم المكان بخصوصه." : "");
}

// ─── Sub-components ───────────────────────────────────────

function SummaryRow({
  label, value, ltr = false, bold = false, strike = false, good = false,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  bold?: boolean;
  /** The price before a discount came off it. */
  strike?: boolean;
  /** The amount that came off — read as a gain, not a charge. */
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-[var(--color-subtle)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={
          strike
            ? "text-end font-semibold text-[var(--color-subtle)] line-through"
            : good
              ? "text-end font-semibold text-[var(--color-ok)]"
              : `text-end ${bold ? "font-extrabold text-[var(--color-jade)]" : "font-semibold text-[var(--color-ink)]"}`
        }
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-1 h-5 bg-[var(--color-jade)] rounded-full" />
      <h3 className="text-base font-bold text-[var(--color-jade)]">{children}</h3>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

interface Quote {
  subtotalCents: number;
  totalCents: number;
  currency: string;
  discount: { nameAr: string; code: string | null; amountCents: number; automatic: boolean } | null;
  codeError: string | null;
}

export default function BookingWidget({
  services,
  businessName,
  slug,
  openDays,
  preselectedService,
  initialStaffId = null,
  businessType,
  resources,
  staffMembers,
  branches = [],
  source,
  depositEnabled = false,
  depositPercent = 0,
  changeCutoffHours = 2,
}: BookingWidgetProps) {
  // Ids for the details step. The four fields had visible <label>s with
  // no htmlFor and no id to point at, and a label that neither wraps
  // its input nor names one is associated with nothing: a screen reader
  // read out four anonymous boxes, and tapping a label focused none of
  // them. Scoped per instance so two widgets on a page cannot collide.
  const fid = useId();

  // The coupon the customer typed, and what the server said it is
  // worth. The widget never works out a price itself — it asks the same
  // endpoint the booking route asks, so the number shown here is the
  // number charged there.
  const [codeInput, setCodeInput] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const { t, lang } = useLanguage();
  const en = lang === "en";
  /** Arabic or English, by the page's language. */
  const tr = (ar: string, enText: string) => (en ? enText : ar);
  const staffName = (s: PublicStaff) => (en && s.nameEn ? s.nameEn : s.nameAr);
  // The services list above names a service in the page's language; the
  // widget named it in Arabic only, so one service had two names.
  const serviceName = (s: Service) => (en && s.nameEn ? s.nameEn : s.nameAr);
  // What this business schedules on, read off what it has rather than
  // off what it is. Both, either or neither is a valid answer.
  const hasStaff     = staffMembers.length > 0;
  const hasResources = resources.length > 0;
  const hasBranches  = branches.length > 1;

  /** The kind decides only what a resource is called on screen. */
  const resourceKind = resources[0]?.kind ?? null;

  /**
   * Party size is asked when a resource counts seats, not when the
   * business is a restaurant. A clinic room that seats nobody is not
   * asked about; a garden table for eight is.
   */
  const resourcesCountSeats = resources.some((r) => r.capacity != null);

  const ALL_STEPS: Step[] = [
    "service",
    ...(hasStaff     ? (["provider"] as Step[]) : []),
    ...(hasResources ? (["resource"] as Step[]) : []),
    ...(hasBranches  ? (["branch"]   as Step[]) : []),
    "date",
    "time",
    "details",
    "summary",
  ];

  const stepLabel = (s: Step): string => {
    if (s === "service")  return tr("الخدمة", "Service");
    if (s === "provider") return providerLabel(lang);
    if (s === "resource") return resourceLabel(resourceKind, lang, true);
    if (s === "branch")   return tr("الفرع", "Branch");
    if (s === "date")     return tr("اليوم", "Day");
    if (s === "time")     return tr("الوقت", "Time");
    if (s === "summary")  return tr("المراجعة", "Review");
    return tr("بياناتك", "Details");
  };

  const [step, setStep] = useState<Step>("service");

  // Each step replaces the last in place. Focus moves to the new one,
  // so a keyboard or screen-reader user is not left on a button that
  // no longer exists; the live region below says which step it is.
  const stepRef = useRef<HTMLDivElement>(null);
  // Null until the first commit: a link that preselects a service
  // moves the step during the first render, and that is not something
  // the visitor did, so it must not pull focus off the top of the page.
  const shownStep = useRef<Step | null>(null);
  useEffect(() => {
    const before = shownStep.current;
    shownStep.current = step;
    if (before === null || before === step) return;
    stepRef.current?.focus({ preventScroll: true });
  }, [step]);

  function goNext() {
    const idx = ALL_STEPS.indexOf(step);
    if (idx < ALL_STEPS.length - 1) setStep(ALL_STEPS[idx + 1]);
    else setStep("done");
  }
  function goBack() {
    const idx = ALL_STEPS.indexOf(step);
    if (idx > 0) setStep(ALL_STEPS[idx - 1]);
  }

  // ── Selections ──────────────────────────────────────────
  const [selectedService,  setSelectedService]  = useState<Service | null>(null);
  const [selectedResource, setSelectedResource] = useState<PublicResource | null>(null);
  const [selectedStaff,    setSelectedStaff]    = useState<PublicStaff | null>(null);
  const [partySize,        setPartySize]        = useState(2);

  const [selectedBranch, setSelectedBranch] = useState<PublicBranch | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  /**
   * One key per attempt at this booking, minted when the summary is
   * reached. A double-tap, a retry after a dropped connection or a
   * browser replay all carry the same key and return the same booking
   * rather than making a second one.
   */
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  /** Why the server says the chosen day is empty, when it says so. */
  const [slotsReason, setSlotsReason] = useState<string | null>(null);

  const [name,   setName]   = useState("");
  const [phone,  setPhone]  = useState("");
  const [email,  setEmail]  = useState("");
  const [notes,  setNotes]  = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  const [slots,        setSlots]        = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError,   setSlotsError]   = useState<string | null>(null);

  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);

  // Confirming the number with a WhatsApp code, when the server asks for
  // it (BOOKING_PHONE_VERIFICATION; signed-in customers never are). The
  // proof it returns is kept for retries of this same attempt.
  const [codeSent,   setCodeSent]   = useState(false);
  const [otp,        setOtp]        = useState("");
  const [phoneProof, setPhoneProof] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const days = getUpcomingDays(30);
  // Whether the day strip has more to show toward earlier / later days,
  // for its arrows and fade. Measured, not assumed: at either end there
  // is nothing to hint at.
  const [dayEdges, setDayEdges] = useState({ earlier: false, later: true });
  function measureDays() {
    const el = scrollRef.current;
    if (!el) return;
    // RTL scrolls with scrollLeft running from 0 to negative.
    const pos = Math.abs(el.scrollLeft);
    const max = el.scrollWidth - el.clientWidth;
    setDayEdges({ earlier: pos > 4, later: pos < max - 4 });
  }
  useEffect(() => {
    if (step === "date") measureDays();
  }, [step]);

  /** Pages the day strip toward later (1) or earlier (-1) days, in either direction of text. */
  function scrollDays(towardLater: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    // In RTL, later days lie to the left: scrollLeft runs negative.
    const sign = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollBy({ left: towardLater * sign * el.clientWidth * 0.8, behavior: "smooth" });
  }

  // The person in the link belongs to the service in the link: applied
  // only while that first preselection stands. Compared, not consumed, so
  // a render that runs twice (StrictMode) lands on the same answer, and
  // a link whose service no longer exists never pins the person to a
  // service the visitor picks themselves later. Applied during render
  // rather than in an effect, so the widget never paints the old step.
  const [arrivedWith] = useState(preselectedService);
  const [appliedPreselection, setAppliedPreselection] = useState<Service | null>(null);
  if (preselectedService && preselectedService !== appliedPreselection) {
    setAppliedPreselection(preselectedService);
    const wanted = preselectedService === arrivedWith ? initialStaffId : null;
    const staff = wanted
      ? staffMembers.find(
          (s) => s.id === wanted && (s.serviceIds.length === 0 || s.serviceIds.includes(preselectedService.id)),
        )
      : undefined;
    setSelectedService(preselectedService);
    setSelectedResource(null);
    setSelectedStaff(staff ?? null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setStep(
      hasStaff ? "provider" : hasResources ? "resource" : hasBranches ? "branch" : "date",
    );
  }

  // A new day, service or choice asks for the times again, from empty.
  const slotsKey = selectedDate && selectedService
    ? [selectedDate, selectedService.id, selectedStaff?.id, selectedResource?.id, selectedBranch?.id, slug].join("|")
    : null;
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  if (slotsKey !== slotsFor) {
    setSlotsFor(slotsKey);
    if (slotsKey) {
      setSlots([]);
      setSelectedTime(null);
      setSlotsError(null);
      setSlotsLoading(true);
    }
  }

  // Fetch available slots when date / service / resource changes. A
  // reply that arrives after the choice has moved on is dropped, so a
  // slow answer for one day never fills in the times of another.
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    let stale = false;

    const params = new URLSearchParams({
      serviceId: selectedService.id,
      date:      selectedDate,
    });
    if (selectedStaff)    params.set("staffMemberId", selectedStaff.id);
    // resourceId, not tableId: the slots endpoint reads resourceId, so
    // the old name meant the chosen table never narrowed availability
    // and the customer was offered times it was already taken.
    if (selectedResource) params.set("resourceId",    selectedResource.id);
    if (selectedBranch)   params.set("branchId",      selectedBranch.id);

    fetch(`/api/public/${slug}/slots?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (stale) return;
        setSlots(data.slots ?? []);
        setSlotsReason(data.reason ?? null);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (stale) return;
        setSlotsError(tr("معرفناش نحمّل المواعيد، جرّب تاني", "Couldn't load the times. Try again."));
        setSlotsLoading(false);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedService, selectedStaff, selectedResource, selectedBranch, slug]);

  function validate(): boolean {
    const errs: typeof errors = {};
    // Say what is wrong rather than repeating the label: "a" is a name
    // that is too short, not a missing one, and "123" is a number that
    // cannot be read. The phone rule is the server's (normalisePhone),
    // so nothing passes here that the booking route then refuses.
    const trimmedName = name.trim();
    if (!trimmedName)
      errs.name = tr("اكتب اسمك", "Enter your name");
    else if (trimmedName.length < 2)
      errs.name = tr("الاسم قصير أوي", "Name is too short");
    if (!phone.trim())
      errs.phone = tr("اكتب رقم موبايلك", "Enter your mobile number");
    else if (!normalisePhone(phone))
      errs.phone = tr(
        "اكتب رقم صحيح زي 01012345678، أو بكود الدولة لو من برّه مصر",
        "Enter a valid number like 01012345678, or with the country code outside Egypt",
      );
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = tr("الإيميل ده مش صحيح", "That email isn't valid");
    setErrors(errs);
    return !errs.name && !errs.phone && !errs.email;
  }

  /** Asks for a code to the booking's number. True when one went out. */
  async function sendPhoneCode(): Promise<boolean> {
    const res = await fetch("/api/auth/phone/send", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), purpose: "booking" }),
    });
    if (res.ok) {
      setCodeSent(true);
      setOtp("");
      return true;
    }
    const data = await res.json().catch(() => null);
    setSubmitError(data?.error ?? tr("معرفناش نبعت الكود، جرّب تاني", "Couldn't send the code. Try again."));
    return false;
  }

  /** Trades the typed code for a proof. Null, with the error shown, when it is refused. */
  async function exchangeCode(): Promise<string | null> {
    const res = await fetch("/api/public/phone-proof", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
    });
    const data = await res.json().catch(() => null);
    const proof = res.ok ? ((data?.data ?? data)?.proof as string | undefined) : undefined;
    if (proof) {
      setPhoneProof(proof);
      return proof;
    }
    const code = data?.code as string | undefined;
    setSubmitError(
      code === "wrong-code"
        ? tr("الكود مش صحيح", "That code isn't right")
        : code === "expired-code" || code === "too-many-attempts"
          ? tr("الكود انتهى. اطلب كود جديد", "That code has expired. Ask for a new one.")
          : data?.error ?? tr("معرفناش نتأكد من الكود، جرّب تاني", "Couldn't check the code. Try again."),
    );
    return null;
  }

  async function handleSubmit() {
    if (!validate() || !selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);

    // A code is on screen: check it first, and book with the proof.
    let proof = phoneProof;
    if (codeSent && !proof) {
      if (otp.trim().length < 4) {
        setSubmitError(tr("اكتب الكود اللي وصلك على واتساب", "Enter the code we sent to your WhatsApp"));
        setSubmitting(false);
        return;
      }
      proof = await exchangeCode().catch(() => {
        setSubmitError(tr("معرفناش نوصل للسيرفر، اتأكد من النت وجرّب تاني", "Couldn't reach the server. Check your connection and try again."));
        return null;
      });
      if (!proof) {
        setSubmitting(false);
        return;
      }
    }

    // Reuse the key across retries of this same attempt; only a fresh
    // run through the form mints a new one.
    const key = idempotencyKey ?? newIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(key);

    try {
      const res = await fetch(`/api/public/${slug}/bookings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId:     selectedService.id,
          date:          selectedDate,
          startTime:     selectedTime,
          customerName:  name.trim(),
          customerPhone: phone.trim(),
          customerEmail: email.trim() || undefined,
          notes:         notes.trim() || undefined,
          resourceId:    selectedResource?.id,
          staffMemberId: selectedStaff?.id,
          branchId:      selectedBranch?.id,
          partySize:     selectedResource?.capacity != null ? partySize : undefined,
          idempotencyKey: key,
          // Carried from the page, which read it off the link and the
          // Referer header. Lets a booking say which channel produced
          // it rather than it being inferred from when it happened.
          source,
          // Only the code. The price is re-derived server-side from the
          // same rules that produced the quote, so a tampered payload
          // gets the honest number rather than its own.
          discountCode: quote?.discount?.code ?? undefined,
          phoneProof: proof ?? undefined,
        }),
      });

      const data = await res.json();
      // This business asks guests to confirm their number: send the code
      // and let them type it here, then the same button books.
      if (res.status === 403 && data?.code === "phone-unverified") {
        setPhoneProof(null);
        await sendPhoneCode();
        return;
      }
      if (!res.ok) {
        setSubmitError(data.error ?? tr("حصلت مشكلة في الحجز، جرّب تاني", "Something went wrong with the booking. Try again."));
        return;
      }

      if (data.requiresPayment && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setConfirmation(data.booking);
      setStep("done");
    } catch {
      setSubmitError(tr("معرفناش نوصل للسيرفر، اتأكد من النت وجرّب تاني", "Couldn't reach the server. Check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("service");
    setSelectedService(null);
    setSelectedResource(null);
    setSelectedStaff(null);
    setSelectedBranch(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setIdempotencyKey(null);
    setSlotsReason(null);
    setName(""); setPhone(""); setEmail(""); setNotes("");
    setCodeSent(false); setPhoneProof(null); setOtp("");
    setErrors({});
    setSlots([]);
    setConfirmation(null);
    setSubmitError(null);
    setPartySize(2);
  }

  // ── Derived ─────────────────────────────────────────────
  /**
   * What the customer pays now, or null when nothing is due up front.
   *
   * The server decides this for real — it checks the plan as well as
   * the switch — so this is a preview, and it stays null unless the
   * business both takes deposits and has a price to take one from.
   */
  const depositDue =
    // The server's own rule (rounded up to the piastre), so the preview
    // and the charge agree — Math.round on pounds showed 38 for a 37.50
    // deposit.
    depositEnabled && depositPercent > 0 && depositPercent <= 100 && selectedService && selectedService.price > 0
      ? depositCents(selectedService.price, depositPercent) / 100
      : null;

  const partyLabel = en
    ? `${partySize} ${partySize === 1 ? "person" : "people"}`
    : arCount(partySize, { one: "شخص واحد", two: "شخصين", few: "أشخاص", many: "شخص" });

  // For barbershop: filter staff to those who offer the selected service
  const availableStaff = selectedService
    ? staffMembers.filter(
        (s) => s.serviceIds.length === 0 || s.serviceIds.includes(selectedService.id),
      )
    : staffMembers;

  // Asks what this booking costs, with or without a code. A quote that
  // could not be fetched comes back null, which leaves the full price
  // shown: the safe direction to be wrong in.
  async function requestQuote(serviceId: string, code?: string): Promise<Quote | null> {
    try {
      const res = await fetch(`/api/public/${slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, code: code?.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      return res.ok ? ((data?.data ?? data) as Quote) : null;
    } catch {
      return null;
    }
  }

  // Numbers each quote asked for; only the latest one's answer is shown,
  // so a code applied to one service never prices another.
  const quoteSeq = useRef(0);

  async function fetchQuote(code?: string) {
    if (!selectedService) return;
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const q = await requestQuote(selectedService.id, code);
    if (seq !== quoteSeq.current) return;
    setQuote(q);
    setQuoting(false);
  }

  // A different service starts with no code typed, and asks on its own
  // what it costs, so an automatic promotion is shown without the
  // customer having to do anything.
  const quoteKey = selectedService ? `${selectedService.id}|${slug}` : null;
  const [quotedFor, setQuotedFor] = useState<string | null>(null);
  if (quotedFor !== quoteKey) {
    setQuotedFor(quoteKey);
    setQuote(null);
    setCodeInput("");
    setQuoting(quoteKey !== null);
  }

  useEffect(() => {
    if (!selectedService) return;
    const seq = ++quoteSeq.current;
    void requestQuote(selectedService.id).then((q) => {
      if (seq !== quoteSeq.current) return;
      setQuote(q);
      setQuoting(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedService?.id, slug]);

  // Step index for stepper (1-based, "done" step doesn't appear in stepper)
  const stepperSteps = ALL_STEPS.map((s, i) => ({ id: s, label: stepLabel(s), n: i + 1 }));
  const currentStepN = ALL_STEPS.indexOf(step) + 1;

  // No id="booking" here. The anchor lives on the wrapper in
  // CompanyContent, which is the element carrying the scroll offset for
  // the sticky header. This had it too, so every profile shipped the id
  // twice and the five links that point at #booking landed on whichever
  // came first in the markup rather than on the one that was meant.
  return (
    <div
      // The hooks the booking tests drive it by (scripts/qa-booking-e2e.mjs).
      data-testid="booking-widget"
      data-step={step}
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-float)]"
      dir={en ? "ltr" : "rtl"}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-5 flex items-center justify-between"
        style={{ background: "var(--color-night)" }}
      >
        <div>
          <h2 className="text-white text-xl font-bold leading-tight">{tr("احجز ميعادك", "Book an appointment")}</h2>
          <p className="text-[var(--color-jade-line)] text-sm mt-0.5">{businessName}</p>
        </div>
        <div className="w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center bg-white/20 shrink-0">
          <CalendarDays size={22} className="text-white" />
        </div>
      </div>

      {/* ── Stepper ── */}
      {step !== "done" && (
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between relative">
            <div className="absolute top-4 start-4 end-4 h-0.5 bg-[var(--color-line)]" style={{ zIndex: 0 }} />
            {stepperSteps.map((s) => {
              const done   = currentStepN > s.n;
              const active = currentStepN === s.n;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      active ? "bg-[var(--color-jade)] text-white"
                             : done  ? "bg-[var(--color-jade)] text-white"
                             : "bg-[var(--color-line)] text-[var(--color-subtle)]"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : s.n}
                  </div>
                  <span className={`text-[11px] font-semibold ${active ? "text-[var(--color-jade)]" : "text-[var(--color-subtle)]"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="sr-only-label" aria-live="polite">
        {step === "done"
          ? tr("تم الحجز", "Booked")
          : `${tr("خطوة", "Step")} ${currentStepN} ${tr("من", "of")} ${ALL_STEPS.length}: ${stepLabel(step)}`}
      </p>

      <div ref={stepRef} tabIndex={-1} className="px-5 pb-5 pt-4 outline-none">

        {/* ═══ STEP: service ═══ */}
        {step === "service" && (
          <div>
            <SectionTitle>
              {businessType === "RESTAURANT" ? tr("اختار نوع الجلسة", "Choose a seating") : tr("اختار الخدمة", "Choose a service")}
            </SectionTitle>

            {services.length === 0 ? (
              <p className="text-sm text-[var(--color-subtle)] text-center py-6">{tr("مفيش خدمات متاحة دلوقتي", "No services available right now")}</p>
            ) : (
              <div className="space-y-3">
                {services.map((service) => {
                  const selected = selectedService?.id === service.id;
                  return (
                    <button
                      key={service.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedService(service)}
                      className={`w-full text-start rounded-[var(--radius-lg)] border-2 p-3.5 transition-all relative ${
                        selected
                          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)]"
                          : "border-[var(--color-line-2)] bg-white hover:border-[var(--color-jade)]/40"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-3 end-3 w-6 h-6 rounded-full bg-[var(--color-jade)] flex items-center justify-center">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                      <div className="flex items-center gap-3 pe-8">
                        <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] flex items-center justify-center shrink-0">
                          {service.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={service.image} alt={serviceName(service)} className="w-10 h-10 object-contain" />
                            : <span className="text-xl font-bold text-[var(--color-jade)]">{serviceName(service).charAt(0)}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[var(--color-ink)] leading-snug">{serviceName(service)}</p>
                          {service.duration > 0 && (
                            <p className="text-xs text-[var(--color-subtle)] mt-1 flex items-center gap-1">
                              <Clock size={11} />
                              {fmtDuration(service.duration, lang)}
                            </p>
                          )}
                        </div>
                        {/* A service left at the Decimal default has no
                            price. "0 ج.م" reads as free, which it is not. */}
                        {service.price > 0 ? (
                          <p className="num shrink-0 text-base font-extrabold text-[var(--color-jade)]">
                            {money(service.price, lang, service.currency)}
                          </p>
                        ) : (
                          <p className="shrink-0 text-[0.78125rem] text-[var(--color-subtle)]">
                            {t.services.priceUnset}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              disabled={!selectedService}
              onClick={goNext}
              className={`mt-5 w-full py-3.5 rounded-[var(--radius-lg)] text-white font-bold text-base flex items-center justify-center gap-2 transition-all ${
                selectedService ? "bg-[var(--color-jade)] hover:bg-[var(--color-jade-hover)]" : "bg-[var(--color-surface-3)] text-[var(--color-faint)] cursor-not-allowed"
              }`}
            >
              {tr("التالي", "Next")} <span className="text-lg leading-none" aria-hidden="true">{en ? "→" : "←"}</span>
            </button>
          </div>
        )}

        {/* ═══ STEP: provider ═══ */}
        {step === "provider" && (
          <div>
            <SectionTitle>{tr(`اختار ${providerLabel(lang)}`, `Choose a ${providerLabel(lang).toLowerCase()}`)}</SectionTitle>

            {availableStaff.length === 0 ? (
              <p className="text-sm text-[var(--color-subtle)] text-center py-6">
                {tr(`مفيش ${providerLabel(lang)} متاح للخدمة دي`, `No ${providerLabel(lang).toLowerCase()} available for this service`)}
              </p>
            ) : (
              <div className="space-y-3">
                {/* Nobody in particular. The engine picks whoever is free. */}
                <button
                  aria-pressed={selectedStaff === null}
                  onClick={() => setSelectedStaff(null)}
                  className={`w-full text-start rounded-[var(--radius-lg)] border-2 p-3.5 transition-all relative ${
                    selectedStaff === null
                      ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)]"
                      : "border-[var(--color-line-2)] bg-white hover:border-[var(--color-jade)]/40"
                  }`}
                >
                  {selectedStaff === null && (
                    <span className="absolute top-3 end-3 w-6 h-6 rounded-full bg-[var(--color-jade)] flex items-center justify-center">
                      <Check size={13} strokeWidth={3} className="text-white" />
                    </span>
                  )}
                  <div className="flex items-center gap-3 pe-8">
                    <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-surface-3)] flex items-center justify-center shrink-0">
                      <Scissors size={22} className="text-[var(--color-faint)]" />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[var(--color-ink)]">
                        {tr(`أي ${providerLabel(lang)} متاح`, `Any available ${providerLabel(lang).toLowerCase()}`)}
                      </p>
                      <p className="text-xs text-[var(--color-subtle)] mt-0.5">
                        {tr("أي حد فاضي في الوقت اللي هتختاره", "Whoever is free at the time you pick")}
                      </p>
                    </div>
                  </div>
                </button>

                {availableStaff.map((staff) => {
                  const selected = selectedStaff?.id === staff.id;
                  return (
                    <button
                      key={staff.id}
                      aria-pressed={selected}
                      onClick={() => setSelectedStaff(staff)}
                      className={`w-full text-start rounded-[var(--radius-lg)] border-2 p-3.5 transition-all relative ${
                        selected
                          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)]"
                          : "border-[var(--color-line-2)] bg-white hover:border-[var(--color-jade)]/40"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-3 end-3 w-6 h-6 rounded-full bg-[var(--color-jade)] flex items-center justify-center">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] flex items-center justify-center shrink-0 overflow-hidden">
                          {staff.photo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={staff.photo} alt={staffName(staff)} className="w-full h-full object-cover" />
                            : <span className="text-xl font-bold text-[var(--color-jade)]">{staffName(staff).charAt(0)}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[var(--color-ink)]">{staffName(staff)}</p>
                          {staff.role && (
                            <p className="text-xs text-[var(--color-subtle)] mt-0.5">{staff.role}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <StepButtons lang={lang} onBack={goBack} onNext={goNext} nextEnabled />
          </div>
        )}

        {/* ═══ STEP: resource ═══ */}
        {step === "resource" && (
          <div>
            <SectionTitle>{chooseResourceLabel(resourceKind, lang)}</SectionTitle>

            {/* Asked only when a resource counts seats. */}
            {resourcesCountSeats && (
              <div className="mb-4 flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-line-2)] px-4 py-3 bg-[var(--color-surface-2)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink-2)]">
                  <Users size={15} className="text-[var(--color-jade)]" />
                  {tr("عدد الأشخاص", "Party size")}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={tr("أقل", "Fewer")}
                    onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                    className="w-9 h-9 rounded-full bg-white border border-[var(--color-line-2)] text-[var(--color-muted)] font-bold flex items-center justify-center hover:border-[var(--color-jade)] transition-all text-lg leading-none"
                  >−</button>
                  <span className="num text-base font-extrabold text-[var(--color-ink)] w-5 text-center">
                    {partySize}
                  </span>
                  <button
                    type="button"
                    aria-label={tr("أكتر", "More")}
                    onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                    className="w-9 h-9 rounded-full bg-white border border-[var(--color-line-2)] text-[var(--color-muted)] font-bold flex items-center justify-center hover:border-[var(--color-jade)] transition-all text-lg leading-none"
                  >+</button>
                </div>
              </div>
            )}

            {resources.length === 0 ? (
              <p className="text-sm text-[var(--color-subtle)] text-center py-6">
                {tr(`مفيش ${resourceLabel(resourceKind, lang)} متاحة دلوقتي`, `No ${resourceLabel(resourceKind, lang).toLowerCase()} available right now`)}
              </p>
            ) : (
              <div className="space-y-3">
                {resources.map((resource) => {
                  const selected = selectedResource?.id === resource.id;
                  // Only a resource that counts seats can be too small.
                  const tooSmall =
                    resource.capacity != null && partySize > resource.capacity;
                  return (
                    <button
                      key={resource.id}
                      aria-pressed={selected}
                      onClick={() => !tooSmall && setSelectedResource(resource)}
                      disabled={tooSmall}
                      className={`w-full text-start rounded-[var(--radius-lg)] border-2 p-3.5 transition-all relative ${
                        tooSmall
                          ? "opacity-40 cursor-not-allowed border-[var(--color-line-2)]"
                          : selected
                          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)]"
                          : "border-[var(--color-line-2)] bg-white hover:border-[var(--color-jade)]/40"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-3 end-3 w-6 h-6 rounded-full bg-[var(--color-jade)] flex items-center justify-center">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                      {/* pe-8 keeps the content clear of the tick in the
                          corner; always, so selecting does not shift it. */}
                      <div className="flex items-center gap-3 pe-8">
                        <div className="w-14 h-14 rounded-[var(--radius-md)] bg-[var(--color-warn-soft)] flex items-center justify-center shrink-0 overflow-hidden">
                          {resource.photo
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={resource.photo} alt={resource.name} className="w-full h-full object-cover" />
                            : <span className="text-sm font-bold text-[var(--color-ink-2)]">
                                {resourceLabel(resource.kind, lang, true)}
                              </span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[var(--color-ink)]">{resource.name}</p>
                          {resource.area && (
                            <p className="text-xs text-[var(--color-subtle)] mt-0.5">{resource.area}</p>
                          )}
                        </div>
                        {resource.capacity != null && (
                          <div className="text-end shrink-0">
                            <p className="num text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-1">
                              <Users size={12} /> {resource.capacity}
                            </p>
                            {tooSmall && (
                              <p className="text-[10px] text-[var(--color-danger)] mt-0.5">{tr("صغيرة", "Too small")}</p>
                            )}
                          </div>
                        )}
                      </div>
                      {resource.notes && (
                        <p className="text-xs text-[var(--color-subtle)] mt-2 pe-2">{resource.notes}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/*
              A choice is required. Availability is computed for the
              resource that was picked, so letting somebody through
              without one would offer times when every room is already
              taken and fail at the last step instead of the first.
            */}
            <StepButtons lang={lang} onBack={goBack} onNext={goNext} nextEnabled={!!selectedResource} />
          </div>
        )}

        {/* ═══ STEP: datetime ═══ */}
        {/* ═══ STEP: branch ═══ */}
        {step === "branch" && (
          <div>
            <SectionTitle>{tr("اختار الفرع", "Choose a branch")}</SectionTitle>
            <div className="flex flex-col gap-2">
              {branches.map((b) => {
                const selected = selectedBranch?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b)}
                    aria-pressed={selected}
                    className={`w-full text-start rounded-[var(--radius-lg)] border-2 px-4 py-3 transition-all ${
                      selected
                        ? "border-[var(--color-jade)] bg-[var(--color-jade-soft)]"
                        : "border-[var(--color-line-2)] hover:border-[var(--color-jade)]/50"
                    }`}
                  >
                    <p className="text-sm font-bold text-[var(--color-ink)]">{b.nameAr}</p>
                    {b.address && (
                      <p className="mt-0.5 text-xs text-[var(--color-subtle)]">{b.address}</p>
                    )}
                  </button>
                );
              })}
            </div>

            <StepButtons
              lang={lang}
              onBack={goBack}
              onNext={goNext}
              nextEnabled={!!selectedBranch}
            />
          </div>
        )}

        {/* ═══ STEP: date ═══ */}
        {step === "date" && (
          <div>
            <SectionTitle>{tr("اختار اليوم", "Choose a day")}</SectionTitle>

            {/* Thirty days do not fit across the widget, and with the
                scrollbar hidden nothing said the row went on. An arrow
                and a fade on each edge that has more. */}
            <div className="relative">
            {dayEdges.earlier && <button
              type="button"
              onClick={() => scrollDays(-1)}
              aria-label={tr("الأيام اللي فاتت", "Earlier days")}
              className="absolute inset-y-0 start-0 z-10 hidden w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)]/90 text-[var(--color-ink-2)] shadow-sm sm:flex"
            >
              {en ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>}
            {dayEdges.later && <button
              type="button"
              onClick={() => scrollDays(1)}
              aria-label={tr("أيام بعد كده", "Later days")}
              className="absolute inset-y-0 end-0 z-10 hidden w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)]/90 text-[var(--color-ink-2)] shadow-sm sm:flex"
            >
              {en ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
            </button>}
            <div
              ref={scrollRef}
              onScroll={measureDays}
              className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 sm:px-9"
              style={{
                scrollbarWidth: "none",
                maskImage: stripMask(dayEdges, en),
                WebkitMaskImage: stripMask(dayEdges, en),
              }}
            >
              {days.map((d) => {
                const disabled = !openDays.includes(d.dow);
                const selected = selectedDate === d.iso;
                return (
                  <button
                    key={d.iso}
                    disabled={disabled}
                    // Picking the day is the whole step, so it moves on
                    // by itself; Next stays for coming back to the step.
                    onClick={() => { setSelectedDate(d.iso); goNext(); }}
                    aria-pressed={selected}
                    aria-label={formatDateAr(d.iso, lang)}
                    className={`flex flex-col items-center py-2.5 px-2 rounded-[var(--radius-md)] text-xs shrink-0 min-w-[3.25rem] transition-all ${
                      disabled
                        ? "opacity-30 cursor-not-allowed bg-[var(--color-surface-3)] text-[var(--color-faint)]"
                        : selected
                        ? "bg-[var(--color-jade)] text-[var(--color-inverse)]"
                        : "bg-[var(--color-surface-3)] hover:bg-[var(--color-line)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    <span className="text-[0.6875rem] opacity-80">{en ? d.dayEn : d.dayAr}</span>
                    <span className="font-bold text-sm mt-0.5">{d.dayNum}</span>
                    <span className="text-[0.6875rem] mt-0.5 opacity-80">{en ? d.monthEn : d.monthAr}</span>
                  </button>
                );
              })}
            </div>
            </div>

            {/* Always one line here, so the Next button stays put. A tap
                on a day moves on by itself; this and Next are for
                coming back to the step to check or keep the day. */}
            <p className="text-xs text-[var(--color-subtle)] mt-4 text-center">
              {selectedDate ? formatDateAr(selectedDate, lang) : tr("اختار يوم عشان تكمّل", "Pick a day to continue")}
            </p>

            <StepButtons lang={lang} onBack={goBack} onNext={goNext} nextEnabled={!!selectedDate} />
          </div>
        )}

        {/* ═══ STEP: time ═══ */}
        {step === "time" && (
          <div>
            <SectionTitle>
              {tr("اختار الوقت", "Choose a time")}{selectedDate ? ` — ${formatDateAr(selectedDate, lang)}` : ""}
            </SectionTitle>

            {slotsLoading && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 size={20} className="animate-spin text-[var(--color-jade)]" />
                <span className="text-sm text-[var(--color-subtle)]">{tr("جارٍ التحميل…", "Loading…")}</span>
              </div>
            )}

            {!slotsLoading && slotsError && (
              <p className="text-sm text-[var(--color-danger)] text-center py-4">{slotsError}</p>
            )}

            {!slotsLoading && !slotsError && slots.length === 0 && (
              <div className="text-center py-6">
                <CalendarDays size={28} className="mx-auto text-[var(--color-faint)] mb-2" />
                {/* The server says why the day is empty rather than
                    leaving a blank grid to be puzzled over. */}
                <p className="text-sm text-[var(--color-subtle)]">{emptyDayMessage(slotsReason, lang)}</p>
                <p className="text-xs text-[var(--color-subtle)] mt-1">{tr("اختار يوم تاني", "Pick another day")}</p>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && (
              /* Grouped by part of the day and on the twelve-hour clock:
                 twenty-four "16:00"s in one grid had to be read one by
                 one to find the evening. */
              <div className="space-y-4">
                {(["morning", "afternoon", "evening"] as const).map((part) => {
                  const inPart = slots.filter((slot) => dayPart(slot) === part);
                  if (inPart.length === 0) return null;
                  return (
                    <div key={part} role="group" aria-labelledby={`${fid}-${part}`}>
                      <p id={`${fid}-${part}`} className="mb-2 text-xs font-semibold text-[var(--color-subtle)]">
                        {part === "morning" ? tr("الصبح", "Morning") : part === "afternoon" ? tr("الضهر", "Afternoon") : tr("بالليل", "Evening")}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {inPart.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => setSelectedTime(slot)}
                            aria-pressed={selectedTime === slot}
                            className={`py-2.5 rounded-[var(--radius-md)] text-xs font-semibold border-2 transition-all ${
                              selectedTime === slot
                                ? "bg-[var(--color-jade)] text-[var(--color-inverse)] border-[var(--color-jade)]"
                                : "bg-[var(--color-surface)] border-[var(--color-line-2)] hover:border-[var(--color-jade)]/50 text-[var(--color-ink-2)]"
                            }`}
                          >
                            {clock12(slot, lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <StepButtons lang={lang} onBack={goBack} onNext={goNext} nextEnabled={!!selectedTime} />
          </div>
        )}

        {/* ═══ STEP: details ═══ */}
        {step === "details" && (
          <div>
            {/* Mini summary */}
            <div className="rounded-[var(--radius-lg)] px-4 py-3 mb-5 space-y-1.5" style={{ background: "rgba(14,127,94,0.06)", border: "1px solid rgba(14,127,94,0.14)" }}>
              <SummaryRow label={businessType === "RESTAURANT" ? tr("الجلسة", "Seating") : tr("الخدمة", "Service")} value={selectedService ? serviceName(selectedService) : ""} />
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={staffName(selectedStaff)} />
              )}
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              <SummaryRow label={tr("اليوم", "Day")}  value={selectedDate ? formatDateAr(selectedDate, lang) : ""} />
              <SummaryRow label={tr("الوقت", "Time")}  value={selectedTime ? clock12(selectedTime, lang) : ""} />
              {selectedResource?.capacity != null && (
                <SummaryRow label={tr("الأشخاص", "Party")} value={partyLabel} />
              )}
              {/* The list price; a discount code is entered and shown
                  on the review step. */}
              {selectedService && selectedService.price > 0 && (
                <SummaryRow label={tr("السعر", "Price")} value={money(selectedService.price, lang, selectedService.currency)} />
              )}
            </div>

            <SectionTitle>{tr("بياناتك", "Your details")}</SectionTitle>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`${fid}-name`}
                  className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5"
                >
                  {tr("الاسم بالكامل", "Full name")} <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id={`${fid}-name`}
                  type="text"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? `${fid}-name-err` : undefined}
                  placeholder={tr("اسمك", "Your name")}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.name ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.name && <p id={`${fid}-name-err`} className="field-error">{errors.name}</p>}
              </div>

              <div>
                <label
                  htmlFor={`${fid}-phone`}
                  className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5"
                >
                  {tr("رقم الموبايل", "Mobile number")} <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  id={`${fid}-phone`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-required="true"
                  aria-invalid={errors.phone ? true : undefined}
                  aria-describedby={errors.phone ? `${fid}-phone-err` : undefined}
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  dir="ltr"
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((p) => ({ ...p, phone: undefined }));
                    // A code or proof belongs to the number it was sent to.
                    setCodeSent(false); setPhoneProof(null); setOtp("");
                  }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.phone ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.phone && <p id={`${fid}-phone-err`} className="field-error">{errors.phone}</p>}
              </div>

              <div>
                <label
                  htmlFor={`${fid}-email`}
                  className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5"
                >
                  {tr("الإيميل", "Email")} <span className="text-[var(--color-subtle)] font-normal">{tr("(اختياري)", "(optional)")}</span>
                </label>
                <input
                  id={`${fid}-email`}
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? `${fid}-email-err` : undefined}
                  placeholder="example@email.com"
                  value={email}
                  dir="ltr"
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.email ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.email && <p id={`${fid}-email-err`} className="field-error">{errors.email}</p>}
              </div>

              <div>
                <label
                  htmlFor={`${fid}-notes`}
                  className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5"
                >
                  {tr("ملاحظات", "Notes")} <span className="text-[var(--color-subtle)] font-normal">{tr("(اختياري)", "(optional)")}</span>
                </label>
                <textarea
                  id={`${fid}-notes`}
                  placeholder={tr("أي معلومات إضافية…", "Anything the business should know…")}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border-2 border-[var(--color-line-2)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-jade)] transition-all resize-none"
                />
              </div>
            </div>

            {submitError && (
              <div className="mt-4 bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-[var(--radius-md)] px-4 py-3 leading-relaxed">
                {submitError}
              </div>
            )}

            <StepButtons
              lang={lang}
              onBack={goBack}
              onNext={() => { if (validate()) goNext(); }}
              nextEnabled
              nextLabel={tr("مراجعة الحجز", "Review booking")}
            />
          </div>
        )}

        {/* ═══ STEP: summary ═══ */}
        {step === "summary" && selectedService && (
          <div>
            <SectionTitle>{tr("راجع التفاصيل قبل التأكيد", "Check the details before you confirm")}</SectionTitle>

            <div
              className="rounded-[var(--radius-lg)] px-4 py-3.5 space-y-2"
              style={{ background: "var(--color-jade-tint)", border: "1px solid var(--color-jade-line)" }}
            >
              <SummaryRow label={tr("المكان", "Business")} value={businessName} />
              {selectedBranch && <SummaryRow label={tr("الفرع", "Branch")} value={selectedBranch.nameAr} />}
              <SummaryRow
                label={businessType === "RESTAURANT" ? tr("الجلسة", "Seating") : tr("الخدمة", "Service")}
                value={serviceName(selectedService)}
              />
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={staffName(selectedStaff)} />
              )}
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              {selectedResource?.capacity != null && (
                <SummaryRow label={tr("عدد الأشخاص", "Party size")} value={partyLabel} />
              )}
              <SummaryRow label={tr("التاريخ", "Date")} value={selectedDate ? formatDateAr(selectedDate, lang) : ""} />
              <SummaryRow label={tr("الوقت", "Time")} value={selectedTime ? clock12(selectedTime, lang) : ""} />
              <SummaryRow label={tr("المدة", "Duration")} value={fmtDuration(selectedService.duration, lang)} />

              <div className="pt-2.5 border-t border-[var(--color-jade-line)]">
                {/* The struck-through original only appears when
                    something actually came off it. A price crossed out
                    beside the same price is a sales trick. */}
                {quote?.discount ? (
                  <>
                    <SummaryRow
                      label={tr("السعر", "Price")}
                      value={money(quote.subtotalCents / 100, lang, selectedService.currency)}
                      strike
                    />
                    <SummaryRow
                      label={quote.discount.nameAr}
                      value={`− ${money(quote.discount.amountCents / 100, lang, selectedService.currency)}`}
                      good
                    />
                    <SummaryRow
                      label={tr("الإجمالي", "Total")}
                      value={money(quote.totalCents / 100, lang, selectedService.currency)}
                      bold
                    />
                  </>
                ) : (
                  <SummaryRow
                    label={tr("السعر", "Price")}
                    value={
                      selectedService.price > 0
                        ? money(selectedService.price, lang, selectedService.currency)
                        : t.services.priceUnset
                    }
                    bold
                  />
                )}

                {/* Shown only where the business actually takes one. */}
                {depositDue !== null && (
                  <SummaryRow
                    label={tr("العربون المطلوب دلوقتي (أونلاين)", "Deposit due now (online)")}
                    value={money(depositDue, lang, selectedService.currency)}
                  />
                )}

                {/* A code the customer was given. An automatic
                    promotion is already applied, so the field would
                    only invite them to look for a better one. */}
                {selectedService.price > 0 && !quote?.discount?.automatic && (
                  <div className="mt-3">
                    <label
                      htmlFor={`${fid}-code`}
                      className="mb-1.5 block text-xs font-semibold text-[var(--color-subtle)]"
                    >
                      {tr("عندك كود خصم؟", "Have a discount code?")}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={`${fid}-code`}
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                        placeholder={tr("اكتب الكود", "Enter code")}
                        dir="ltr"
                        autoComplete="off"
                        aria-invalid={quote?.codeError ? true : undefined}
                        className="min-w-0 flex-1 rounded-[var(--radius-md)] border-2 border-[var(--color-line-2)] px-3 py-2 text-sm outline-none transition-all focus:border-[var(--color-jade)]"
                      />
                      <button
                        type="button"
                        onClick={() => void fetchQuote(codeInput)}
                        disabled={quoting || !codeInput.trim()}
                        className="shrink-0 rounded-[var(--radius-md)] border-2 border-[var(--color-jade)] px-4 text-sm font-bold text-[var(--color-jade)] transition-colors disabled:opacity-50"
                      >
                        {quoting ? "…" : tr("طبّق", "Apply")}
                      </button>
                    </div>
                    {quote?.codeError && <p className="field-error mt-1.5">{quote.codeError}</p>}
                  </div>
                )}
              </div>

              <SummaryRow label={tr("الاسم", "Name")} value={name.trim()} />
              <SummaryRow label={tr("الموبايل", "Mobile")} value={phone.trim()} ltr />
            </div>

            {codeSent && !phoneProof && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-jade)]/30 bg-[var(--color-jade-tint)] px-4 py-3">
                <label htmlFor={`${fid}-otp`} className="block text-xs font-bold text-[var(--color-ink)]">
                  {tr("بعتنالك كود على واتساب", "We sent a code to your WhatsApp")}
                </label>
                <p className="m-0 mt-1 text-xs text-[var(--color-subtle)]">
                  {tr("اكتبه هنا عشان نأكد إن الرقم ده بتاعك.", "Type it here so we know this number is yours.")}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <input
                    id={`${fid}-otp`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    dir="ltr"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setSubmitError(null); }}
                    className="min-h-11 w-full min-w-0 rounded-[var(--radius-md)] border-2 border-[var(--color-line-2)] bg-[var(--color-surface)] px-3.5 text-center text-base font-bold tracking-[0.3em] outline-none focus:border-[var(--color-jade)]"
                  />
                  <button
                    type="button"
                    onClick={() => { setSubmitError(null); void sendPhoneCode(); }}
                    disabled={submitting}
                    className="min-h-11 shrink-0 px-2 text-xs font-bold text-[var(--color-jade)] disabled:opacity-50"
                  >
                    {tr("ابعت تاني", "Resend")}
                  </button>
                </div>
              </div>
            )}

            {/* The policy, stated before they commit rather than after. */}
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
              <p className="m-0 text-xs font-bold text-[var(--color-ink)]">{tr("الإلغاء والتعديل", "Cancelling and changing")}</p>
              <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--color-subtle)]">
                {changePolicyText(changeCutoffHours, lang, depositDue !== null)}
              </p>
            </div>

            {submitError && (
              <div className="mt-4 bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-[var(--radius-md)] px-4 py-3 leading-relaxed">
                {submitError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={goBack}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] text-[var(--color-muted)] font-bold text-sm flex items-center justify-center gap-1 transition-all disabled:opacity-50"
              >
                <ChevronRight size={15} aria-hidden="true" className={en ? "rotate-180" : undefined} /> {tr("رجوع", "Back")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-[var(--radius-lg)] bg-[var(--color-jade)] hover:bg-[var(--color-jade-hover)] text-[var(--color-inverse)] font-bold text-sm flex items-center justify-center gap-2 shadow-[var(--shadow-raised)] transition-all disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> {tr("جارٍ الحجز…", "Booking…")}</> : codeSent && !phoneProof ? tr("أكّد الكود واحجز", "Verify and book") : depositDue !== null ? tr("أكّد وادفع", "Confirm and pay") : tr("أكّد الحجز", "Confirm booking")}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: done ═══ */}
        {step === "done" && confirmation && (
          <div className="text-center">
            <div className="w-20 h-20 bg-[var(--color-ok-soft)] rounded-full flex items-center justify-center mx-auto mt-2 mb-4">
              <CheckCircle size={40} className="text-[var(--color-ok)]" />
            </div>
            <h3 className="font-extrabold text-xl text-[var(--color-ink)] mb-1">
              {confirmation.status === "PENDING"
                ? tr("وصل طلب حجزك!", "Booking request sent!")
                : tr("حجزك اتأكد!", "You're booked!")}
            </h3>
            <p className="text-sm text-[var(--color-subtle)] mb-6 leading-relaxed">
              {/* PENDING: the business confirms it from its dashboard, and
                  the confirmed (or declined) notification follows. */}
              {confirmation.status === "PENDING"
                ? tr(`${confirmation.businessName} هيراجع الحجز ويأكده، وهيوصلك إشعار.`, `${confirmation.businessName} will review and confirm it, and you'll be notified.`)
                : tr("هيوصلك تذكير قبل الميعاد.", "You'll get a reminder before the appointment.")}
              <br />
              {/*
                This line used to claim an email had been sent, always.
                The field above it is optional, so somebody who left it
                blank was told to go and look in an inbox for a
                management link that was never addressed to them — and
                that link is how they cancel.

                Said only when there is an address to say it about. With
                no address, the reference below is the thing that
                matters, so that is what it points at.
              */}
              {email.trim()
                ? tr("بعتنا تفاصيل الحجز ورابط إدارته على إيميلك.", "We've emailed you the booking details and a link to manage it.")
                : tr("احتفظ برقم الحجز ده، هتحتاجه لو حبيت تعدّل أو تلغي الميعاد.", "Keep this booking number — you'll need it to change or cancel.")}
            </p>

            <div className="text-start rounded-[var(--radius-lg)] p-4 space-y-3 mb-5" style={{ background: "rgba(14,127,94,0.06)", border: "1px solid rgba(14,127,94,0.14)" }}>
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(14,127,94,0.14)]">
                <p className="text-xs font-medium text-[var(--color-subtle)]">{tr("رقم الحجز", "Booking number")}</p>
                {/* The reference, which is what support asks for. */}
                <p className="num text-sm font-extrabold tracking-wide text-[var(--color-ink)]" dir="ltr">
                  {confirmation.reference ?? confirmation.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <SummaryRow label={tr("العميل", "Customer")}  value={confirmation.customerName} />
              <SummaryRow label={tr("الخدمة", "Service")}  value={confirmation.serviceName} />
              <SummaryRow label={tr("التاريخ", "Date")} value={formatDateAr(confirmation.date, lang)} />
              <SummaryRow label={tr("الوقت", "Time")}   value={`${clock12(confirmation.startTime, lang)} – ${clock12(confirmation.endTime, lang)}`} />
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={staffName(selectedStaff)} />
              )}
              <div className="pt-3 border-t border-[rgba(14,127,94,0.14)]">
                <SummaryRow
                  label={tr("الإجمالي", "Total")}
                  value={money(confirmation.totalPrice, lang, confirmation.currency)}
                  bold
                />
              </div>
            </div>

            {confirmation.accessToken && (
              <>
                <a
                  href={`/api/public/booking/${confirmation.accessToken}/calendar`}
                  download
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-[var(--color-jade)] py-3 text-sm font-bold text-[var(--color-jade)] transition-colors hover:bg-[var(--color-jade-soft)]"
                >
                  <CalendarDays size={15} aria-hidden="true" />
                  {tr("ضيف الميعاد للتقويم", "Add to calendar")}
                </a>
                <a
                  href={`/booking/${confirmation.accessToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 block w-full rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] py-3 text-center text-sm font-bold text-[var(--color-muted)] transition-colors hover:border-[var(--color-jade)]"
                >
                  {tr("عرض تفاصيل الحجز", "View booking")}
                </a>
              </>
            )}

            <button
              onClick={reset}
              className="w-full py-3 rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] text-[var(--color-subtle)] font-bold text-sm hover:border-[var(--color-line-2)] transition-all"
            >
              {tr("احجز ميعاد تاني", "Book another")}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/** Fades whichever ends of the day strip have more days beyond them. */
function stripMask(edges: { earlier: boolean; later: boolean }, en: boolean): string {
  // Earlier days lie to the left in English and to the right in Arabic.
  const left = en ? edges.earlier : edges.later;
  const right = en ? edges.later : edges.earlier;
  return `linear-gradient(to right, ${left ? "transparent 0, black 2.5rem" : "black 0"}, ${right ? "black calc(100% - 2.5rem), transparent 100%" : "black 100%"})`;
}
