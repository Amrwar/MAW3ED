"use client";

import { useState } from "react";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  ACTION_LABELS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";

interface BookingsTableProps {
  bookings:        DashboardBooking[];
  loading:         boolean;
  selected:        string | null;
  onSelect:        (b: DashboardBooking) => void;
  onStatusChange?: (id: string, status: DashboardBookingStatus) => Promise<void>;
  page:            number;
  totalPages:      number;
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
  onPageChange,
}: BookingsTableProps) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function handleQuickAction(
    e: React.MouseEvent,
    booking: DashboardBooking,
    status: DashboardBookingStatus,
  ) {
    e.stopPropagation(); // don't open the detail panel
    if (!onStatusChange || actionLoadingId) return;
    setActionLoadingId(booking.id);
    try {
      await onStatusChange(booking.id, status);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="font-bold text-[var(--color-text-primary)]">جميع الحجوزات</h3>
        {loading && <Loader2 size={16} className="animate-spin text-[var(--color-brand)]" />}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              {["العميل", "الخدمة", "التاريخ", "الوقت", "الحالة", "السعر", ""].map((h) => (
                <th
                  key={h}
                  className="text-start px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && bookings.length === 0 ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-[var(--color-border)] rounded animate-pulse" />
                    </td>
                  ))}
                  <td className="px-4 py-4" />
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    لا توجد حجوزات تطابق البحث
                  </p>
                </td>
              </tr>
            ) : (
              bookings.map((b) => {
                const nextStatuses = ALLOWED_TRANSITIONS[b.status] ?? [];
                // Primary quick action: first allowed transition
                const primaryAction = nextStatuses[0] ?? null;
                const isActionLoading = actionLoadingId === b.id;

                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelect(b)}
                    className={`border-b border-[var(--color-border)] last:border-0 cursor-pointer transition-colors ${
                      selected === b.id
                        ? "bg-[var(--color-brand)]/5"
                        : "hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {b.customerName}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                        {b.customerPhone}
                      </p>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-[var(--color-text-secondary)]">{b.serviceName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {b.serviceDuration} دقيقة
                      </p>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {formatDateAr(b.date)}
                      </p>
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">
                        {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={b.status} />
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {b.totalPrice.toLocaleString("ar-EG")}{" "}
                        <span className="font-normal text-[var(--color-text-muted)]">
                          {b.currency}
                        </span>
                      </p>
                      {b.depositAmount !== null && (
                        <p className="text-xs text-orange-600 mt-0.5">
                          عربون: {b.depositAmount.toLocaleString("ar-EG")}
                        </p>
                      )}
                    </td>

                    {/* Quick action */}
                    <td className="px-4 py-3.5">
                      {primaryAction && onStatusChange ? (
                        <button
                          onClick={(e) => handleQuickAction(e, b, primaryAction)}
                          disabled={!!actionLoadingId}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                            primaryAction === "CONFIRMED"
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : primaryAction === "COMPLETED"
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : primaryAction === "CANCELLED"
                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {isActionLoading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : null}
                          {ACTION_LABELS[primaryAction]}
                        </button>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">تفاصيل</span>
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
        <div className="px-5 py-3.5 border-t border-[var(--color-border)] flex items-center justify-between">
          <p className="text-xs text-[var(--color-text-muted)]">
            صفحة {page} من {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-[var(--color-text-muted)]">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p as number)}
                    disabled={loading}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                      p === page
                        ? "bg-[var(--color-brand)] text-white"
                        : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
