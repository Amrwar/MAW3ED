"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronRight, ChevronLeft, CheckCircle,
  Loader2, CalendarDays, Clock,
} from "lucide-react";
import Button from "@/components/ui/Button";
import type { Service } from "@/types/service";
import { formatPrice, formatDuration } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────

interface BookingWidgetProps {
  services:            Service[];
  businessName:        string;
  slug:                string;
  /** day-of-week numbers (0=Sun to 6=Sat) that the business is OPEN */
  openDays:            number[];
  /** When set, the widget pre-selects this service and jumps to step 2 */
  preselectedService?: Service | null;
}

type BookingConfirmation = {
  id:           string;
  businessName: string;
  serviceName:  string;
  date:         string;
  startTime:    string;
  endTime:      string;
  customerName: string;
  totalPrice:   number;
  currency:     string;
};

// ─── Constants ────────────────────────────────────────────

const AR_DAYS = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// ─── Helpers ──────────────────────────────────────────────

function toLocalISO(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function getUpcomingDays(count: number) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      iso:     toLocalISO(d),
      dayAr:   AR_DAYS[d.getDay()],
      dayNum:  d.getDate(),
      monthAr: AR_MONTHS[d.getMonth()],
      dow:     d.getDay(),
    };
  });
}

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

// ─── SummaryRow ───────────────────────────────────────────

function SummaryRow({
  label,
  value,
  ltr  = false,
  bold = false,
}: {
  label: string;
  value: string;
  ltr?:  boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-end ${
          bold
            ? "font-black text-[var(--color-accent)]"
            : "font-semibold text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────

export default function BookingWidget({
  services,
  businessName,
  slug,
  openDays,
  preselectedService,
}: BookingWidgetProps) {
  const [step,            setStep]           = useState<1 | 2 | 3 | 4>(1);
  const [selectedService, setSelectedService]= useState<Service | null>(null);

  useEffect(() => {
    if (!preselectedService) return;
    setSelectedService(preselectedService);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setStep(2);
  }, [preselectedService]);

  const [selectedDate,    setSelectedDate]   = useState<string | null>(null);
  const [selectedTime,    setSelectedTime]   = useState<string | null>(null);

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

  // Fetch available slots when date or service changes
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setSlots([]);
    setSelectedTime(null);
    setSlotsError(null);
    setSlotsLoading(true);

    fetch(`/api/public/${slug}/slots?serviceId=${selectedService.id}&date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots ?? []);
        setSlotsLoading(false);
      })
      .catch(() => {
        setSlotsError("تعذّر تحميل المواعيد، حاول مرة أخرى");
        setSlotsLoading(false);
      });
  }, [selectedDate, selectedService, slug]);

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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "حدث خطأ أثناء الحجز");
        return;
      }

      setConfirmation(data.booking);
      setStep(4);
    } catch {
      setSubmitError("تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(1);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setErrors({});
    setSlots([]);
    setConfirmation(null);
    setSubmitError(null);
  }

  const STEPS = [
    { n: 1, label: "الخدمة"  },
    { n: 2, label: "الموعد"  },
    { n: 3, label: "بياناتك" },
    { n: 4, label: "تأكيد"   },
  ];

  return (
    <div id="booking" className="card p-0 overflow-hidden lg:sticky lg:top-24">
      {/* Header */}
      <div className="bg-[var(--color-brand)] px-5 py-4">
        <h3 className="text-white font-bold text-base">احجز موعدك</h3>
        <p className="text-white/60 text-xs mt-0.5">{businessName}</p>
      </div>

      {/* Step progress bar */}
      {step < 4 && (
        <div className="flex items-center px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1 last:flex-none">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  step >= s.n
                    ? "bg-[var(--color-brand)] text-white"
                    : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {step > s.n ? <CheckCircle size={12} /> : s.n}
              </div>
              <span
                className={`text-[10px] font-medium ms-1 ${
                  step >= s.n
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    step > s.n ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-5">

        {/* ═══ STEP 1: Service ═══ */}
        {step === 1 && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              اختر الخدمة
            </p>
            {services.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                لا توجد خدمات متاحة حاليًا
              </p>
            ) : (
              services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full text-start p-3.5 rounded-xl border-2 transition-all ${
                    selectedService?.id === service.id
                      ? "border-[var(--color-brand)] bg-[var(--color-surface-2)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-brand)]/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
                        {service.nameAr}
                      </p>
                      {service.descriptionAr && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                          {service.descriptionAr}
                        </p>
                      )}
                      {service.duration > 0 && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(service.duration)}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-black text-[var(--color-accent)] shrink-0">
                      {formatPrice(service.price, service.currency)}
                    </p>
                  </div>
                </button>
              ))
            )}
            <Button
              variant="primary"
              fullWidth
              className="mt-4"
              disabled={!selectedService}
              onClick={() => setStep(2)}
            >
              التالي
              <ChevronLeft size={15} />
            </Button>
          </div>
        )}

        {/* ═══ STEP 2: Date + Time ═══ */}
        {step === 2 && (
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
              اختر اليوم
            </p>

            {/* Scrollable date carousel */}
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
                    className={`flex flex-col items-center py-2.5 px-2.5 rounded-xl text-xs shrink-0 min-w-[44px] transition-all ${
                      disabled
                        ? "opacity-30 cursor-not-allowed bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        : selected
                        ? "bg-[var(--color-brand)] text-white shadow-md"
                        : "bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span className="text-[9px] opacity-70">{d.dayAr.slice(0, 3)}</span>
                    <span className="font-bold text-sm mt-0.5">{d.dayNum}</span>
                    <span className="text-[9px] mt-0.5 opacity-60">{d.monthAr.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>

            {/* Time slots */}
            {selectedDate ? (
              <div className="mt-5">
                <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                  اختر الوقت
                </p>

                {slotsLoading && (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={20} className="animate-spin text-[var(--color-brand)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">جارٍ التحميل…</span>
                  </div>
                )}

                {!slotsLoading && slotsError && (
                  <p className="text-sm text-red-500 text-center py-4">{slotsError}</p>
                )}

                {!slotsLoading && !slotsError && slots.length === 0 && (
                  <div className="text-center py-6">
                    <CalendarDays
                      size={28}
                      className="mx-auto text-[var(--color-text-muted)] mb-2 opacity-40"
                    />
                    <p className="text-sm text-[var(--color-text-muted)]">لا توجد مواعيد متاحة</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1 opacity-60">
                      اختر يومًا آخر
                    </p>
                  </div>
                )}

                {!slotsLoading && !slotsError && slots.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        dir="ltr"
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-all ${
                          selectedTime === slot
                            ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-md"
                            : "bg-white border-[var(--color-border)] hover:border-[var(--color-brand)]/50 text-[var(--color-text-primary)]"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] mt-4 text-center opacity-70">
                اختر يومًا لعرض المواعيد المتاحة
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                <ChevronRight size={15} />
                رجوع
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep(3)}
              >
                التالي
                <ChevronLeft size={15} />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Customer details ═══ */}
        {step === 3 && (
          <div>
            {/* Mini summary */}
            <div className="bg-[var(--color-surface-2)] rounded-xl px-4 py-3 mb-5 space-y-1.5">
              <SummaryRow label="الخدمة" value={selectedService?.nameAr ?? ""} />
              <SummaryRow label="اليوم"  value={selectedDate ? formatDateAr(selectedDate) : ""} />
              <SummaryRow label="الوقت"  value={selectedTime ?? ""} ltr />
            </div>

            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              بياناتك
            </p>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  الاسم الكامل <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="محمد أحمد"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  className={`input ${errors.name ? "border-red-400 focus:ring-red-200" : ""}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  رقم الهاتف <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  dir="ltr"
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((p) => ({ ...p, phone: undefined }));
                  }}
                  className={`input ${errors.phone ? "border-red-400 focus:ring-red-200" : ""}`}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  البريد الإلكتروني{" "}
                  <span className="text-[var(--color-text-muted)] font-normal">(اختياري)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  dir="ltr"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  className={`input ${errors.email ? "border-red-400 focus:ring-red-200" : ""}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                  ملاحظات{" "}
                  <span className="text-[var(--color-text-muted)] font-normal">(اختياري)</span>
                </label>
                <textarea
                  placeholder="أي معلومات إضافية…"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input resize-none"
                />
              </div>
            </div>

            {submitError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 leading-relaxed">
                {submitError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                <ChevronRight size={15} />
                رجوع
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    جارٍ الحجز…
                  </span>
                ) : (
                  "تأكيد الحجز"
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Success ═══ */}
        {step === 4 && confirmation && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mt-2 mb-4">
              <CheckCircle size={40} className="text-green-500" />
            </div>

            <h3 className="font-black text-xl text-[var(--color-text-primary)] mb-1">
              تم حجز موعدك!
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              يسعدنا استقبالك.
              <br />
              سيتواصل معك الفريق قريبًا.
            </p>

            <div className="text-start bg-[var(--color-surface-2)] rounded-xl p-4 space-y-3 mb-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">رقم الحجز</p>
                <p className="text-xs font-mono text-[var(--color-text-secondary)]" dir="ltr">
                  #{confirmation.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <SummaryRow label="العميل"   value={confirmation.customerName} />
              <SummaryRow label="الخدمة"   value={confirmation.serviceName} />
              <SummaryRow label="التاريخ"  value={formatDateAr(confirmation.date)} />
              <SummaryRow label="الوقت"    value={`${confirmation.startTime} – ${confirmation.endTime}`} ltr />
              <div className="pt-3 border-t border-[var(--color-border)]">
                <SummaryRow
                  label="الإجمالي"
                  value={`${confirmation.totalPrice.toLocaleString("ar-EG")} ${confirmation.currency}`}
                  bold
                />
              </div>
            </div>

            <Button variant="outline" fullWidth onClick={reset}>
              حجز موعد آخر
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
