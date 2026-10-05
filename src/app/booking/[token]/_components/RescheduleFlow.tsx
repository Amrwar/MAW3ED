"use client";

import { useState } from "react";
import { CalendarDays, Clock, Loader2, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "idle" | "date" | "slots" | "confirm" | "done";

interface Props {
  token:        string;
  slug:         string;
  serviceId:    string;
  currentDate:  string;   // "YYYY-MM-DD"
  currentStart: string;   // "HH:MM"
  currentEnd:   string;   // "HH:MM"
  serviceName:  string;
  businessName: string;
}

// ── Arabic helpers ────────────────────────────────────────────────────────────

const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDateAr(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

function todayEgypt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RescheduleFlow({
  token,
  slug,
  serviceId,
  currentDate,
  currentStart,
  currentEnd,
  serviceName,
  businessName,
}: Props) {
  const [step,       setStep]       = useState<Step>("idle");
  const [newDate,    setNewDate]    = useState("");
  const [slots,      setSlots]      = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError,   setSlotsError]   = useState("");
  const [newStart,   setNewStart]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState("");

  // ── Step 1 → 2: pick a date ──────────────────────────────────
  async function handleDateSubmit() {
    if (!newDate) return;
    setSlotsLoading(true);
    setSlotsError("");
    setNewStart("");
    try {
      const res  = await fetch(
        `/api/public/${slug}/slots?serviceId=${serviceId}&date=${newDate}`
      );
      const data = await res.json();
      if (!res.ok) { setSlotsError(data.error ?? "تعذّر تحميل المواعيد"); return; }
      const available: string[] = data.slots ?? [];
      if (available.length === 0) {
        setSlotsError("لا توجد مواعيد متاحة في هذا اليوم، اختر تاريخًا آخر");
        return;
      }
      setSlots(available);
      setStep("slots");
    } catch {
      setSlotsError("تعذّر الاتصال بالخادم");
    } finally {
      setSlotsLoading(false);
    }
  }

  // ── Step 2 → 3: pick a slot ──────────────────────────────────
  function handleSlotSelect(slot: string) {
    setNewStart(slot);
    setStep("confirm");
  }

  // ── Step 3 → submit ──────────────────────────────────────────
  async function handleConfirm() {
    setSubmitting(true);
    setApiError("");
    try {
      const res  = await fetch(`/api/booking/${token}/reschedule`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ date: newDate, startTime: newStart }),
      });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error ?? "حدث خطأ أثناء إعادة الجدولة"); return; }
      setStep("done");
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setApiError("تعذّر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("idle");
    setNewDate("");
    setSlots([]);
    setNewStart("");
    setApiError("");
    setSlotsError("");
  }

  // ── Render: idle ─────────────────────────────────────────────
  if (step === "idle") {
    return (
      <button
        onClick={() => setStep("date")}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[var(--radius-md)] border-2 border-[var(--color-accent)] text-[var(--color-accent)] text-sm font-bold hover:bg-[var(--color-accent-light)] transition-colors"
      >
        <RefreshCw size={15} />
        إعادة جدولة الموعد
      </button>
    );
  }

  // ── Render: success ──────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-ok-soft)] border border-[var(--color-ok-line)] p-5 text-center space-y-2">
        <CheckCircle2 size={32} className="mx-auto text-[var(--color-ok)]" />
        <p className="font-bold text-[var(--color-ok)]">تم إعادة الجدولة بنجاح</p>
        <p className="text-sm text-[var(--color-ok)]">
          {formatDateAr(newDate)} · {newStart}
        </p>
        <p className="text-xs text-[var(--color-ok)]">جاري تحديث الصفحة...</p>
      </div>
    );
  }

  // ── Render: flow card ────────────────────────────────────────
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <RefreshCw size={16} className="text-[var(--color-accent)]" />
        <p className="text-sm font-bold text-[var(--color-text-primary)] flex-1">
          إعادة جدولة الموعد
        </p>
        <button
          onClick={reset}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          إلغاء
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Current booking summary */}
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">الموعد الحالي</p>
          <p className="font-semibold text-[var(--color-text-primary)]">
            {formatDateAr(currentDate)}
          </p>
          <p className="text-[var(--color-text-secondary)]" dir="ltr">
            {currentStart} – {currentEnd}
          </p>
        </div>

        {/* Step: date picker */}
        {(step === "date") && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-[var(--color-text-primary)]">
              <CalendarDays size={14} className="inline ms-1" />
              اختر تاريخًا جديدًا
            </label>
            <input
              type="date"
              min={todayEgypt()}
              value={newDate}
              onChange={(e) => { setNewDate(e.target.value); setSlotsError(""); }}
              className="input w-full"
              dir="ltr"
            />
            {slotsError && (
              <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-[var(--radius-md)] px-4 py-2">
                {slotsError}
              </p>
            )}
            <button
              onClick={handleDateSubmit}
              disabled={!newDate || slotsLoading}
              className="w-full py-2.5 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {slotsLoading
                ? <><Loader2 size={15} className="animate-spin" /> جاري التحميل...</>
                : <>عرض المواعيد المتاحة <ArrowLeft size={14} /></>
              }
            </button>
          </div>
        )}

        {/* Step: slot picker */}
        {step === "slots" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                <Clock size={14} className="inline ms-1" />
                {formatDateAr(newDate)}
              </p>
              <button
                onClick={() => setStep("date")}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                تغيير التاريخ
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleSlotSelect(slot)}
                  dir="ltr"
                  className="py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)] transition-all"
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            {/* Old → New comparison */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm overflow-hidden">
              <div className="px-4 py-3 bg-[var(--color-danger-soft)]">
                <p className="text-xs text-[var(--color-danger)] mb-0.5">الموعد الحالي</p>
                <p className="font-semibold text-[var(--color-danger)] line-through">
                  {formatDateAr(currentDate)}
                </p>
                <p className="text-[var(--color-danger)] line-through" dir="ltr">
                  {currentStart} – {currentEnd}
                </p>
              </div>
              <div className="px-4 py-3 bg-[var(--color-ok-soft)]">
                <p className="text-xs text-[var(--color-ok)] mb-0.5">الموعد الجديد</p>
                <p className="font-semibold text-[var(--color-ok)]">
                  {formatDateAr(newDate)}
                </p>
                <p className="text-[var(--color-ok)]" dir="ltr">{newStart}</p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] text-center">
              بعد إعادة الجدولة سيعود الحجز إلى حالة &quot;في الانتظار&quot; للمراجعة
            </p>

            {apiError && (
              <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] rounded-[var(--radius-md)] px-4 py-2 text-center">
                {apiError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("slots")}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-50"
              >
                تغيير الوقت
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-bold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> جاري...</>
                  : "تأكيد إعادة الجدولة"
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
