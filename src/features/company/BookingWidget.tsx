"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronRight, CheckCircle,
  Loader2, CalendarDays, Clock, Check, Users, Scissors,
} from "lucide-react";
import type { Service } from "@/types/service";
import type { PublicResource, PublicStaff } from "./CompanyContent";
import { money, duration as fmtDuration } from "@/lib/fmt";
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
  businessType:        "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  /** Tables, rooms, chairs, machines — whatever an appointment holds. */
  resources:           PublicResource[];
  staffMembers:        PublicStaff[];
  /** Locations. Most businesses have none, and the step is skipped. */
  branches?:           PublicBranch[];
  /** Only for the summary's preview; the server decides what is owed. */
  depositEnabled?:     boolean;
  depositPercent?:     number;
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
};

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
function emptyDayMessage(reason: string | null): string {
  switch (reason) {
    case "business-closed": return "المكان مقفول في اليوم ده";
    case "staff-off":       return "مقدّم الخدمة ده مش متاح في اليوم ده";
    case "holiday":         return "أجازة رسمية";
    case "vacation":        return "مقدّم الخدمة في أجازة";
    case "same-day-cutoff": return "قفل الحجز لليوم";
    case "too-far-ahead":   return "الحجز مش مفتوح للتاريخ ده لسه";
    case "past":            return "اليوم ده عدّى";
    default:                return "لا توجد مواعيد متاحة";
  }
}

/** Back and next, which four of the steps render identically. */
function StepButtons({
  onBack,
  onNext,
  nextEnabled,
  nextLabel = "التالي",
}: {
  onBack: () => void;
  onNext: () => void;
  nextEnabled: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex gap-2 mt-5">
      <button
        onClick={onBack}
        className="flex-1 py-3.5 rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] text-[var(--color-muted)] font-bold text-sm flex items-center justify-center gap-1 transition-all"
      >
        <ChevronRight size={15} aria-hidden="true" /> رجوع
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
        {nextLabel} <span className="text-base leading-none" aria-hidden="true">←</span>
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
      dayAr:   AR_DAYS[day.getUTCDay()],
      dayNum:  day.getUTCDate(),
      monthAr: AR_MONTHS[day.getUTCMonth()],
      dow:     day.getUTCDay(),
    };
  });
}

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  // UTC, to match how the strip above builds its days.
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${AR_DAYS[date.getUTCDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

// ─── Sub-components ───────────────────────────────────────

function SummaryRow({
  label, value, ltr = false, bold = false,
}: { label: string; value: string; ltr?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-[var(--color-subtle)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-end ${bold ? "font-extrabold text-[var(--color-jade)]" : "font-semibold text-[var(--color-ink)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4" dir="rtl">
      <div className="w-1 h-5 bg-[var(--color-jade)] rounded-full" />
      <h3 className="text-base font-bold text-[var(--color-jade)]">{children}</h3>
    </div>
  );
}

function ServiceIcon({ service }: { service: Service }) {
  if (service.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={service.image} alt={service.nameAr} className="w-10 h-10 object-contain" />;
  }
  return <span className="text-xl font-bold text-[var(--color-jade)]">{service.nameAr.charAt(0)}</span>;
}

// ─── Main Component ───────────────────────────────────────

export default function BookingWidget({
  services,
  businessName,
  slug,
  openDays,
  preselectedService,
  businessType,
  resources,
  staffMembers,
  branches = [],
  depositEnabled = false,
  depositPercent = 0,
}: BookingWidgetProps) {
  const { t, lang } = useLanguage();
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
    if (s === "service")  return "الخدمة";
    if (s === "provider") return providerLabel(lang);
    if (s === "resource") return resourceLabel(resourceKind, lang, true);
    if (s === "branch")   return "الفرع";
    if (s === "date")     return "اليوم";
    if (s === "time")     return "الوقت";
    if (s === "summary")  return "المراجعة";
    return "بياناتك";
  };

  const [step, setStep] = useState<Step>("service");

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const days = getUpcomingDays(30);

  useEffect(() => {
    if (!preselectedService) return;
    setSelectedService(preselectedService);
    setSelectedResource(null);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setStep(
      hasStaff ? "provider" : hasResources ? "resource" : hasBranches ? "branch" : "date",
    );
  }, [preselectedService, hasStaff, hasResources, hasBranches]);

  // Fetch available slots when date / service / resource changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlots([]);
    setSelectedTime(null);
    setSlotsError(null);
    setSlotsLoading(true);

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
        setSlots(data.slots ?? []);
        setSlotsReason(data.reason ?? null);
        setSlotsLoading(false);
      })
      .catch(() => { setSlotsError("تعذّر تحميل المواعيد، حاول مرة أخرى"); setSlotsLoading(false); });
  }, [selectedDate, selectedService, selectedStaff, selectedResource, selectedBranch, slug]);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (name.trim().length < 2)
      errs.name = "أدخل اسمك الكامل";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8)
      errs.phone = "أدخل رقم الهاتف";
    else if (digits.length > 15)
      errs.phone = "رقم الهاتف غير صحيح";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = "البريد الإلكتروني غير صحيح";
    setErrors(errs);
    return !errs.name && !errs.phone && !errs.email;
  }

  async function handleSubmit() {
    if (!validate() || !selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);

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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "حدث خطأ أثناء الحجز");
        return;
      }

      if (data.requiresPayment && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setConfirmation(data.booking);
      setStep("done");
    } catch {
      setSubmitError("تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى");
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
    depositEnabled && depositPercent > 0 && selectedService && selectedService.price > 0
      ? Math.round((selectedService.price * depositPercent) / 100)
      : null;

  // For barbershop: filter staff to those who offer the selected service
  const availableStaff = selectedService
    ? staffMembers.filter(
        (s) => s.serviceIds.length === 0 || s.serviceIds.includes(selectedService.id),
      )
    : staffMembers;

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
      className="overflow-hidden rounded-[var(--radius-xl)] bg-white"
      dir="rtl"
      style={{
        boxShadow:  "0 4px 32px rgba(17,32,28,0.10), 0 1px 8px rgba(17,32,28,0.06)",
        border:     "1px solid var(--color-line)",
        fontFamily: "var(--font-cairo, Cairo, sans-serif)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-5 flex items-center justify-between"
        style={{ background: "var(--color-night)" }}
      >
        <div>
          <h2 className="text-white text-xl font-bold leading-tight">احجز موعدك</h2>
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
                             : "bg-[var(--color-line)] text-[var(--color-faint)]"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : s.n}
                  </div>
                  <span className={`text-[11px] font-semibold ${active ? "text-[var(--color-jade)]" : "text-[var(--color-faint)]"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-4">

        {/* ═══ STEP: service ═══ */}
        {step === "service" && (
          <div>
            <SectionTitle>
              {businessType === "RESTAURANT" ? "اختر نوع الجلسة" : "اختر الخدمة"}
            </SectionTitle>

            {services.length === 0 ? (
              <p className="text-sm text-[var(--color-faint)] text-center py-6">لا توجد خدمات متاحة حاليًا</p>
            ) : (
              <div className="space-y-3">
                {services.map((service) => {
                  const selected = selectedService?.id === service.id;
                  return (
                    <button
                      key={service.id}
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
                            ? <img src={service.image} alt={service.nameAr} className="w-10 h-10 object-contain" />
                            : <span className="text-xl font-bold text-[var(--color-jade)]">{service.nameAr.charAt(0)}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[var(--color-ink)] leading-snug">{service.nameAr}</p>
                          {service.duration > 0 && (
                            <p className="text-xs text-[var(--color-faint)] mt-1 flex items-center gap-1">
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
              التالي <span className="text-lg leading-none">←</span>
            </button>
          </div>
        )}

        {/* ═══ STEP: provider ═══ */}
        {step === "provider" && (
          <div>
            <SectionTitle>اختر {providerLabel(lang)}</SectionTitle>

            {availableStaff.length === 0 ? (
              <p className="text-sm text-[var(--color-faint)] text-center py-6">
                لا يوجد {providerLabel(lang)} متاح للخدمة دي
              </p>
            ) : (
              <div className="space-y-3">
                {/* Nobody in particular. The engine picks whoever is free. */}
                <button
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
                        أي {providerLabel(lang)} متاح
                      </p>
                      <p className="text-xs text-[var(--color-faint)] mt-0.5">
                        سيتم تخصيص أقرب موعد
                      </p>
                    </div>
                  </div>
                </button>

                {availableStaff.map((staff) => {
                  const selected = selectedStaff?.id === staff.id;
                  return (
                    <button
                      key={staff.id}
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
                            ? <img src={staff.photo} alt={staff.nameAr} className="w-full h-full object-cover" />
                            : <span className="text-xl font-bold text-[var(--color-jade)]">{staff.nameAr.charAt(0)}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[var(--color-ink)]">{staff.nameAr}</p>
                          {staff.role && (
                            <p className="text-xs text-[var(--color-faint)] mt-0.5">{staff.role}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <StepButtons onBack={goBack} onNext={goNext} nextEnabled />
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
                  عدد الأشخاص
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="أقل"
                    onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                    className="w-9 h-9 rounded-full bg-white border border-[var(--color-line-2)] text-[var(--color-muted)] font-bold flex items-center justify-center hover:border-[var(--color-jade)] transition-all text-lg leading-none"
                  >−</button>
                  <span className="num text-base font-extrabold text-[var(--color-ink)] w-5 text-center">
                    {partySize}
                  </span>
                  <button
                    type="button"
                    aria-label="أكثر"
                    onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                    className="w-9 h-9 rounded-full bg-white border border-[var(--color-line-2)] text-[var(--color-muted)] font-bold flex items-center justify-center hover:border-[var(--color-jade)] transition-all text-lg leading-none"
                  >+</button>
                </div>
              </div>
            )}

            {resources.length === 0 ? (
              <p className="text-sm text-[var(--color-faint)] text-center py-6">
                لا توجد {resourceLabel(resourceKind, lang)} متاحة حاليًا
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
                            <p className="text-xs text-[var(--color-faint)] mt-0.5">{resource.area}</p>
                          )}
                        </div>
                        {resource.capacity != null && (
                          <div className="text-end shrink-0">
                            <p className="num text-sm font-extrabold text-[var(--color-ink)] flex items-center gap-1">
                              <Users size={12} /> {resource.capacity}
                            </p>
                            {tooSmall && (
                              <p className="text-[10px] text-[var(--color-danger)] mt-0.5">صغيرة</p>
                            )}
                          </div>
                        )}
                      </div>
                      {resource.notes && (
                        <p className="text-xs text-[var(--color-faint)] mt-2 pe-2">{resource.notes}</p>
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
            <StepButtons onBack={goBack} onNext={goNext} nextEnabled={!!selectedResource} />
          </div>
        )}

        {/* ═══ STEP: datetime ═══ */}
        {/* ═══ STEP: branch ═══ */}
        {step === "branch" && (
          <div>
            <SectionTitle>اختر الفرع</SectionTitle>
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
              onBack={goBack}
              onNext={goNext}
              nextEnabled={!!selectedBranch}
            />
          </div>
        )}

        {/* ═══ STEP: date ═══ */}
        {step === "date" && (
          <div>
            <SectionTitle>اختر اليوم</SectionTitle>

            <div
              ref={scrollRef}
              className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
              style={{ scrollbarWidth: "none" }}
            >
              {days.map((d) => {
                const disabled = !openDays.includes(d.dow);
                const selected = selectedDate === d.iso;
                return (
                  <button
                    key={d.iso}
                    disabled={disabled}
                    onClick={() => setSelectedDate(d.iso)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center py-2.5 px-2.5 rounded-[var(--radius-md)] text-xs shrink-0 min-w-[46px] transition-all ${
                      disabled
                        ? "opacity-30 cursor-not-allowed bg-[var(--color-surface-3)] text-[var(--color-faint)]"
                        : selected
                        ? "bg-[var(--color-jade)] text-[var(--color-inverse)]"
                        : "bg-[var(--color-surface-3)] hover:bg-[var(--color-line)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    <span className="text-[9px] opacity-70">{d.dayAr.slice(0, 3)}</span>
                    <span className="font-bold text-sm mt-0.5">{d.dayNum}</span>
                    <span className="text-[9px] mt-0.5 opacity-60">{d.monthAr.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>

            {!selectedDate && (
              <p className="text-xs text-[var(--color-faint)] mt-4 text-center">
                اختر يومًا للمتابعة
              </p>
            )}

            <StepButtons onBack={goBack} onNext={goNext} nextEnabled={!!selectedDate} />
          </div>
        )}

        {/* ═══ STEP: time ═══ */}
        {step === "time" && (
          <div>
            <SectionTitle>
              اختر الوقت{selectedDate ? ` — ${formatDateAr(selectedDate)}` : ""}
            </SectionTitle>

            {slotsLoading && (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 size={20} className="animate-spin text-[var(--color-jade)]" />
                <span className="text-sm text-[var(--color-faint)]">جارٍ التحميل…</span>
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
                <p className="text-sm text-[var(--color-faint)]">{emptyDayMessage(slotsReason)}</p>
                <p className="text-xs text-[var(--color-faint)] mt-1">اختر يومًا آخر</p>
              </div>
            )}

            {!slotsLoading && !slotsError && slots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot}
                    dir="ltr"
                    onClick={() => setSelectedTime(slot)}
                    aria-pressed={selectedTime === slot}
                    className={`py-2.5 rounded-[var(--radius-md)] text-xs font-semibold border-2 transition-all ${
                      selectedTime === slot
                        ? "bg-[var(--color-jade)] text-[var(--color-inverse)] border-[var(--color-jade)]"
                        : "bg-[var(--color-surface)] border-[var(--color-line-2)] hover:border-[var(--color-jade)]/50 text-[var(--color-ink-2)]"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <StepButtons onBack={goBack} onNext={goNext} nextEnabled={!!selectedTime} />
          </div>
        )}

        {/* ═══ STEP: details ═══ */}
        {step === "details" && (
          <div>
            {/* Mini summary */}
            <div className="rounded-[var(--radius-lg)] px-4 py-3 mb-5 space-y-1.5" style={{ background: "rgba(14,127,94,0.06)", border: "1px solid rgba(14,127,94,0.14)" }}>
              <SummaryRow label={businessType === "RESTAURANT" ? "الجلسة" : "الخدمة"} value={selectedService?.nameAr ?? ""} />
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={selectedStaff.nameAr} />
              )}
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              <SummaryRow label="اليوم"  value={selectedDate ? formatDateAr(selectedDate) : ""} />
              <SummaryRow label="الوقت"  value={selectedTime ?? ""} ltr />
              {selectedResource?.capacity != null && (
                <SummaryRow label="الأشخاص" value={`${partySize} أشخاص`} />
              )}
            </div>

            <SectionTitle>بياناتك</SectionTitle>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5">
                  الاسم الكامل <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="محمد أحمد"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.name ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.name && <p className="field-error">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5">
                  رقم الهاتف <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  dir="ltr"
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.phone ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.phone && <p className="field-error">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5">
                  البريد الإلكتروني <span className="text-[var(--color-faint)] font-normal">(اختياري)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  dir="ltr"
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  className={`w-full rounded-[var(--radius-md)] border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.email ? "border-[var(--color-danger)]" : "border-[var(--color-line-2)] focus:border-[var(--color-jade)]"}`}
                />
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-subtle)] mb-1.5">
                  ملاحظات <span className="text-[var(--color-faint)] font-normal">(اختياري)</span>
                </label>
                <textarea
                  placeholder="أي معلومات إضافية…"
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
              onBack={goBack}
              onNext={() => { if (validate()) goNext(); }}
              nextEnabled
              nextLabel="مراجعة الحجز"
            />
          </div>
        )}

        {/* ═══ STEP: summary ═══ */}
        {step === "summary" && selectedService && (
          <div>
            <SectionTitle>راجع التفاصيل قبل التأكيد</SectionTitle>

            <div
              className="rounded-[var(--radius-lg)] px-4 py-3.5 space-y-2"
              style={{ background: "var(--color-jade-tint)", border: "1px solid var(--color-jade-line)" }}
            >
              <SummaryRow label="المكان" value={businessName} />
              {selectedBranch && <SummaryRow label="الفرع" value={selectedBranch.nameAr} />}
              <SummaryRow
                label={businessType === "RESTAURANT" ? "الجلسة" : "الخدمة"}
                value={selectedService.nameAr}
              />
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={selectedStaff.nameAr} />
              )}
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              {selectedResource?.capacity != null && (
                <SummaryRow label="عدد الأشخاص" value={`${partySize}`} />
              )}
              <SummaryRow label="التاريخ" value={selectedDate ? formatDateAr(selectedDate) : ""} />
              <SummaryRow label="الوقت" value={selectedTime ?? ""} ltr />
              <SummaryRow label="المدة" value={`${selectedService.duration} دقيقة`} />

              <div className="pt-2.5 border-t border-[var(--color-jade-line)]">
                <SummaryRow
                  label="السعر"
                  value={
                    selectedService.price > 0
                      ? money(selectedService.price, lang, selectedService.currency)
                      : "السعر غير محدد"
                  }
                  bold
                />
                {/* Shown only where the business actually takes one. */}
                {depositDue !== null && (
                  <SummaryRow
                    label="المقدّم المطلوب الآن"
                    value={money(depositDue, lang, selectedService.currency)}
                  />
                )}
              </div>

              <SummaryRow label="الاسم" value={name.trim()} />
              <SummaryRow label="الهاتف" value={phone.trim()} ltr />
            </div>

            {/* The policy, stated before they commit rather than after. */}
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
              <p className="m-0 text-xs font-bold text-[var(--color-ink)]">سياسة الإلغاء</p>
              <p className="m-0 mt-1.5 text-xs leading-relaxed text-[var(--color-subtle)]">
                يمكنك تعديل أو إلغاء الحجز مجانًا حتى ساعتين قبل الموعد.
                {depositDue !== null ? " المقدّم غير قابل للاسترداد بعد تأكيد الحجز." : ""}
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
                <ChevronRight size={15} /> رجوع
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-[var(--radius-lg)] bg-[var(--color-jade)] hover:bg-[var(--color-jade-hover)] text-[var(--color-inverse)] font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> جارٍ الحجز…</> : depositDue !== null ? "تأكيد والدفع" : "تأكيد الحجز"}
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
            <h3 className="font-extrabold text-xl text-[var(--color-ink)] mb-1">تم حجز موعدك!</h3>
            <p className="text-sm text-[var(--color-faint)] mb-6 leading-relaxed">
              يسعدنا استقبالك. سيتواصل معك الفريق قريبًا.
              <br />
              تم إرسال تفاصيل الحجز ورابط الإدارة إلى بريدك الإلكتروني.
            </p>

            <div className="text-start rounded-[var(--radius-lg)] p-4 space-y-3 mb-5" style={{ background: "rgba(14,127,94,0.06)", border: "1px solid rgba(14,127,94,0.14)" }}>
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(14,127,94,0.14)]">
                <p className="text-xs font-medium text-[var(--color-faint)]">رقم الحجز</p>
                {/* The reference, which is what support asks for. */}
                <p className="num text-sm font-extrabold tracking-wide text-[var(--color-ink)]" dir="ltr">
                  {confirmation.reference ?? confirmation.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <SummaryRow label="العميل"  value={confirmation.customerName} />
              <SummaryRow label="الخدمة"  value={confirmation.serviceName} />
              <SummaryRow label="التاريخ" value={formatDateAr(confirmation.date)} />
              <SummaryRow label="الوقت"   value={`${confirmation.startTime} – ${confirmation.endTime}`} ltr />
              {selectedResource && (
                <SummaryRow
                  label={resourceLabel(selectedResource.kind, lang, true)}
                  value={selectedResource.name}
                />
              )}
              {selectedStaff && (
                <SummaryRow label={providerLabel(lang)} value={selectedStaff.nameAr} />
              )}
              <div className="pt-3 border-t border-[rgba(14,127,94,0.14)]">
                <SummaryRow
                  label="الإجمالي"
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
                  أضف الموعد للتقويم
                </a>
                <a
                  href={`/booking/${confirmation.accessToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3 block w-full rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] py-3 text-center text-sm font-bold text-[var(--color-muted)] transition-colors hover:border-[var(--color-jade)]"
                >
                  عرض تفاصيل الحجز
                </a>
              </>
            )}

            <button
              onClick={reset}
              className="w-full py-3 rounded-[var(--radius-lg)] border-2 border-[var(--color-line-2)] text-[var(--color-subtle)] font-bold text-sm hover:border-[var(--color-line-2)] transition-all"
            >
              حجز موعد آخر
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
