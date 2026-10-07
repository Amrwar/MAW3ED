"use client";

import { useState } from "react";
import CollectBalance from "./CollectBalance";
import { Phone, Loader2, User, Calendar, Clock, CreditCard } from "lucide-react";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  ALLOWED_TRANSITIONS,
  formatDateAr,
} from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";
import Modal from "@/components/ui/Modal";
import Alert from "@/components/ui/Alert";

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
  const { t, lang } = useLanguage();
  const bd     = t.dashboard.bookingDetail;
  const ba     = t.dashboard.bookingActions;
  const bs     = t.dashboard.bookingStatus;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  const allowedNext  = ALLOWED_TRANSITIONS[booking.status] ?? [];
  const badge        = STATUS_BADGE[booking.status] ?? STATUS_BADGE.NO_SHOW;
  const statusLabel  = (bs as Record<string, string>)[booking.status] ?? booking.status;

  async function handleAction(newStatus: DashboardBookingStatus) {
    setLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await onStatusChange(booking.id, newStatus);
      const label = (ba as Record<string, string>)[newStatus] ?? newStatus;
      setActionSuccess(`${ba.updatedTo} "${label}"`);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : ba.error);
    } finally {
      setLoading(false);
    }
  }

  // The booking reference reads left-to-right even in Arabic.
  const reference = `#${booking.id.slice(-8).toUpperCase()}`;

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={bd.title}
      description={reference}
      footer={
        <div className="space-y-3">
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}

          {allowedNext.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-subtle)]">
                {bd.actions}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allowedNext.map((nextStatus) => {
                  const style = ACTION_STYLE[nextStatus] ?? { bg: "var(--color-surface-3)", color: "var(--color-muted)", hoverBg: "var(--color-line)" };
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => handleAction(nextStatus)}
                      disabled={loading}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {(ba as Record<string, string>)[nextStatus] ?? nextStatus}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className="text-center py-3 rounded-[var(--radius-md)]"
              style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs text-[var(--color-subtle)]">
                {lang === "ar" ? "الحجز في حالة نهائية — لا يمكن تغييرها" : "Booking is in a final state"}
              </p>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-5">

          {/* Customer card */}
          <div
            className="rounded-[var(--radius-lg)] p-4 flex items-center gap-4"
            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-extrabold text-white shrink-0"
              style={{ background: avatarGrad(booking.customerName) }}
            >
              {booking.customerName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--color-ink)] text-base leading-snug truncate">
                {booking.customerName}
              </p>
              <p className="text-sm text-[var(--color-subtle)] mt-0.5 flex items-center gap-1.5" dir="ltr">
                <Phone size={11} style={{ color: "var(--color-jade)" }} />
                {booking.customerPhone}
              </p>
            </div>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: badge.bg, color: badge.color }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Booking details */}
          <Section icon={<Calendar size={14} style={{ color: "var(--color-jade)" }} />} title={lang === "ar" ? "تفاصيل الموعد" : "Booking Details"}>
            <InfoRow label={bd.service}  value={booking.serviceName} />
            <InfoRow label={bd.duration} value={`${booking.serviceDuration} ${bd.minutes}`} />
            <InfoRow label={bd.date}     value={formatDateAr(booking.date)} />
            <InfoRow
              label={bd.time}
              value={booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime}
              ltr
            />
            {booking.staffName  && <InfoRow label={lang === "ar" ? "الحلاق"    : "Barber"}      value={booking.staffName}        />}
            {booking.tableName  && <InfoRow label={lang === "ar" ? "الطاولة"   : "Table"}       value={booking.tableName}        />}
            {booking.partySize  && <InfoRow label={lang === "ar" ? "الأشخاص"  : "Party size"}  value={String(booking.partySize)} />}
          </Section>

          {/* Payment */}
          <Section icon={<CreditCard size={14} style={{ color: "var(--color-jade)" }} />} title={lang === "ar" ? "الدفع" : "Payment"}>
            <InfoRow
              label={bd.price}
              value={`${booking.totalPrice.toLocaleString(locale)} ${booking.currency}`}
              bold
            />
            {booking.depositAmount !== null && (
              <InfoRow
                label={bd.deposit}
                value={`${booking.depositAmount?.toLocaleString(locale)} ${booking.currency}`}
              />
            )}

            {/* What has actually been collected, and how to collect the
                rest. Read from the ledger rather than from the booking,
                which only ever knew about the deposit. */}
            <div className="mt-3 border-t border-[var(--color-line)] pt-3">
              <CollectBalance bookingId={booking.id} />
            </div>
          </Section>

          {/* Notes */}
          {(booking.notes || booking.customerNotes) && (
            <Section icon={<User size={14} style={{ color: "var(--color-jade)" }} />} title={bd.notes}>
              {booking.customerNotes && (
                <p
                  className="text-sm text-[var(--color-muted)] leading-relaxed rounded-[var(--radius-md)] px-4 py-3"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
                >
                  {booking.customerNotes}
                </p>
              )}
              {booking.notes && (
                <p
                  className="text-sm text-[var(--color-muted)] leading-relaxed rounded-[var(--radius-md)] px-4 py-3"
                  style={{ background: "var(--color-surface)", border: "1px solid var(--color-line)" }}
                >
                  {booking.notes}
                </p>
              )}
            </Section>
          )}

          {/* Meta */}
          <Section icon={<Clock size={14} style={{ color: "var(--color-jade)" }} />} title={lang === "ar" ? "معلومات إضافية" : "Additional Info"}>
            <InfoRow
              label={lang === "ar" ? "تاريخ الحجز" : "Booked On"}
              value={new Date(booking.createdAt).toLocaleDateString(locale, {
                year: "numeric", month: "long", day: "numeric",
              })}
            />
          </Section>
      </div>
    </Modal>
  );
}

// ─── Sub-components ────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon:     React.ReactNode;
  title:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <p className="text-xs font-bold text-[var(--color-muted)]">{title}</p>
      </div>
      <div
        className="rounded-[var(--radius-lg)] p-4 space-y-2.5"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)" }}
      >
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
}: {
  label: string;
  value: string;
  ltr?:  boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-[var(--color-subtle)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="text-end"
        style={{
          color:      bold ? "var(--color-jade)" : "var(--color-ink)",
          fontWeight: bold ? 800 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
