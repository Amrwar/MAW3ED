"use client";

import { useState } from "react";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  PENDING:         { bg: "#FEF3C7", color: "#92400E" },
  CONFIRMED:       { bg: "#DCFCE7", color: "#15803D" },
  COMPLETED:       { bg: "#DBEAFE", color: "#1D4ED8" },
  CANCELLED:       { bg: "#FEE2E2", color: "#B91C1C" },
  NO_SHOW:         { bg: "#F1F5F9", color: "#475569" },
  PENDING_PAYMENT: { bg: "#FED7AA", color: "#9A3412" },
  FAILED_PAYMENT:  { bg: "#FEE2E2", color: "#B91C1C" },
};

const ACTION_STYLE: Record<string, { bg: string; color: string; hoverBg: string }> = {
  CONFIRMED: { bg: "#DCFCE7", color: "#15803D", hoverBg: "#BBF7D0" },
  COMPLETED: { bg: "#DBEAFE", color: "#1D4ED8", hoverBg: "#BFDBFE" },
  CANCELLED: { bg: "#FEE2E2", color: "#B91C1C", hoverBg: "#FECACA" },
  NO_SHOW:   { bg: "#F1F5F9", color: "#475569", hoverBg: "#E2E8F0" },
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
  const locale = lang === "ar" ? "ar-EG" : "en-US";

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
      className="rounded-2xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[#0F172A]">{bk.allBookings}</h3>
          {!loading && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#F1F5F9", color: "#64748B" }}
            >
              {total.toLocaleString(locale)}
            </span>
          )}
        </div>
        {loading && <Loader2 size={15} className="animate-spin" style={{ color: "#3B82F6" }} />}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 780 }}>
          <thead>
            <tr style={{ background: "#FAFBFD", borderBottom: "1px solid #F1F5F9" }}>
              {[bk.columns.customer, bk.columns.service, bk.columns.date, bk.columns.time, bk.columns.status, bk.columns.price, ""].map((h, i) => (
                <th
                  key={i}
                  className="text-start px-5 py-3 text-xs font-semibold"
                  style={{ color: "#94A3B8", letterSpacing: "0.02em" }}
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
                <tr key={i} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div
                        className="rounded-lg animate-pulse"
                        style={{ height: 14, background: "#F1F5F9", width: j === 0 ? 120 : j === 6 ? 60 : 80 }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-20 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: "#F8FAFC" }}
                  >
                    <span className="text-3xl">📋</span>
                  </div>
                  <p className="text-sm font-semibold text-[#475569]">{bk.noResults}</p>
                  <p className="text-xs text-[#94A3B8] mt-1">جرب تغيير خيارات التصفية</p>
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
                      borderBottom: "1px solid #F8FAFC",
                      background:   isSelected ? "rgba(59,130,246,0.04)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLTableRowElement).style.background = "#FAFBFD";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        isSelected ? "rgba(59,130,246,0.04)" : "transparent";
                    }}
                  >
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: avatarGrad(b.customerName) }}
                        >
                          {b.customerName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A] leading-snug">{b.customerName}</p>
                          <p className="text-xs text-[#94A3B8]" dir="ltr">{b.customerPhone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[#475569] max-w-[140px] truncate">{b.serviceName}</p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">{b.serviceDuration} {bk.minutes}</p>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[#475569] whitespace-nowrap">{formatDateAr(b.date)}</p>
                    </td>

                    {/* Time */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[#475569] whitespace-nowrap" dir="ltr">
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
                      <p className="text-sm font-bold text-[#0F172A] whitespace-nowrap">
                        {b.totalPrice.toLocaleString(locale)}{" "}
                        <span className="font-normal text-[#94A3B8] text-xs">{b.currency}</span>
                      </p>
                      {b.depositAmount !== null && (
                        <p className="text-xs text-orange-600 mt-0.5">
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
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 disabled:opacity-50 whitespace-nowrap"
                          style={{ background: actionStyle.bg, color: actionStyle.color }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = actionStyle.hoverBg;
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLButtonElement).style.background = actionStyle.bg;
                          }}
                        >
                          {isActionLoading && <Loader2 size={11} className="animate-spin" />}
                          {(ba as Record<string, string>)[primaryAction] ?? primaryAction}
                        </button>
                      ) : (
                        <span className="text-xs text-[#CBD5E1]">{bk.details}</span>
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
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderTop: "1px solid #F1F5F9" }}
        >
          <p className="text-xs text-[#94A3B8]">
            {bk.page} <span className="font-bold text-[#475569]">{page}</span>{" "}
            {bk.of}{" "}
            <span className="font-bold text-[#475569]">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1">
            {/* Prev */}
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ border: "1px solid #E2E8F0", color: "#475569", background: "#FFFFFF" }}
              onMouseEnter={(e) => {
                if (page > 1) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
              }}
            >
              <ChevronRight size={15} />
            </button>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-[#94A3B8]">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p as number)}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-50"
                    style={
                      p === page
                        ? {
                            background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                            color: "#FFFFFF",
                            border: "none",
                            boxShadow: "0 2px 8px rgba(59,130,246,0.3)",
                          }
                        : {
                            background: "#FFFFFF",
                            color: "#475569",
                            border: "1px solid #E2E8F0",
                          }
                    }
                  >
                    {p}
                  </button>
                )
              )}

            {/* Next */}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ border: "1px solid #E2E8F0", color: "#475569", background: "#FFFFFF" }}
              onMouseEnter={(e) => {
                if (page < totalPages) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF";
              }}
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
