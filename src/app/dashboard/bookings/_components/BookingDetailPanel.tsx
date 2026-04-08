"use client";

import { useState } from "react";
import { X, Phone, Loader2 } from "lucide-react";
import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  ACTION_VARIANTS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface BookingDetailPanelProps {
  booking:        DashboardBooking;
  onClose:        () => void;
  onStatusChange: (id: string, status: DashboardBookingStatus) => Promise<void>;
}

export default function BookingDetailPanel({
  booking,
  onClose,
  onStatusChange,
}: BookingDetailPanelProps) {
  const [loading,       setLoading]       = useState(false);
  const [actionError,   setActionError]   = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const { t, lang }   = useLanguage();
  const bd = t.dashboard.bookingDetail;
  const ba = t.dashboard.bookingActions;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const allowedNext = ALLOWED_TRANSITIONS[booking.status] ?? [];

  async function handleAction(newStatus: DashboardBookingStatus) {
    setLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onStatusChange(booking.id, newStatus);
      const label = (ba as Record<string, string>)[newStatus] ?? newStatus;
      setActionSuccess(`${ba.updatedTo} "${label}"`);
    } catch (e: unknown) {
      setActionError(
        e instanceof Error ? e.message : ba.error,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 className="font-bold text-base text-[var(--color-text-primary)]">
              {bd.title}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5" dir="ltr">
              #{booking.id.slice(-8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current status */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--color-text-muted)]">{bd.currentStatus}</p>
            <StatusBadge status={booking.status} />
          </div>

          {/* Customer info */}
          <Section title={bd.customer}>
            <InfoRow label={bd.customer} value={booking.customerName} />
            <InfoRow
              label={bd.phone}
              value={booking.customerPhone}
              ltr
              icon={<Phone size={12} />}
            />
            {booking.customerNotes && (
              <InfoRow label={bd.customerNotes} value={booking.customerNotes} />
            )}
          </Section>

          {/* Booking info */}
          <Section title={bd.title}>
            <InfoRow label={bd.service}  value={booking.serviceName} />
            <InfoRow label={bd.duration} value={`${booking.serviceDuration} ${bd.minutes}`} />
            <InfoRow label={bd.date}     value={formatDateAr(booking.date)} />
            <InfoRow
              label={bd.time}
              value={
                booking.endTime
                  ? `${booking.startTime} – ${booking.endTime}`
                  : booking.startTime
              }
              ltr
            />
            <InfoRow
              label={bd.price}
              value={`${booking.totalPrice.toLocaleString(locale)} ${booking.currency}`}
              bold
            />
            {booking.depositAmount !== null && (
              <InfoRow
                label={bd.deposit}
                value={`${booking.depositAmount.toLocaleString(locale)} ${booking.currency}`}
              />
            )}
          </Section>

          {/* Notes */}
          {booking.notes && (
            <Section title={bd.notes}>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-2)] rounded-xl px-4 py-3">
                {booking.notes}
              </p>
            </Section>
          )}

          {/* Booking meta */}
          <Section title={lang === "ar" ? "معلومات إضافية" : "Additional Info"}>
            <InfoRow
              label={lang === "ar" ? "تاريخ الحجز" : "Booked On"}
              value={new Date(booking.createdAt).toLocaleDateString(locale, {
                year: "numeric", month: "long", day: "numeric",
              })}
            />
          </Section>
        </div>

        {/* Actions footer */}
        <div className="border-t border-[var(--color-border)] p-5 space-y-3">
          {actionError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-2.5">
              {actionSuccess}
            </div>
          )}

          {allowedNext.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">
                {bd.actions}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allowedNext.map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() => handleAction(nextStatus)}
                    disabled={loading}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      ACTION_VARIANTS[nextStatus] ?? "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    {(ba as Record<string, string>)[nextStatus] ?? nextStatus}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {lang === "ar" ? "الحجز في حالة نهائية — لا يمكن تغييرها" : "Booking is in a final state — no further changes"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helper sub-components ────────────────────────────────

function Section({
  title,
  children,
}: {
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2.5">
        {title}
      </p>
      <div className="bg-[var(--color-surface-2)] rounded-xl p-4 space-y-2.5">
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  ltr  = false,
  bold = false,
  icon,
}: {
  label:  string;
  value:  string;
  ltr?:   boolean;
  bold?:  boolean;
  icon?:  React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className={`text-end flex items-center gap-1 ${
          bold
            ? "font-black text-[var(--color-accent)]"
            : "font-medium text-[var(--color-text-primary)]"
        }`}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
