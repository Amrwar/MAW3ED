"use client";

import { useState, useEffect } from "react";
import { X, Phone, Mail, Calendar, DollarSign, BookOpen, Loader2, Check, StickyNote } from "lucide-react";
import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
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

interface Props {
  customer: CustomerRow;
  onClose:  () => void;
  onNotesSaved: (id: string, notes: string | null) => void;
}

export default function CustomerDetailPanel({ customer, onClose, onNotesSaved }: Props) {
  const [detail,  setDetail]  = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes state
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

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center font-bold text-[var(--color-accent)]">
              {customer.name[0]}
            </div>
            <div>
              <h2 className="font-bold text-base text-[var(--color-text-primary)]">{customer.name}</h2>
              <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">{customer.phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--color-border)] border-b border-[var(--color-border)]">
            <StatCell icon={<BookOpen size={14} />} label="الحجوزات" value={customer.bookingCount.toLocaleString("ar-EG")} />
            <StatCell icon={<DollarSign size={14} />} label="الإنفاق" value={`${customer.totalSpend.toLocaleString("ar-EG")} ${customer.currency}`} />
            <StatCell
              icon={<Calendar size={14} />}
              label="آخر زيارة"
              value={customer.lastBookingDate ? formatDateAr(customer.lastBookingDate) : "—"}
            />
          </div>

          <div className="p-5 space-y-5">
            {/* Contact */}
            <Section title="بيانات التواصل">
              <InfoRow label="الاسم"   value={customer.name} />
              <InfoRow label="الهاتف"  value={customer.phone} ltr icon={<Phone size={12} />} />
              {customer.email && (
                <InfoRow label="البريد" value={customer.email} ltr icon={<Mail size={12} />} />
              )}
              <InfoRow
                label="عميل منذ"
                value={new Date(customer.createdAt).toLocaleDateString("ar-EG", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              />
            </Section>

            {/* Notes */}
            <Section title="ملاحظاتي عن العميل">
              <div className="space-y-2">
                <div className="relative">
                  <StickyNote size={13} className="absolute top-3 end-3 text-[var(--color-text-muted)] pointer-events-none" />
                  <textarea
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                    rows={3}
                    maxLength={1000}
                    placeholder="أضف ملاحظات خاصة عن هذا العميل..."
                    className="input w-full resize-none text-sm pe-8"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">{notes.length}/1000</span>
                  <div className="flex items-center gap-2">
                    {notesError && <p className="text-xs text-red-500">{notesError}</p>}
                    {notesSaved && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check size={12} /> تم الحفظ
                      </span>
                    )}
                    <button
                      onClick={saveNotes}
                      disabled={savingNotes}
                      className="btn btn-primary btn-sm gap-1.5 text-xs"
                    >
                      {savingNotes ? <Loader2 size={12} className="animate-spin" /> : null}
                      حفظ
                    </button>
                  </div>
                </div>
              </div>
            </Section>

            {/* Booking history */}
            <Section title={`سجل الحجوزات (${d ? d.bookings.length : "..."})`}>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-[var(--color-border)] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : d && d.bookings.length > 0 ? (
                <div className="space-y-2">
                  {d.bookings.map((b) => (
                    <div
                      key={b.id}
                      className="bg-[var(--color-surface-2)] rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {b.serviceName}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {formatDateAr(b.date)}
                          {" · "}
                          <span dir="ltr">
                            {b.startTime}{b.endTime ? ` – ${b.endTime}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={b.status} size="sm" />
                        <p className="text-xs font-semibold text-[var(--color-accent)]">
                          {b.totalPrice.toLocaleString("ar-EG")} {b.currency}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                  لا يوجد سجل حجوزات بعد
                </p>
              )}
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-4 px-3 gap-1 text-center">
      <span className="text-[var(--color-text-muted)]">{icon}</span>
      <p className="text-xs font-black text-[var(--color-text-primary)] leading-tight">{value}</p>
      <p className="text-[10px] text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-2.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, ltr = false, icon }: { label: string; value: string; ltr?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm py-1.5 border-b border-[var(--color-border)] last:border-0">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span
        dir={ltr ? "ltr" : undefined}
        className="font-medium text-[var(--color-text-primary)] flex items-center gap-1 text-end"
      >
        {icon}{value}
      </span>
    </div>
  );
}
