"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronRight, CheckCircle,
  Loader2, CalendarDays, Clock, Check, Users, Scissors,
} from "lucide-react";
import type { Service } from "@/types/service";
import type { PublicTable, PublicStaff } from "./CompanyContent";
import { formatPrice, formatDuration } from "@/lib/utils";
import { TABLE_TYPE_LABELS } from "@/lib/business-type";

// ─── Types ────────────────────────────────────────────────

interface BookingWidgetProps {
  services:            Service[];
  businessName:        string;
  slug:                string;
  openDays:            number[];
  preselectedService?: Service | null;
  businessType:        "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  tables:              PublicTable[];
  staffMembers:        PublicStaff[];
}

type BookingConfirmation = {
  id:           string;
  accessToken:  string | null;
  businessName: string;
  serviceName:  string;
  date:         string;
  startTime:    string;
  endTime:      string;
  customerName: string;
  totalPrice:   number;
  currency:     string;
};

type Step = "service" | "resource" | "datetime" | "details" | "done";

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

// ─── Sub-components ───────────────────────────────────────

function SummaryRow({
  label, value, ltr = false, bold = false,
}: { label: string; value: string; ltr?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-[#94A3B8] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-end ${bold ? "font-black text-[#1D4ED8]" : "font-semibold text-[#0F172A]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4" dir="rtl">
      <div className="w-1 h-5 bg-[#1D4ED8] rounded-full" />
      <h4 className="text-base font-bold text-[#1D4ED8]">{children}</h4>
    </div>
  );
}

function ServiceIcon({ service }: { service: Service }) {
  if (service.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={service.image} alt={service.nameAr} className="w-10 h-10 object-contain" />;
  }
  return <span className="text-xl font-bold text-[#3B82F6]">{service.nameAr.charAt(0)}</span>;
}

// ─── Main Component ───────────────────────────────────────

export default function BookingWidget({
  services,
  businessName,
  slug,
  openDays,
  preselectedService,
  businessType,
  tables,
  staffMembers,
}: BookingWidgetProps) {
  const hasResource = businessType === "RESTAURANT" || businessType === "BARBERSHOP";

  // Steps
  const ALL_STEPS: Step[] = hasResource
    ? ["service", "resource", "datetime", "details"]
    : ["service", "datetime", "details"];

  const stepLabel = (s: Step): string => {
    if (s === "service")  return "الخدمة";
    if (s === "resource") return businessType === "RESTAURANT" ? "الطاولة" : "الحلاق";
    if (s === "datetime") return "الموعد";
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
  function goToStep(s: Step) { setStep(s); }

  // ── Selections ──────────────────────────────────────────
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTable,   setSelectedTable]   = useState<PublicTable | null>(null);
  const [selectedStaff,   setSelectedStaff]   = useState<PublicStaff | null>(null);
  const [partySize,       setPartySize]        = useState(2);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

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
    setSelectedTable(null);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSlots([]);
    setStep(hasResource ? "resource" : "datetime");
  }, [preselectedService, hasResource]);

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
    if (selectedStaff) params.set("staffMemberId", selectedStaff.id);
    if (selectedTable) params.set("tableId",       selectedTable.id);

    fetch(`/api/public/${slug}/slots?${params}`)
      .then((r) => r.json())
      .then((data) => { setSlots(data.slots ?? []); setSlotsLoading(false); })
      .catch(() => { setSlotsError("تعذّر تحميل المواعيد، حاول مرة أخرى"); setSlotsLoading(false); });
  }, [selectedDate, selectedService, selectedStaff, selectedTable, slug]);

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
          tableId:       selectedTable?.id,
          staffMemberId: selectedStaff?.id,
          partySize:     businessType === "RESTAURANT" ? partySize : undefined,
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
    setSelectedTable(null);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setName(""); setPhone(""); setEmail(""); setNotes("");
    setErrors({});
    setSlots([]);
    setConfirmation(null);
    setSubmitError(null);
    setPartySize(2);
  }

  // ── Derived ─────────────────────────────────────────────
  // For barbershop: filter staff to those who offer the selected service
  const availableStaff = selectedService
    ? staffMembers.filter(
        (s) => s.serviceIds.length === 0 || s.serviceIds.includes(selectedService.id),
      )
    : staffMembers;

  // Step index for stepper (1-based, "done" step doesn't appear in stepper)
  const stepperSteps = ALL_STEPS.map((s, i) => ({ id: s, label: stepLabel(s), n: i + 1 }));
  const currentStepN = ALL_STEPS.indexOf(step) + 1;

  return (
    <div
      id="booking"
      className="overflow-hidden rounded-3xl bg-white"
      dir="rtl"
      style={{
        boxShadow:  "0 4px 32px rgba(15,23,42,0.10), 0 1px 8px rgba(15,23,42,0.06)",
        border:     "1px solid #E2E8F0",
        fontFamily: "var(--font-cairo, Cairo, sans-serif)",
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 py-5 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
      >
        <div>
          <h2 className="text-white text-xl font-bold leading-tight">احجز موعدك</h2>
          <p className="text-blue-200 text-sm mt-0.5">{businessName}</p>
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/20 shrink-0">
          <CalendarDays size={22} className="text-white" />
        </div>
      </div>

      {/* ── Stepper ── */}
      {step !== "done" && (
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between relative">
            <div className="absolute top-4 right-4 left-4 h-0.5 bg-gray-200" style={{ zIndex: 0 }} />
            {stepperSteps.map((s) => {
              const done   = currentStepN > s.n;
              const active = currentStepN === s.n;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      active ? "bg-[#1D4ED8] text-white shadow-md"
                             : done  ? "bg-[#1D4ED8] text-white"
                             : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={3} /> : s.n}
                  </div>
                  <span className={`text-[11px] font-semibold ${active ? "text-[#1D4ED8]" : "text-gray-400"}`}>
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
              <p className="text-sm text-gray-400 text-center py-6">لا توجد خدمات متاحة حاليًا</p>
            ) : (
              <div className="space-y-3">
                {services.map((service) => {
                  const selected = selectedService?.id === service.id;
                  return (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service)}
                      className={`w-full text-start rounded-2xl border-2 p-3.5 transition-all relative ${
                        selected
                          ? "border-[#1D4ED8] bg-blue-50/50"
                          : "border-gray-200 bg-white hover:border-[#1D4ED8]/40"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          {service.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={service.image} alt={service.nameAr} className="w-10 h-10 object-contain" />
                            : <span className="text-xl font-bold text-[#3B82F6]">{service.nameAr.charAt(0)}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-gray-800 leading-snug">{service.nameAr}</p>
                          {service.duration > 0 && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Clock size={11} />
                              {formatDuration(service.duration)}
                            </p>
                          )}
                        </div>
                        <p className="text-base font-black text-[#1D4ED8] shrink-0">
                          {formatPrice(service.price, service.currency)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              disabled={!selectedService}
              onClick={goNext}
              className={`mt-5 w-full py-3.5 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all ${
                selectedService ? "bg-[#1D4ED8] hover:bg-[#1E40AF] shadow-md" : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              التالي <span className="text-lg leading-none">←</span>
            </button>
          </div>
        )}

        {/* ═══ STEP: resource (barber / table) ═══ */}
        {step === "resource" && (
          <div>
            {/* ── Barbershop: pick barber ── */}
            {businessType === "BARBERSHOP" && (
              <>
                <SectionTitle>اختر الحلاق</SectionTitle>

                {availableStaff.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">لا يوجد موظفون متاحون</p>
                ) : (
                  <div className="space-y-3">
                    {/* "Any barber" option */}
                    <button
                      onClick={() => setSelectedStaff(null)}
                      className={`w-full text-start rounded-2xl border-2 p-3.5 transition-all relative ${
                        selectedStaff === null
                          ? "border-[#1D4ED8] bg-blue-50/50"
                          : "border-gray-200 bg-white hover:border-[#1D4ED8]/40"
                      }`}
                    >
                      {selectedStaff === null && (
                        <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center">
                          <Check size={13} strokeWidth={3} className="text-white" />
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                          <Scissors size={22} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-gray-800">أي حلاق متاح</p>
                          <p className="text-xs text-gray-400 mt-0.5">سيتم تخصيص أقرب موعد</p>
                        </div>
                      </div>
                    </button>

                    {availableStaff.map((staff) => {
                      const selected = selectedStaff?.id === staff.id;
                      return (
                        <button
                          key={staff.id}
                          onClick={() => setSelectedStaff(staff)}
                          className={`w-full text-start rounded-2xl border-2 p-3.5 transition-all relative ${
                            selected
                              ? "border-[#1D4ED8] bg-blue-50/50"
                              : "border-gray-200 bg-white hover:border-[#1D4ED8]/40"
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center">
                              <Check size={13} strokeWidth={3} className="text-white" />
                            </span>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
                              {staff.photo
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={staff.photo} alt={staff.nameAr} className="w-full h-full object-cover" />
                                : <span className="text-xl font-bold text-[#3B82F6]">{staff.nameAr.charAt(0)}</span>
                              }
                            </div>
                            <div>
                              <p className="text-[15px] font-bold text-gray-800">{staff.nameAr}</p>
                              {staff.role && <p className="text-xs text-gray-400 mt-0.5">{staff.role}</p>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Restaurant: pick table ── */}
            {businessType === "RESTAURANT" && (
              <>
                <SectionTitle>اختر الطاولة</SectionTitle>

                {/* Party size */}
                <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Users size={15} className="text-[#1D4ED8]" />
                    عدد الأشخاص
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                      className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center hover:border-[#1D4ED8] transition-all text-lg leading-none"
                    >−</button>
                    <span className="text-base font-black text-[#0F172A] w-5 text-center">{partySize}</span>
                    <button
                      type="button"
                      onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                      className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 font-bold flex items-center justify-center hover:border-[#1D4ED8] transition-all text-lg leading-none"
                    >+</button>
                  </div>
                </div>

                {tables.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">لا توجد طاولات متاحة حاليًا</p>
                ) : (
                  <div className="space-y-3">
                    {tables.map((table) => {
                      const selected    = selectedTable?.id === table.id;
                      const typeLabel   = TABLE_TYPE_LABELS[table.tableType]?.ar ?? table.tableType;
                      const tooSmall    = partySize > table.capacity;
                      return (
                        <button
                          key={table.id}
                          onClick={() => !tooSmall && setSelectedTable(table)}
                          disabled={tooSmall}
                          className={`w-full text-start rounded-2xl border-2 p-3.5 transition-all relative ${
                            tooSmall
                              ? "opacity-40 cursor-not-allowed border-gray-200"
                              : selected
                              ? "border-[#1D4ED8] bg-blue-50/50"
                              : "border-gray-200 bg-white hover:border-[#1D4ED8]/40"
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-3 left-3 w-6 h-6 rounded-full bg-[#1D4ED8] flex items-center justify-center">
                              <Check size={13} strokeWidth={3} className="text-white" />
                            </span>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 overflow-hidden">
                              {table.photo
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={table.photo} alt={table.name} className="w-full h-full object-cover" />
                                : <span className="text-2xl">🪑</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-bold text-gray-800">{table.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{typeLabel}</p>
                            </div>
                            <div className="text-end shrink-0">
                              <p className="text-sm font-black text-[#0F172A] flex items-center gap-1">
                                <Users size={12} /> {table.capacity}
                              </p>
                              {tooSmall && (
                                <p className="text-[10px] text-red-400 mt-0.5">صغيرة</p>
                              )}
                            </div>
                          </div>
                          {table.notes && (
                            <p className="text-xs text-gray-400 mt-2 pe-2">{table.notes}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => goToStep("service")}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center gap-1 hover:border-gray-300 transition-all"
              >
                <ChevronRight size={15} /> رجوع
              </button>
              <button
                disabled={businessType === "RESTAURANT" && !selectedTable}
                onClick={goNext}
                className={`flex-1 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  businessType === "RESTAURANT" && !selectedTable
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-[#1D4ED8] hover:bg-[#1E40AF] shadow-md"
                }`}
              >
                التالي <span className="text-base leading-none">←</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: datetime ═══ */}
        {step === "datetime" && (
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
                    className={`flex flex-col items-center py-2.5 px-2.5 rounded-xl text-xs shrink-0 min-w-[44px] transition-all ${
                      disabled
                        ? "opacity-30 cursor-not-allowed bg-gray-100 text-gray-400"
                        : selected
                        ? "bg-[#1D4ED8] text-white shadow-md"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    <span className="text-[9px] opacity-70">{d.dayAr.slice(0, 3)}</span>
                    <span className="font-bold text-sm mt-0.5">{d.dayNum}</span>
                    <span className="text-[9px] mt-0.5 opacity-60">{d.monthAr.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>

            {selectedDate ? (
              <div className="mt-5">
                <SectionTitle>اختر الوقت</SectionTitle>

                {slotsLoading && (
                  <div className="flex items-center justify-center py-8 gap-2">
                    <Loader2 size={20} className="animate-spin text-[#1D4ED8]" />
                    <span className="text-sm text-gray-400">جارٍ التحميل…</span>
                  </div>
                )}
                {!slotsLoading && slotsError && (
                  <p className="text-sm text-red-500 text-center py-4">{slotsError}</p>
                )}
                {!slotsLoading && !slotsError && slots.length === 0 && (
                  <div className="text-center py-6">
                    <CalendarDays size={28} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">لا توجد مواعيد متاحة</p>
                    <p className="text-xs text-gray-300 mt-1">اختر يومًا آخر</p>
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
                            ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-md"
                            : "bg-white border-gray-200 hover:border-[#1D4ED8]/50 text-gray-700"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-4 text-center">اختر يومًا لعرض المواعيد المتاحة</p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={goBack}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center gap-1 hover:border-gray-300 transition-all"
              >
                <ChevronRight size={15} /> رجوع
              </button>
              <button
                disabled={!selectedDate || !selectedTime}
                onClick={goNext}
                className={`flex-1 py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  selectedDate && selectedTime
                    ? "bg-[#1D4ED8] hover:bg-[#1E40AF] shadow-md"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                التالي <span className="text-base leading-none">←</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: details ═══ */}
        {step === "details" && (
          <div>
            {/* Mini summary */}
            <div className="rounded-2xl px-4 py-3 mb-5 space-y-1.5" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.14)" }}>
              <SummaryRow label={businessType === "RESTAURANT" ? "الجلسة" : "الخدمة"} value={selectedService?.nameAr ?? ""} />
              {selectedStaff && <SummaryRow label="الحلاق"  value={selectedStaff.nameAr} />}
              {selectedTable && <SummaryRow label="الطاولة" value={selectedTable.name} />}
              <SummaryRow label="اليوم"  value={selectedDate ? formatDateAr(selectedDate) : ""} />
              <SummaryRow label="الوقت"  value={selectedTime ?? ""} ltr />
              {businessType === "RESTAURANT" && (
                <SummaryRow label="الأشخاص" value={`${partySize} أشخاص`} />
              )}
            </div>

            <SectionTitle>بياناتك</SectionTitle>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  الاسم الكامل <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="محمد أحمد"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.name ? "border-red-400" : "border-gray-200 focus:border-[#1D4ED8]"}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  رقم الهاتف <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="01xxxxxxxxx"
                  value={phone}
                  dir="ltr"
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                  className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.phone ? "border-red-400" : "border-gray-200 focus:border-[#1D4ED8]"}`}
                />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  البريد الإلكتروني <span className="text-gray-400 font-normal">(اختياري)</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  dir="ltr"
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  className={`w-full rounded-xl border-2 px-3.5 py-2.5 text-sm outline-none transition-all ${errors.email ? "border-red-400" : "border-gray-200 focus:border-[#1D4ED8]"}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  ملاحظات <span className="text-gray-400 font-normal">(اختياري)</span>
                </label>
                <textarea
                  placeholder="أي معلومات إضافية…"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#1D4ED8] transition-all resize-none"
                />
              </div>
            </div>

            {submitError && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 leading-relaxed">
                {submitError}
              </div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                onClick={goBack}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm flex items-center justify-center gap-1 hover:border-gray-300 transition-all disabled:opacity-50"
              >
                <ChevronRight size={15} /> رجوع
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-2xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-60"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> جارٍ الحجز…</> : "تأكيد الحجز"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP: done ═══ */}
        {step === "done" && confirmation && (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mt-2 mb-4">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h3 className="font-black text-xl text-gray-800 mb-1">تم حجز موعدك!</h3>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              يسعدنا استقبالك. سيتواصل معك الفريق قريبًا.
              <br />
              تم إرسال تفاصيل الحجز ورابط الإدارة إلى بريدك الإلكتروني.
            </p>

            <div className="text-start rounded-2xl p-4 space-y-3 mb-5" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.14)" }}>
              <div className="flex items-center justify-between pb-3 border-b border-[rgba(59,130,246,0.14)]">
                <p className="text-xs font-medium text-gray-400">رقم الحجز</p>
                <p className="text-xs font-mono text-gray-600" dir="ltr">#{confirmation.id.slice(-8).toUpperCase()}</p>
              </div>
              <SummaryRow label="العميل"  value={confirmation.customerName} />
              <SummaryRow label="الخدمة"  value={confirmation.serviceName} />
              <SummaryRow label="التاريخ" value={formatDateAr(confirmation.date)} />
              <SummaryRow label="الوقت"   value={`${confirmation.startTime} – ${confirmation.endTime}`} ltr />
              {selectedTable && <SummaryRow label="الطاولة" value={selectedTable.name} />}
              {selectedStaff && <SummaryRow label="الحلاق"  value={selectedStaff.nameAr} />}
              <div className="pt-3 border-t border-[rgba(59,130,246,0.14)]">
                <SummaryRow
                  label="الإجمالي"
                  value={`${confirmation.totalPrice.toLocaleString("ar-EG")} ${confirmation.currency}`}
                  bold
                />
              </div>
            </div>

            {confirmation.accessToken && (
              <a
                href={`/booking/${confirmation.accessToken}`}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center py-3 rounded-2xl border-2 border-[#1D4ED8] text-[#1D4ED8] text-sm font-bold hover:bg-blue-50 transition-colors mb-3"
              >
                عرض تفاصيل الحجز
              </a>
            )}

            <button
              onClick={reset}
              className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold text-sm hover:border-gray-300 transition-all"
            >
              حجز موعد آخر
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
