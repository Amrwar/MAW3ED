"use client";

import { useState } from "react";
import { X, Phone, Loader2 } from "lucide-react";
import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  ACTION_LABELS,
  ACTION_VARIANTS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";

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
  const [loading,      setLoading]      = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [actionSuccess,setActionSuccess]= useState<string | null>(null);

  const allowedNext = ALLOWED_TRANSITIONS[booking.status] ?? [];

  async function handleAction(newStatus: DashboardBookingStatus) {
    setLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onStatusChange(booking.id, newStatus);
      setActionSuccess(
        `\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629 \u0625\u0644\u0649 "${ACTION_LABELS[newStatus]}"`,
      );
    } catch (e: unknown) {
      setActionError(
        e instanceof Error
          ? e.message
          : "\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u0627\u0644\u062a\u062d\u062f\u064a\u062b",
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
              \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062d\u062c\u0632
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
            <p className="text-sm text-[var(--color-text-muted)]">
              \u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629
            </p>
            <StatusBadge status={booking.status} />
          </div>

          {/* Customer info */}
          <Section title="\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0639\u0645\u064a\u0644">
            <InfoRow
              label="\u0627\u0644\u0627\u0633\u0645"
              value={booking.customerName}
            />
            <InfoRow
              label="\u0627\u0644\u0647\u0627\u062a\u0641"
              value={booking.customerPhone}
              ltr
              icon={<Phone size={12} />}
            />
            {booking.customerNotes && (
              <InfoRow
                label="\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0639\u0645\u064a\u0644"
                value={booking.customerNotes}
              />
            )}
          </Section>

          {/* Booking info */}
          <Section title="\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u062d\u062c\u0632">
            <InfoRow label="\u0627\u0644\u062e\u062f\u0645\u0629" value={booking.serviceName} />
            <InfoRow
              label="\u0627\u0644\u0645\u062f\u0629"
              value={`${booking.serviceDuration} \u062f\u0642\u064a\u0642\u0629`}
            />
            <InfoRow label="\u0627\u0644\u062a\u0627\u0631\u064a\u062e" value={formatDateAr(booking.date)} />
            <InfoRow
              label="\u0627\u0644\u0648\u0642\u062a"
              value={
                booking.endTime
                  ? `${booking.startTime} \u2013 ${booking.endTime}`
                  : booking.startTime
              }
              ltr
            />
            <InfoRow
              label="\u0627\u0644\u0633\u0639\u0631"
              value={`${booking.totalPrice.toLocaleString("ar-EG")} ${booking.currency}`}
              bold
            />
          </Section>

          {/* Notes */}
          {booking.notes && (
            <Section title="\u0645\u0644\u0627\u062d\u0638\u0627\u062a \u0627\u0644\u0639\u0645\u064a\u0644">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-2)] rounded-xl px-4 py-3">
                {booking.notes}
              </p>
            </Section>
          )}

          {/* Booking meta */}
          <Section title="\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629">
            <InfoRow
              label="\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062d\u062c\u0632"
              value={new Date(booking.createdAt).toLocaleDateString("ar-EG", {
                year: "numeric", month: "long", day: "numeric",
              })}
            />
          </Section>
        </div>

        {/* Actions footer */}
        <div className="border-t border-[var(--color-border)] p-5 space-y-3">
          {/* Feedback messages */}
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

          {/* Action buttons */}
          {allowedNext.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">
                \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629
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
                    ) : (
                      ACTION_LABELS[nextStatus]
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                \u0627\u0644\u062d\u062c\u0632 \u0641\u064a \u062d\u0627\u0644\u0629 \u0646\u0647\u0627\u0626\u064a\u0629 \u2014 \u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u063a\u064a\u064a\u0631\u0647\u0627
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
  title: string;
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
  label: string;
  value: string;
  ltr?:  boolean;
  bold?: boolean;
  icon?: React.ReactNode;
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
