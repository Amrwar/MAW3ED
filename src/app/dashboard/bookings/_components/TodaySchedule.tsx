"use client";

import { Clock, Plus } from "lucide-react";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { clock } from "@/lib/fmt";

interface TodayScheduleProps {
  bookings:      DashboardBooking[];
  onSelect:      (b: DashboardBooking) => void;
  onNewBooking?: () => void;
}

const STATUS_DOT: Record<string, { border: string; bg: string }> = {
  CONFIRMED: { border: "var(--color-ok)", bg: "var(--color-ok-soft)" },
  PENDING:   { border: "var(--color-star)", bg: "var(--color-warn-soft)" },
  COMPLETED: { border: "var(--color-jade)", bg: "var(--color-jade-soft)" },
  NO_SHOW:   { border: "var(--color-subtle)", bg: "var(--color-surface-3)" },
};

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,var(--color-jade),var(--color-jade))",
  "linear-gradient(135deg,var(--color-jade),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-ok),var(--color-jade))",
  "linear-gradient(135deg,var(--color-warn),var(--color-star))",
  "linear-gradient(135deg,var(--color-info),var(--color-info))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
];
function avatarGrad(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

export default function TodaySchedule({ bookings, onSelect, onNewBooking }: TodayScheduleProps) {
  const { t, lang } = useLanguage();
  const bs     = t.dashboard.bookingStatus;
  const b2     = t.dashboard.bookings;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  if (bookings.length === 0) return null;

  const pending   = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-surface-3)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
            style={{ background: "var(--color-jade-tint)" }}
          >
            <Clock size={15} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-ink)] leading-none">
              {lang === "ar" ? "مواعيد اليوم" : "Today's Schedule"}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {pending > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-warn)]">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--color-star)" }} />
                  {pending} {bs.PENDING}
                </span>
              )}
              {confirmed > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-ok)]">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--color-ok)" }} />
                  {confirmed} {bs.CONFIRMED}
                </span>
              )}
            </div>
          </div>
          <span
            className="text-xs font-extrabold px-2.5 py-0.5 rounded-full"
            style={{ background: "var(--color-ink)", color: "var(--color-surface)" }}
          >
            {bookings.length}
          </span>
        </div>

        {onNewBooking && (
          <button
            onClick={onNewBooking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-[var(--radius-md)] transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={{
              background:  "var(--color-surface-2)",
              border:      "1px solid var(--color-line)",
              color:       "var(--color-muted)",
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
              style={{ borderTop: idx > 0 ? "1px solid var(--color-surface-2)" : "none" }}
            >
              {/* Time */}
              <div className="text-center shrink-0" style={{ minWidth: 52 }}>
                <p className="text-sm font-extrabold text-[var(--color-ink)]" dir="ltr">{clock(b.startTime)}</p>
                {b.endTime && (
                  <p className="text-[10px] text-[var(--color-subtle)] mt-0.5" dir="ltr">{clock(b.endTime)}</p>
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
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                  style={{ background: avatarGrad(b.customerName) }}
                >
                  {b.customerName[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink)] truncate leading-snug">
                    {b.customerName}
                  </p>
                  <p className="text-xs text-[var(--color-subtle)] truncate">{b.serviceName}</p>
                </div>
              </div>

              {/* Price */}
              <div className="shrink-0 text-end">
                <p className="text-sm font-bold text-[var(--color-ink)]">
                  {b.totalPrice.toLocaleString(locale)}
                  <span className="text-xs font-normal text-[var(--color-subtle)] ms-1">{b.currency}</span>
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
