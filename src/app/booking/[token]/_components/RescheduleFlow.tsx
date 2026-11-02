"use client";

import { useState } from "react";
import { CalendarDays, Clock, Loader2, CheckCircle2, ArrowLeft, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { bookingRefusalEn, refusalText } from "@/lib/lang";
import type { Lang } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "idle" | "date" | "slots" | "confirm" | "done";

interface Props {
  // The token is all the slots need: the server reads the booking's own
  // service, staff member, resource and branch from it, and leaves the
  // booking itself out of the grid it is moving within.
  token:        string;
  currentDate:  string;   // "YYYY-MM-DD"
  currentStart: string;   // "HH:MM"
  currentEnd:   string;   // "HH:MM"
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  if (lang === "en") {
    return date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  return `${AR_DAYS[date.getDay()]}، ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

function todayEgypt(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RescheduleFlow({
  token,
  currentDate,
  currentStart,
  currentEnd,
}: Props) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const t = (ar: string, english: string) => (en ? english : ar);
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
      // This booking's own slots: it no longer blocks the times around
      // where it sits, which the public grid could not know to ignore.
      const query = new URLSearchParams({ date: newDate });
      const res  = await fetch(`/api/public/booking/${token}/slots?${query}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSlotsError(refusalText(res.status, data.error, en, "تعذّر تحميل المواعيد")); return; }
      const available: string[] = data.slots ?? [];
      if (available.length === 0) {
        setSlotsError(t("لا توجد مواعيد متاحة في هذا اليوم، اختر تاريخًا آخر", "No times are free that day. Choose another date."));
        return;
      }
      setSlots(available);
      setStep("slots");
    } catch {
      setSlotsError(t("تعذّر الاتصال بالخادم", "Couldn't connect. Try again."));
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setApiError((en && bookingRefusalEn(data, "change")) || refusalText(res.status, data.error, en, "حدث خطأ أثناء إعادة الجدولة")); return; }
      setStep("done");
      setTimeout(() => window.location.reload(), 2500);
    } catch {
      setApiError(t("تعذّر الاتصال بالخادم، حاول مرة أخرى", "Couldn't connect. Try again."));
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
        {t("إعادة جدولة الموعد", "Change the time")}
      </button>
    );
  }

  // ── Render: success ──────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[var(--color-ok-soft)] border border-[var(--color-ok-line)] p-5 text-center space-y-2">
        <CheckCircle2 size={32} className="mx-auto text-[var(--color-ok)]" />
        <p className="font-bold text-[var(--color-ok)]">{t("اتغيّر ميعادك", "Your time is changed")}</p>
        <p className="text-sm text-[var(--color-ok)]">
          {formatDate(newDate, lang)} · {newStart}
        </p>
        {/* The reschedule route puts the booking back to PENDING for the
            business to confirm the new time. */}
        <p className="text-xs text-[var(--color-ok)]">{t("المكان هيأكد الميعاد الجديد وهيوصلك إشعار. جارٍ تحديث الصفحة…", "The place will confirm the new time and we'll let you know. Refreshing the page…")}</p>
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
          {t("إعادة جدولة الموعد", "Change the time")}
        </p>
        <button
          onClick={reset}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("إلغاء", "Cancel")}
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Current booking summary */}
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">{t("الموعد الحالي", "Current time")}</p>
          <p className="font-semibold text-[var(--color-text-primary)]">
            {formatDate(currentDate, lang)}
          </p>
          <p className="text-[var(--color-text-secondary)]" dir="ltr">
            {currentStart} – {currentEnd}
          </p>
        </div>

        {/* Step: date picker */}
        {(step === "date") && (
          <div className="space-y-3">
            <label htmlFor="reschedule-date" className="block text-sm font-semibold text-[var(--color-text-primary)]">
              <CalendarDays size={14} className="inline ms-1" />
              {t("اختر تاريخًا جديدًا", "Choose a new date")}
            </label>
            <input
              id="reschedule-date"
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
                ? <><Loader2 size={15} className="animate-spin" /> {t("جارٍ التحميل…", "Loading…")}</>
                : <>{t("عرض المواعيد المتاحة", "Show free times")} <ArrowLeft size={14} className={en ? "rotate-180" : undefined} /></>
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
                {formatDate(newDate, lang)}
              </p>
              <button
                onClick={() => setStep("date")}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                {t("تغيير التاريخ", "Change date")}
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
                <p className="text-xs text-[var(--color-danger)] mb-0.5">{t("الموعد الحالي", "Current time")}</p>
                <p className="font-semibold text-[var(--color-danger)] line-through">
                  {formatDate(currentDate, lang)}
                </p>
                <p className="text-[var(--color-danger)] line-through" dir="ltr">
                  {currentStart} – {currentEnd}
                </p>
              </div>
              <div className="px-4 py-3 bg-[var(--color-ok-soft)]">
                <p className="text-xs text-[var(--color-ok)] mb-0.5">{t("الموعد الجديد", "New time")}</p>
                <p className="font-semibold text-[var(--color-ok)]">
                  {formatDate(newDate, lang)}
                </p>
                <p className="text-[var(--color-ok)]" dir="ltr">{newStart}</p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] text-center">
              {t("بعد إعادة الجدولة سيعود الحجز إلى حالة \"في الانتظار\" للمراجعة", "After the change, the booking goes back to \"Pending\" until the place confirms it.")}
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
                {t("تغيير الوقت", "Change time")}
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white text-sm font-bold hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> {t("جارٍ التأكيد…", "Confirming…")}</>
                  : t("تأكيد إعادة الجدولة", "Confirm the new time")
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
