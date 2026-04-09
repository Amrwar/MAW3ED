"use client";

import { useState } from "react";
import { Loader2, Check, X, Clock, CalendarDays } from "lucide-react";
import type { AvailabilityDay } from "./SettingsClient";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// Friday & Saturday are highlighted as typical weekend in EGY/KSA contexts
const WEEKEND_DAYS = new Set([5, 6]);

type Props = { initialAvailability: AvailabilityDay[] };

const timeInput: React.CSSProperties = {
  borderRadius:  8,
  border:        "1.5px solid #E2E8F0",
  background:    "#F8FAFC",
  color:         "#0F172A",
  fontSize:      13,
  paddingBlock:  7,
  paddingInline: 10,
  outline:       "none",
  transition:    "border-color 0.15s, box-shadow 0.15s",
  width:         120,
};

function onFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#1D4ED8";
  e.currentTarget.style.background  = "#FFFFFF";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(29,78,216,0.1)";
}
function onBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#E2E8F0";
  e.currentTarget.style.background  = "#F8FAFC";
  e.currentTarget.style.boxShadow   = "none";
}

export default function AvailabilityForm({ initialAvailability }: Props) {
  const [days,    setDays]    = useState<AvailabilityDay[]>(initialAvailability);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

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
      if (!d.openTime || !d.closeTime) return `أدخل وقت العمل ليوم ${DAY_NAMES[d.dayOfWeek]}`;

      const [oh, om] = d.openTime.split(":").map(Number);
      const [ch, cm] = d.closeTime.split(":").map(Number);
      const openMin  = oh * 60 + om;
      const closeMin = ch * 60 + cm;

      if (closeMin <= openMin) {
        return `وقت الإغلاق يجب أن يكون بعد وقت الفتح في يوم ${DAY_NAMES[d.dayOfWeek]}`;
      }
      if (closeMin - openMin < 30) {
        return `يجب أن يكون وقت العمل 30 دقيقة على الأقل في يوم ${DAY_NAMES[d.dayOfWeek]}`;
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
      if (!res.ok) { setError(data.error || "حدث خطأ أثناء الحفظ"); return; }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("حدث خطأ في الاتصال");
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
          background: "#FAFBFD",
          border:     "1.5px solid #E2E8F0",
          boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
          >
            <CalendarDays size={16} style={{ color: "#FFFFFF" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
              <span style={{ color: "#1D4ED8" }}>{openCount}</span>
              {" "}أيام عمل ·{" "}
              <span style={{ color: "#94A3B8" }}>{7 - openCount}</span>
              {" "}أيام إجازة
            </p>
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
              التغييرات تؤثر فورًا على الحجوزات الجديدة
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            background: openCount > 0 ? "#F0FDF4" : "#FEF2F2",
            border:     `1px solid ${openCount > 0 ? "#BBF7D0" : "#FECACA"}`,
          }}
        >
          <div
            style={{
              width:        6,
              height:       6,
              borderRadius: "50%",
              background:   openCount > 0 ? "#16A34A" : "#EF4444",
              flexShrink:   0,
            }}
          />
          <span
            style={{
              fontSize:   11,
              fontWeight: 600,
              color:      openCount > 0 ? "#15803D" : "#B91C1C",
            }}
          >
            {openCount > 0 ? "جدولك نشط" : "لا أيام عمل"}
          </span>
        </div>
      </div>

      {/* ── Day rows ────────────────────────────────────────── */}
      <div
        style={{
          background:   "#FFFFFF",
          border:       "1.5px solid #E2E8F0",
          borderRadius: 20,
          overflow:     "hidden",
          boxShadow:    "0 1px 6px rgba(15,23,42,0.05)",
        }}
      >
        {/* Column header */}
        <div
          className="grid items-center px-5 py-2.5"
          style={{
            gridTemplateColumns: "48px 72px 1fr",
            gap:                 16,
            background:          "#FAFBFD",
            borderBottom:        "1px solid #F1F5F9",
          }}
        >
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>الحالة</span>
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>اليوم</span>
          <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>وقت العمل</span>
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
                gridTemplateColumns: "48px 72px 1fr",
                gap:                 16,
                paddingTop:          14,
                paddingBottom:       14,
                borderBottom:        isLast ? "none" : "1px solid #F8FAFC",
                background:          isOpen
                  ? "#FFFFFF"
                  : "#FAFBFD",
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
                  background:   isOpen ? "#0F172A" : "#D1D5DB",
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
                    background: "#FFFFFF",
                    boxShadow:  "0 1px 4px rgba(15,23,42,0.2)",
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
                  color:      isOpen ? "#0F172A" : "#94A3B8",
                  transition: "color 0.15s",
                }}
              >
                {DAY_NAMES[day.dayOfWeek]}
                {isWeekend && (
                  <span
                    className="me-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#F1F5F9", color: "#64748B" }}
                  >
                    إجازة
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
                  <span style={{ color: "#CBD5E1", fontSize: 14, fontWeight: 300 }}>—</span>
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
                        style={{ background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}
                        dir="rtl"
                      >
                        <Clock size={10} />
                        {h > 0 && `${h}س`}{m > 0 && ` ${m}د`}
                      </span>
                    );
                  })()}
                </div>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: "#F1F5F9", color: "#94A3B8", width: "fit-content" }}
                >
                  إجازة
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
          style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#FEE2E2" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "#EF4444" }} />
          </div>
          <p style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {success && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#DCFCE7" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "#16A34A" }} />
          </div>
          <p style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>
            تم حفظ أوقات العمل بنجاح
          </p>
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{
          background: "#FAFBFD",
          border:     "1.5px solid #E2E8F0",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "#94A3B8" }}>
          التعديلات تؤثر فوراً على الحجوزات الجديدة
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl font-black text-white transition-all duration-150 disabled:opacity-60"
          style={{
            padding:       "10px 22px",
            fontSize:      13,
            background:    "linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)",
            boxShadow:     "0 3px 12px rgba(29,78,216,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.filter    = "brightness(1.08)";
              el.style.boxShadow = "0 5px 18px rgba(29,78,216,0.38)";
              el.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.filter    = "";
            el.style.boxShadow = "0 3px 12px rgba(29,78,216,0.28)";
            el.style.transform = "";
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Check size={14} />
              حفظ أوقات العمل
            </>
          )}
        </button>
      </div>
    </div>
  );
}
