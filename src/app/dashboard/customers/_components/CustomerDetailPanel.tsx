"use client";

import { useState, useEffect } from "react";
import {
  X, Phone, Mail, Calendar, DollarSign,
  BookOpen, Loader2, Check, StickyNote, User,
} from "lucide-react";
import { type DashboardBookingStatus, formatDateAr } from "@/features/dashboard/bookings/types";
import type { CustomerRow } from "@/app/api/business/customers/route";

type CustomerBooking = {
  id:          string;
  serviceName: string;
  date:        string;
  startTime:   string;
  endTime:     string | null;
  status:      DashboardBookingStatus;
  totalPrice:  number;
  currency:    string;
};

type CustomerDetail = CustomerRow & { bookings: CustomerBooking[] };

// Deterministic avatar gradient
const GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
  "linear-gradient(135deg,#DC2626,#F87171)",
  "linear-gradient(135deg,#4338CA,#818CF8)",
];
function custGrad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

const BOOKING_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:         { bg: "#FEF3C7", color: "#92400E", label: "في الانتظار" },
  CONFIRMED:       { bg: "#DCFCE7", color: "#15803D", label: "مؤكد"        },
  COMPLETED:       { bg: "#DBEAFE", color: "#1D4ED8", label: "مكتمل"       },
  CANCELLED:       { bg: "#FEE2E2", color: "#B91C1C", label: "ملغي"        },
  NO_SHOW:         { bg: "#F1F5F9", color: "#475569", label: "لم يحضر"     },
  PENDING_PAYMENT: { bg: "#FED7AA", color: "#9A3412", label: "انتظار الدفع"},
  FAILED_PAYMENT:  { bg: "#FEE2E2", color: "#B91C1C", label: "فشل الدفع"  },
};

interface Props {
  customer:     CustomerRow;
  onClose:      () => void;
  onNotesSaved: (id: string, notes: string | null) => void;
}

export default function CustomerDetailPanel({ customer, onClose, onNotesSaved }: Props) {
  const [detail,       setDetail]       = useState<CustomerDetail | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [notes,        setNotes]        = useState(customer.notes ?? "");
  const [savingNotes,  setSavingNotes]  = useState(false);
  const [notesSaved,   setNotesSaved]   = useState(false);
  const [notesError,   setNotesError]   = useState("");

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    setNotes(customer.notes ?? "");
    setNotesSaved(false);
    setNotesError("");

    fetch(`/api/business/customers/${customer.id}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [customer.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveNotes() {
    setSavingNotes(true);
    setNotesSaved(false);
    setNotesError("");
    try {
      const res  = await fetch(`/api/business/customers/${customer.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { setNotesError(data.error ?? "حدث خطأ"); return; }
      setNotesSaved(true);
      onNotesSaved(customer.id, data.notes);
      setTimeout(() => setNotesSaved(false), 2500);
    } catch {
      setNotesError("حدث خطأ في الاتصال");
    } finally {
      setSavingNotes(false);
    }
  }

  const d = detail;

  const memberSince = new Date(customer.createdAt).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });

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
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-base font-black text-white shrink-0"
              style={{ background: custGrad(customer.name) }}
            >
              {customer.name[0]}
            </div>
            <div>
              <h2
                className="font-black text-[#0F172A] leading-snug"
                style={{ fontSize: 16, letterSpacing: "-0.01em" }}
              >
                {customer.name}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5 flex items-center gap-1" dir="ltr">
                <Phone size={10} style={{ color: "#3B82F6" }} />
                {customer.phone}
              </p>
            </div>
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

        {/* Stats strip */}
        <div
          className="grid grid-cols-3 shrink-0"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <StatCell
            icon={<BookOpen size={13} style={{ color: "#3B82F6" }} />}
            iconBg="#EFF6FF"
            label="الحجوزات"
            value={customer.bookingCount.toLocaleString("ar-EG")}
          />
          <StatCell
            icon={<DollarSign size={13} style={{ color: "#059669" }} />}
            iconBg="#F0FDF4"
            label="الإنفاق"
            value={`${customer.totalSpend.toLocaleString("ar-EG")} ${customer.currency}`}
            separator
          />
          <StatCell
            icon={<Calendar size={13} style={{ color: "#7C3AED" }} />}
            iconBg="#F5F3FF"
            label="آخر زيارة"
            value={customer.lastBookingDate ? formatDateAr(customer.lastBookingDate) : "—"}
            separator
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Contact info */}
          <PanelSection
            icon={<User size={13} style={{ color: "#3B82F6" }} />}
            title="بيانات التواصل"
          >
            <InfoRow label="الاسم"   value={customer.name} />
            <InfoRow label="الهاتف"  value={customer.phone} ltr icon={<Phone size={11} />} />
            {customer.email && (
              <InfoRow label="البريد" value={customer.email} ltr icon={<Mail size={11} />} />
            )}
            <InfoRow label="عميل منذ" value={memberSince} />
          </PanelSection>

          {/* Notes */}
          <PanelSection
            icon={<StickyNote size={13} style={{ color: "#3B82F6" }} />}
            title="ملاحظاتي عن العميل"
          >
            <div className="space-y-2.5">
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                rows={3}
                maxLength={1000}
                placeholder="أضف ملاحظات خاصة عن هذا العميل..."
                className="w-full rounded-xl border text-sm outline-none resize-none"
                style={{
                  borderColor:  "#E2E8F0",
                  background:   "#F8FAFC",
                  color:        "#0F172A",
                  paddingBlock:  10,
                  paddingInline: 14,
                  lineHeight:    1.6,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3B82F6";
                  e.currentTarget.style.background  = "#FFFFFF";
                  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.background  = "#F8FAFC";
                  e.currentTarget.style.boxShadow   = "none";
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#94A3B8]">{notes.length}/1000</span>
                <div className="flex items-center gap-2">
                  {notesError && (
                    <p className="text-[11px] text-[#EF4444]">{notesError}</p>
                  )}
                  {notesSaved && (
                    <span className="text-[11px] text-[#15803D] flex items-center gap-1">
                      <Check size={11} />
                      تم الحفظ
                    </span>
                  )}
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all duration-150 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                      boxShadow:  "0 2px 8px rgba(59,130,246,0.25)",
                    }}
                  >
                    {savingNotes ? <Loader2 size={12} className="animate-spin" /> : null}
                    حفظ
                  </button>
                </div>
              </div>
            </div>
          </PanelSection>

          {/* Booking history */}
          <PanelSection
            icon={<Calendar size={13} style={{ color: "#3B82F6" }} />}
            title={`سجل الحجوزات${d ? ` (${d.bookings.length})` : ""}`}
          >
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl animate-pulse"
                    style={{ background: "#F1F5F9" }}
                  />
                ))}
              </div>
            ) : d && d.bookings.length > 0 ? (
              <div className="space-y-2">
                {d.bookings.map((b) => {
                  const bStyle = BOOKING_STATUS_STYLE[b.status] ?? BOOKING_STATUS_STYLE.CANCELLED;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                      style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#0F172A] truncate leading-snug">
                          {b.serviceName}
                        </p>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          {formatDateAr(b.date)}
                          {" · "}
                          <span dir="ltr">
                            {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ background: bStyle.bg, color: bStyle.color }}
                        >
                          {bStyle.label}
                        </span>
                        <p className="text-xs font-bold text-[#1D4ED8]">
                          {b.totalPrice.toLocaleString("ar-EG")}{" "}
                          <span className="font-normal text-[#94A3B8]">{b.currency}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="py-8 text-center rounded-xl"
                style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
              >
                <p className="text-sm text-[#94A3B8]">لا يوجد سجل حجوزات بعد</p>
              </div>
            )}
          </PanelSection>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  icon, iconBg, label, value, separator,
}: {
  icon:       React.ReactNode;
  iconBg:     string;
  label:      string;
  value:      string;
  separator?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center py-4 px-3 gap-1.5 text-center"
      style={{ borderInlineStart: separator ? "1px solid #F1F5F9" : "none" }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-0.5"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-black text-[#0F172A] leading-tight"
        style={{ fontSize: 13 }}
      >
        {value}
      </p>
      <p className="text-[10px] text-[#94A3B8] font-medium">{label}</p>
    </div>
  );
}

function PanelSection({
  icon, title, children,
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
        className="rounded-2xl p-4 space-y-2"
        style={{ background: "#F8FAFC", border: "1px solid #F1F5F9" }}
      >
        {children}
      </div>
    </div>
  );
}

function InfoRow({
  label, value, ltr = false, icon,
}: {
  label:  string;
  value:  string;
  ltr?:   boolean;
  icon?:  React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 text-sm py-1.5"
      style={{ borderBottom: "1px solid #F1F5F9" }}
    >
      <span className="text-[#94A3B8] shrink-0 text-xs">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="font-semibold text-[#0F172A] flex items-center gap-1.5 text-end text-sm"
      >
        {icon && <span style={{ color: "#3B82F6" }}>{icon}</span>}
        {value}
      </span>
    </div>
  );
}
