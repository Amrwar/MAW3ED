"use client";

import { useState } from "react";
import { X, Phone, Loader2, User, Calendar, Clock, CreditCard } from "lucide-react";
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
  const locale = lang === "ar" ? "ar-EG" : "en-US";

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white flex flex-col"
        style={{ boxShadow: "-8px 0 40px rgba(15,23,42,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div>
            <h2 className="font-black text-[#0F172A]" style={{ fontSize: 16 }}>
              {bd.title}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5 font-mono" dir="ltr">
              #{booking.id.slice(-8).toUpperCase()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Customer card */}
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black text-white shrink-0"
              style={{ background: avatarGrad(booking.customerName) }}
            >
              {booking.customerName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0F172A] text-base leading-snug truncate">
                {booking.customerName}
              </p>
              <p className="text-sm text-[#94A3B8] mt-0.5 flex items-center gap-1.5" dir="ltr">
                <Phone size={11} style={{ color: "#3B82F6" }} />
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
          <Section icon={<Calendar size={14} style={{ color: "#3B82F6" }} />} title={lang === "ar" ? "تفاصيل الموعد" : "Booking Details"}>
            <InfoRow label={bd.service}  value={booking.serviceName} />
            <InfoRow label={bd.duration} value={`${booking.serviceDuration} ${bd.minutes}`} />
            <InfoRow label={bd.date}     value={formatDateAr(booking.date)} />
            <InfoRow
              label={bd.time}
              value={booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime}
              ltr
            />
          </Section>

          {/* Payment */}
          <Section icon={<CreditCard size={14} style={{ color: "#3B82F6" }} />} title={lang === "ar" ? "الدفع" : "Payment"}>
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
          </Section>

          {/* Notes */}
          {(booking.notes || booking.customerNotes) && (
            <Section icon={<User size={14} style={{ color: "#3B82F6" }} />} title={bd.notes}>
              {booking.customerNotes && (
                <p
                  className="text-sm text-[#475569] leading-relaxed rounded-xl px-4 py-3"
                  style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}
                >
                  {booking.customerNotes}
                </p>
              )}
              {booking.notes && (
                <p
                  className="text-sm text-[#475569] leading-relaxed rounded-xl px-4 py-3"
                  style={{ background: "#FFFFFF", border: "1px solid #E2E8F0" }}
                >
                  {booking.notes}
                </p>
              )}
            </Section>
          )}

          {/* Meta */}
          <Section icon={<Clock size={14} style={{ color: "#3B82F6" }} />} title={lang === "ar" ? "معلومات إضافية" : "Additional Info"}>
            <InfoRow
              label={lang === "ar" ? "تاريخ الحجز" : "Booked On"}
              value={new Date(booking.createdAt).toLocaleDateString(locale, {
                year: "numeric", month: "long", day: "numeric",
              })}
            />
          </Section>
        </div>

        {/* Footer actions */}
        <div
          className="p-5 space-y-3"
          style={{ borderTop: "1px solid #F1F5F9" }}
        >
          {actionError && (
            <div
              className="text-sm rounded-xl px-4 py-2.5"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}
            >
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div
              className="text-sm rounded-xl px-4 py-2.5"
              style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#15803D" }}
            >
              {actionSuccess}
            </div>
          )}

          {allowedNext.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">
                {bd.actions}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allowedNext.map((nextStatus) => {
                  const style = ACTION_STYLE[nextStatus] ?? { bg: "#F1F5F9", color: "#475569", hoverBg: "#E2E8F0" };
                  return (
                    <button
                      key={nextStatus}
                      onClick={() => handleAction(nextStatus)}
                      disabled={loading}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: style.bg, color: style.color }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = style.hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = style.bg;
                      }}
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
              className="text-center py-3 rounded-xl"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <p className="text-xs text-[#94A3B8]">
                {lang === "ar" ? "الحجز في حالة نهائية — لا يمكن تغييرها" : "Booking is in a final state"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
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
        <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide">{title}</p>
      </div>
      <div
        className="rounded-2xl p-4 space-y-2.5"
        style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
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
      <span className="text-[#94A3B8] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="text-end"
        style={{
          color:      bold ? "#1D4ED8" : "#0F172A",
          fontWeight: bold ? 800 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
