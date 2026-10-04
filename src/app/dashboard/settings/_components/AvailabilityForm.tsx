"use client";

import { useState } from "react";
import { Loader2, Check, X, Clock, CalendarDays } from "lucide-react";
import type { AvailabilityDay } from "./SettingsClient";
import { useLanguage } from "@/contexts/LanguageContext";

const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Friday & Saturday are highlighted as typical weekend in EGY/KSA contexts
const WEEKEND_DAYS = new Set([5, 6]);

type Props = { initialAvailability: AvailabilityDay[] };

const timeInput: React.CSSProperties = {
  borderRadius:  8,
  border:        "1.5px solid var(--color-line)",
  background:    "var(--color-surface-2)",
  color:         "var(--color-ink)",
  fontSize:      13,
  paddingBlock:  7,
  paddingInline: 10,
  outline:       "none",
  transition:    "border-color 0.15s, box-shadow 0.15s",
  width:         120,
};

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--color-jade)";
  e.currentTarget.style.background  = "var(--color-surface)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(10,95,71,0.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--color-line)";
  e.currentTarget.style.background  = "var(--color-surface-2)";
  e.currentTarget.style.boxShadow   = "none";
}

export default function AvailabilityForm({ initialAvailability }: Props) {
  const [days,    setDays]    = useState<AvailabilityDay[]>(initialAvailability);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const DAY_NAMES = isAr ? DAY_NAMES_AR : DAY_NAMES_EN;

  function toggleDay(i: number) {
    setDays((prev) =>
      prev.map((d) => d.dayOfWeek === i ? { ...d, isClosed: !d.isClosed } : d)
    );
    setSuccess(false);
  }

  function setTime(i: number, field: "openTime" | "closeTime", val: string) {
    setDays((prev) =>
      prev.map((d) => d.dayOfWeek === i ? { ...d, [field]: val } : d)
    );
    setSuccess(false);
  }

  function validate(): string | null {
    for (const d of days) {
      if (d.isClosed) continue;
      if (!d.openTime || !d.closeTime)
        return isAr
          ? `أدخل وقت العمل ليوم ${DAY_NAMES_AR[d.dayOfWeek]}`
          : `Enter working hours for ${DAY_NAMES_EN[d.dayOfWeek]}`;

      const [oh, om] = d.openTime.split(":").map(Number);
      const [ch, cm] = d.closeTime.split(":").map(Number);
      const openMin  = oh * 60 + om;
      const closeMin = ch * 60 + cm;

      if (closeMin <= openMin) {
        return isAr
          ? `وقت الإغلاق يجب أن يكون بعد وقت الفتح في يوم ${DAY_NAMES_AR[d.dayOfWeek]}`
          : `Close time must be after open time for ${DAY_NAMES_EN[d.dayOfWeek]}`;
      }
      if (closeMin - openMin < 30) {
        return isAr
          ? `يجب أن يكون وقت العمل 30 دقيقة على الأقل في يوم ${DAY_NAMES_AR[d.dayOfWeek]}`
          : `Working hours must be at least 30 minutes for ${DAY_NAMES_EN[d.dayOfWeek]}`;
      }
    }
    return null;
  }

  async function handleSave() {
    setError("");
    setSuccess(false);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/business/availability", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ availability: days }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || (isAr ? "حدث خطأ أثناء الحفظ" : "An error occurred while saving")); return; }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError(isAr ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setSaving(false);
    }
  }

  const openCount = days.filter((d) => !d.isClosed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Summary banner ──────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{
          background: "var(--color-ground)",
          border:     "1.5px solid var(--color-line)",
          boxShadow:  "0 1px 4px rgba(17,32,28,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-night-2) 100%)" }}
          >
            <CalendarDays size={16} style={{ color: "var(--color-surface)" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
              <span style={{ color: "var(--color-jade)" }}>{openCount}</span>
              {isAr ? ` أيام عمل · ` : ` working day(s) · `}
              <span style={{ color: "var(--color-subtle)" }}>{7 - openCount}</span>
              {isAr ? " أيام إجازة" : " day(s) off"}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 1 }}>
              {isAr ? "التغييرات تؤثر فورًا على الحجوزات الجديدة" : "Changes take effect immediately on new bookings"}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: openCount > 0 ? "var(--color-ok-soft)" : "var(--color-danger-soft)",
            border:     `1px solid ${openCount > 0 ? "var(--color-ok-line)" : "var(--color-danger-line)"}`,
          }}
        >
          <div
            style={{
              width:        6,
              height:       6,
              borderRadius: "50%",
              background:   openCount > 0 ? "var(--color-ok)" : "var(--color-danger)",
              flexShrink:   0,
            }}
          />
          <span
            style={{
              fontSize:   11,
              fontWeight: 600,
              color:      openCount > 0 ? "var(--color-ok)" : "var(--color-danger)",
            }}
          >
            {openCount > 0
              ? (isAr ? "جدولك نشط" : "Schedule active")
              : (isAr ? "لا أيام عمل" : "No working days")}
          </span>
        </div>
      </div>

      {/* ── Day rows ────────────────────────────────────────── */}
      <div
        style={{
          background:   "var(--color-surface)",
          border:       "1.5px solid var(--color-line)",
          borderRadius: 20,
          overflow:     "hidden",
          boxShadow:    "0 1px 6px rgba(17,32,28,0.05)",
        }}
      >
        {/* Column header */}
        <div
          className="grid items-center px-5 py-2.5"
          style={{
            gridTemplateColumns: "48px 100px 1fr",
            gap:                 16,
            background:          "var(--color-ground)",
            borderBottom:        "1px solid var(--color-surface-3)",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600 }}>{isAr ? "الحالة" : "Status"}</span>
          <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600 }}>{isAr ? "اليوم" : "Day"}</span>
          <span style={{ fontSize: 11, color: "var(--color-subtle)", fontWeight: 600 }}>{isAr ? "وقت العمل" : "Working Hours"}</span>
        </div>

        {days.map((day, idx) => {
          const isOpen     = !day.isClosed;
          const isWeekend  = WEEKEND_DAYS.has(day.dayOfWeek);
          const isLast     = idx === days.length - 1;

          return (
            <div
              key={day.dayOfWeek}
              className="grid items-center px-5"
              style={{
                gridTemplateColumns: "48px 100px 1fr",
                gap:                 16,
                paddingTop:          14,
                paddingBottom:       14,
                borderBottom:        isLast ? "none" : "1px solid var(--color-surface-2)",
                background:          isOpen ? "var(--color-surface)" : "var(--color-ground)",
                transition:          "background 0.15s",
              }}
            >
              {/* Toggle */}
              <button
                type="button"
                dir="ltr"
                role="switch"
                aria-checked={isOpen}
                onClick={() => toggleDay(day.dayOfWeek)}
                style={{
                  width:        40,
                  height:       22,
                  borderRadius: 11,
                  background:   isOpen ? "var(--color-ink)" : "var(--color-line-2)",
                  position:     "relative",
                  flexShrink:   0,
                  transition:   "background 0.2s",
                  border:       "none",
                  cursor:       "pointer",
                }}
              >
                <span
                  style={{
                    position:   "absolute",
                    width:      16,
                    height:     16,
                    borderRadius: "50%",
                    background: "var(--color-surface)",
                    boxShadow:  "0 1px 4px rgba(17,32,28,0.2)",
                    top:        3,
                    left:       isOpen ? 21 : 3,
                    transition: "left 0.2s",
                  }}
                />
              </button>

              {/* Day name */}
              <span
                style={{
                  fontSize:   13,
                  fontWeight: isOpen ? 700 : 500,
                  color:      isOpen ? "var(--color-ink)" : "var(--color-subtle)",
                  transition: "color 0.15s",
                }}
              >
                {DAY_NAMES[day.dayOfWeek]}
                {isWeekend && (
                  <span
                    className="ms-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
                  >
                    {isAr ? "إجازة" : "Off"}
                  </span>
                )}
              </span>

              {/* Times or closed label */}
              {isOpen ? (
                <div className="flex items-center gap-2 flex-wrap" dir="ltr">
                  <input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => setTime(day.dayOfWeek, "openTime", e.target.value)}
                    style={timeInput}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  <span style={{ color: "var(--color-line-2)", fontSize: 14, fontWeight: 300 }}>—</span>
                  <input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => setTime(day.dayOfWeek, "closeTime", e.target.value)}
                    style={timeInput}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                  {/* Duration pill */}
                  {day.openTime && day.closeTime && (() => {
                    const [oh, om] = day.openTime.split(":").map(Number);
                    const [ch, cm] = day.closeTime.split(":").map(Number);
                    const mins = (ch * 60 + cm) - (oh * 60 + om);
                    if (mins <= 0) return null;
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return (
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: "var(--color-jade-tint)", color: "var(--color-jade)", border: "1px solid var(--color-jade-line)" }}
                        dir="ltr"
                      >
                        <Clock size={10} />
                        {h > 0 && `${h}${isAr ? "س" : "h"}`}{m > 0 && ` ${m}${isAr ? "د" : "m"}`}
                      </span>
                    );
                  })()}
                </div>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: "var(--color-surface-3)", color: "var(--color-subtle)", width: "fit-content" }}
                >
                  {isAr ? "إجازة" : "Day off"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Feedback ────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "var(--color-danger-soft)", border: "1.5px solid var(--color-danger-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "var(--color-danger-soft)" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "var(--color-danger)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-danger)", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "var(--color-ok-soft)", border: "1.5px solid var(--color-ok-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-ok-soft)" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ok)", fontWeight: 600 }}>
            {isAr ? "تم حفظ أوقات العمل بنجاح" : "Working hours saved successfully"}
          </p>
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{
          background: "var(--color-ground)",
          border:     "1.5px solid var(--color-line)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--color-subtle)" }}>
          {isAr ? "التعديلات تؤثر فوراً على الحجوزات الجديدة" : "Changes take effect immediately on new bookings"}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl font-extrabold text-white transition-all duration-150 disabled:opacity-60 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
          style={{
            padding:       "10px 22px",
            fontSize:      13,
            background:    "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-hover) 60%, var(--color-jade) 100%)",
            boxShadow:     "0 3px 12px rgba(10,95,71,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {isAr ? "جاري الحفظ..." : "Saving..."}
            </>
          ) : (
            <>
              <Check size={14} />
              {isAr ? "حفظ أوقات العمل" : "Save Working Hours"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
