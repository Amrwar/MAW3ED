"use client";

import { Clock, Plus } from "lucide-react";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface TodayScheduleProps {
  bookings:      DashboardBooking[];
  onSelect:      (b: DashboardBooking) => void;
  onNewBooking?: () => void;
}

const STATUS_DOT: Record<string, { border: string; bg: string }> = {
  CONFIRMED: { border: "#22C55E", bg: "#DCFCE7" },
  PENDING:   { border: "#F59E0B", bg: "#FEF3C7" },
  COMPLETED: { border: "#3B82F6", bg: "#DBEAFE" },
  NO_SHOW:   { border: "#94A3B8", bg: "#F1F5F9" },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
];
function avatarGrad(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

export default function TodaySchedule({ bookings, onSelect, onNewBooking }: TodayScheduleProps) {
  const { t, lang } = useLanguage();
  const bs     = t.dashboard.bookingStatus;
  const b2     = t.dashboard.bookings;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  if (bookings.length === 0) return null;

  const pending   = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <div
      className="rounded-2xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#EFF6FF" }}
          >
            <Clock size={15} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] leading-none">
              {lang === "ar" ? "مواعيد اليوم" : "Today's Schedule"}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {pending > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#92400E]">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#F59E0B" }} />
                  {pending} {bs.PENDING}
                </span>
              )}
              {confirmed > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#15803D]">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#22C55E" }} />
                  {confirmed} {bs.CONFIRMED}
                </span>
              )}
            </div>
          </div>
          <span
            className="text-xs font-black px-2.5 py-0.5 rounded-full"
            style={{ background: "#0F172A", color: "#FFFFFF" }}
          >
            {bookings.length}
          </span>
        </div>

        {onNewBooking && (
          <button
            onClick={onNewBooking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-150"
            style={{
              background:  "#F8FAFC",
              border:      "1px solid #E2E8F0",
              color:       "#475569",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#BFDBFE";
              el.style.color       = "#1D4ED8";
              el.style.background  = "#EFF6FF";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = "#E2E8F0";
              el.style.color       = "#475569";
              el.style.background  = "#F8FAFC";
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            {b2.newBtn}
          </button>
        )}
      </div>

      {/* Timeline list */}
      <div>
        {bookings.map((b, idx) => {
          const dot = STATUS_DOT[b.status] ?? STATUS_DOT.NO_SHOW;
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="w-full text-start flex items-center gap-4 px-5 py-3.5 transition-colors"
              style={{ borderTop: idx > 0 ? "1px solid #F8FAFC" : "none" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FAFBFD";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              {/* Time */}
              <div className="text-center shrink-0" style={{ minWidth: 52 }}>
                <p className="text-sm font-black text-[#0F172A]" dir="ltr">{b.startTime}</p>
                {b.endTime && (
                  <p className="text-[10px] text-[#94A3B8] mt-0.5" dir="ltr">{b.endTime}</p>
                )}
              </div>

              {/* Status dot */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ border: `2px solid ${dot.border}`, background: dot.bg }}
              />

              {/* Avatar + info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{ background: avatarGrad(b.customerName) }}
                >
                  {b.customerName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate leading-snug">
                    {b.customerName}
                  </p>
                  <p className="text-xs text-[#94A3B8] truncate">{b.serviceName}</p>
                </div>
              </div>

              {/* Price */}
              <div className="shrink-0 text-end">
                <p className="text-sm font-bold text-[#0F172A]">
                  {b.totalPrice.toLocaleString(locale)}
                  <span className="text-xs font-normal text-[#94A3B8] ms-1">{b.currency}</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
