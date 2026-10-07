"use client";

import { useState, useEffect } from "react";
import {
  Phone, Mail, Calendar, DollarSign,
  BookOpen, Loader2, Check, StickyNote, User,
} from "lucide-react";
import { type DashboardBookingStatus, formatDateAr } from "@/features/dashboard/bookings/types";
import type { CustomerRow } from "@/app/api/business/customers/route";
import Modal from "@/components/ui/Modal";

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

const BOOKING_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:         { bg: "var(--color-warn-soft)", color: "var(--color-warn)", label: "في الانتظار" },
  CONFIRMED:       { bg: "var(--color-ok-soft)", color: "var(--color-ok)", label: "مؤكد"        },
  COMPLETED:       { bg: "var(--color-jade-soft)", color: "var(--color-jade)", label: "مكتمل"       },
  CANCELLED:       { bg: "var(--color-danger-soft)", color: "var(--color-danger)", label: "ملغي"        },
  NO_SHOW:         { bg: "var(--color-surface-3)", color: "var(--color-muted)", label: "لم يحضر"     },
  PENDING_PAYMENT: { bg: "var(--color-warn-line)", color: "var(--color-warn)", label: "انتظار الدفع"},
  FAILED_PAYMENT:  { bg: "var(--color-danger-soft)", color: "var(--color-danger)", label: "فشل الدفع"  },
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

  const memberSince = new Date(customer.createdAt).toLocaleDateString("ar-EG-u-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <Modal
      open
      onClose={onClose}
      variant="sheet"
      title={customer.name}
      description={customer.phone}
    >
        {/* Stats strip */}
        <div
          className="grid grid-cols-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-surface-3)" }}
        >
          <StatCell
            icon={<BookOpen size={13} style={{ color: "var(--color-jade)" }} />}
            iconBg="var(--color-jade-tint)"
            label="الحجوزات"
            value={customer.bookingCount.toLocaleString("ar-EG-u-nu-latn")}
          />
          <StatCell
            icon={<DollarSign size={13} style={{ color: "var(--color-ok)" }} />}
            iconBg="var(--color-ok-soft)"
            label="الإنفاق"
            value={`${customer.totalSpend.toLocaleString("ar-EG-u-nu-latn")} ${customer.currency}`}
            separator
          />
          <StatCell
            icon={<Calendar size={13} style={{ color: "var(--color-jade)" }} />}
            iconBg="var(--color-jade-tint)"
            label="آخر زيارة"
            value={customer.lastBookingDate ? formatDateAr(customer.lastBookingDate) : "—"}
            separator
          />
        </div>

      {/* Body */}
      <div className="space-y-5 pt-5">

          {/* Contact info */}
          <PanelSection
            icon={<User size={13} style={{ color: "var(--color-jade)" }} />}
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
            icon={<StickyNote size={13} style={{ color: "var(--color-jade)" }} />}
            title="ملاحظاتي عن العميل"
          >
            <div className="space-y-2.5">
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                rows={3}
                maxLength={1000}
                placeholder="أضف ملاحظات خاصة عن هذا العميل..."
                className="w-full rounded-[var(--radius-md)] border text-sm outline-none resize-none"
                style={{
                  borderColor:  "var(--color-line)",
                  background:   "var(--color-surface-2)",
                  color:        "var(--color-ink)",
                  paddingBlock:  10,
                  paddingInline: 14,
                  lineHeight:    1.6,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-jade)";
                  e.currentTarget.style.background  = "var(--color-surface)";
                  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(14,127,94,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-line)";
                  e.currentTarget.style.background  = "var(--color-surface-2)";
                  e.currentTarget.style.boxShadow   = "none";
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--color-subtle)]">{notes.length}/1000</span>
                <div className="flex items-center gap-2">
                  {notesError && (
                    <p className="text-[11px] text-[var(--color-danger)]">{notesError}</p>
                  )}
                  {notesSaved && (
                    <span className="text-[11px] text-[var(--color-ok)] flex items-center gap-1">
                      <Check size={11} />
                      تم الحفظ
                    </span>
                  )}
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-[var(--radius-md)] text-white transition-all duration-150 disabled:opacity-60"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 2px 8px rgba(14,127,94,0.25)",
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
            icon={<Calendar size={13} style={{ color: "var(--color-jade)" }} />}
            title={`سجل الحجوزات${d ? ` (${d.bookings.length})` : ""}`}
          >
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-[var(--radius-md)] animate-pulse"
                    style={{ background: "var(--color-surface-3)" }}
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
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3"
                      style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[var(--color-ink)] truncate leading-snug">
                          {b.serviceName}
                        </p>
                        <p className="text-xs text-[var(--color-subtle)] mt-0.5">
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
                        <p className="text-xs font-bold text-[var(--color-jade)]">
                          {b.totalPrice.toLocaleString("ar-EG-u-nu-latn")}{" "}
                          <span className="font-normal text-[var(--color-subtle)]">{b.currency}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="py-8 text-center rounded-[var(--radius-md)]"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)" }}
              >
                <p className="text-sm text-[var(--color-subtle)]">لا يوجد سجل حجوزات بعد</p>
              </div>
            )}
          </PanelSection>
      </div>
    </Modal>
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
      style={{ borderInlineStart: separator ? "1px solid var(--color-surface-3)" : "none" }}
    >
      <div
        className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center mb-0.5"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-extrabold text-[var(--color-ink)] leading-tight text-[0.8125rem]"
        >
        {value}
      </p>
      <p className="text-[10px] text-[var(--color-subtle)] font-medium">{label}</p>
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
        <p className="text-xs font-bold text-[var(--color-muted)] uppercase tracking-wide">{title}</p>
      </div>
      <div
        className="rounded-[var(--radius-lg)] p-4 space-y-2"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-surface-3)" }}
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
      style={{ borderBottom: "1px solid var(--color-surface-3)" }}
    >
      <span className="text-[var(--color-subtle)] shrink-0 text-xs">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5 text-end text-sm"
      >
        {icon && <span style={{ color: "var(--color-jade)" }}>{icon}</span>}
        {value}
      </span>
    </div>
  );
}
