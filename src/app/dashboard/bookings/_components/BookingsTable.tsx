"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";
import Pagination from "@/components/ui/Pagination";

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING:         { bg: "var(--color-warn-soft)", color: "var(--color-warn)" },
  CONFIRMED:       { bg: "var(--color-ok-soft)", color: "var(--color-ok)" },
  COMPLETED:       { bg: "var(--color-jade-soft)", color: "var(--color-jade)" },
  CANCELLED:       { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
  NO_SHOW:         { bg: "var(--color-surface-3)", color: "var(--color-muted)" },
  PENDING_PAYMENT: { bg: "var(--color-warn-line)", color: "var(--color-warn)" },
  FAILED_PAYMENT:  { bg: "var(--color-danger-soft)", color: "var(--color-danger)" },
};

const ACTION_STYLE: Record<string, { bg: string; color: string; hoverBg: string }> = {
  CONFIRMED: { bg: "var(--color-ok-soft)", color: "var(--color-ok)", hoverBg: "var(--color-ok-line)" },
  COMPLETED: { bg: "var(--color-jade-soft)", color: "var(--color-jade)", hoverBg: "var(--color-jade-line)" },
  CANCELLED: { bg: "var(--color-danger-soft)", color: "var(--color-danger)", hoverBg: "var(--color-danger-line)" },
  NO_SHOW:   { bg: "var(--color-surface-3)", color: "var(--color-muted)", hoverBg: "var(--color-line)" },
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

interface BookingsTableProps {
  bookings:        DashboardBooking[];
  loading:         boolean;
  selected:        string | null;
  onSelect:        (b: DashboardBooking) => void;
  onStatusChange?: (id: string, status: DashboardBookingStatus) => Promise<void>;
  page:            number;
  totalPages:      number;
  total:           number;
  onPageChange:    (page: number) => void;
}

export default function BookingsTable({
  bookings,
  loading,
  selected,
  onSelect,
  onStatusChange,
  page,
  totalPages,
  total,
  onPageChange,
}: BookingsTableProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { t, lang } = useLanguage();
  const bk     = t.dashboard.bookings;
  const ba     = t.dashboard.bookingActions;
  const bs     = t.dashboard.bookingStatus;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  async function handleQuickAction(
    e: React.MouseEvent,
    booking: DashboardBooking,
    status: DashboardBookingStatus,
  ) {
    e.stopPropagation();
    if (!onStatusChange || actionLoadingId) return;
    setActionLoadingId(booking.id);
    try {
      await onStatusChange(booking.id, status);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-surface-3)" }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[var(--color-ink)]">{bk.allBookings}</h3>
          {!loading && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
            >
              {total.toLocaleString(locale)}
            </span>
          )}
        </div>
        {loading && <Loader2 size={15} className="animate-spin" style={{ color: "var(--color-jade)" }} />}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 780 }}>
          <thead>
            <tr style={{ background: "var(--color-ground)", borderBottom: "1px solid var(--color-surface-3)" }}>
              {[bk.columns.customer, bk.columns.service, bk.columns.date, bk.columns.time, bk.columns.status, bk.columns.price, ""].map((h, i) => (
                <th
                  key={i}
                  className="text-start px-5 py-3 text-xs font-semibold"
                  style={{ color: "var(--color-subtle)", letterSpacing: "0.02em" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && bookings.length === 0 ? (
              // Skeleton rows
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-surface-2)" }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div
                        className="rounded-[var(--radius-md)] animate-pulse"
                        style={{ height: 14, background: "var(--color-surface-3)", width: j === 0 ? 120 : j === 6 ? 60 : 80 }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-20 text-center">
                  <div
                    className="w-14 h-14 rounded-[var(--radius-lg)] mx-auto mb-4 flex items-center justify-center"
                    style={{ background: "var(--color-surface-2)" }}
                  >
                    <span className="text-3xl">📋</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-muted)]">{bk.noResults}</p>
                  <p className="text-xs text-[var(--color-subtle)] mt-1">جرب تغيير خيارات التصفية</p>
                </td>
              </tr>
            ) : (
              bookings.map((b) => {
                const badge          = STATUS_BADGE[b.status] ?? STATUS_BADGE.NO_SHOW;
                const statusLabel    = (bs as Record<string, string>)[b.status] ?? b.status;
                const nextStatuses   = ALLOWED_TRANSITIONS[b.status] ?? [];
                const primaryAction  = nextStatuses[0] ?? null;
                const isActionLoading = actionLoadingId === b.id;
                const actionStyle    = primaryAction ? (ACTION_STYLE[primaryAction] ?? ACTION_STYLE.NO_SHOW) : null;
                const isSelected     = selected === b.id;

                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid var(--color-surface-2)",
                      background:   isSelected ? "rgba(14,127,94,0.04)" : "transparent",
                    }}
                  >
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                          style={{ background: avatarGrad(b.customerName) }}
                        >
                          {b.customerName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-ink)] leading-snug">{b.customerName}</p>
                          <p className="text-xs text-[var(--color-subtle)]" dir="ltr">{b.customerPhone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[var(--color-muted)] max-w-[140px] truncate">{b.serviceName}</p>
                      <p className="text-xs text-[var(--color-subtle)] mt-0.5">{b.serviceDuration} {bk.minutes}</p>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[var(--color-muted)] whitespace-nowrap">{formatDateAr(b.date)}</p>
                    </td>

                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[var(--color-muted)] whitespace-nowrap" dir="ltr">
                        {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {statusLabel}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-[var(--color-ink)] whitespace-nowrap">
                        {b.totalPrice.toLocaleString(locale)}{" "}
                        <span className="font-normal text-[var(--color-subtle)] text-xs">{b.currency}</span>
                      </p>
                      {b.depositAmount !== null && (
                        <p className="text-xs text-[var(--color-warn)] mt-0.5">
                          {bk.deposit} {b.depositAmount?.toLocaleString(locale)}
                        </p>
                      )}
                    </td>

                    {/* Quick action */}
                    <td className="px-5 py-3.5">
                      {primaryAction && onStatusChange && actionStyle ? (
                        <button
                          onClick={(e) => handleQuickAction(e, b, primaryAction)}
                          disabled={!!actionLoadingId}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[var(--radius-md)] transition-all duration-150 disabled:opacity-50 whitespace-nowrap"
                          style={{ background: actionStyle.bg, color: actionStyle.color }}
                        >
                          {isActionLoading && <Loader2 size={11} className="animate-spin" />}
                          {(ba as Record<string, string>)[primaryAction] ?? primaryAction}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--color-line-2)]">{bk.details}</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--color-line)] px-6 py-4">
          <p className="m-0 text-xs text-[var(--color-subtle)]">
            {bk.page} <span className="num font-bold text-[var(--color-muted)]">{page}</span>{" "}
            {bk.of} <span className="num font-bold text-[var(--color-muted)]">{totalPages}</span>
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
