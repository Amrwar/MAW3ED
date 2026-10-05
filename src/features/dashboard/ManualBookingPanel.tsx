"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Check, CalendarDays, Clock, User, Phone } from "lucide-react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";

export type ServiceOption = {
  id:       string;
  nameAr:   string;
  duration: number;
  price:    number;
  currency: string;
};

type Props = {
  open:      boolean;
  onClose:   () => void;
  slug:      string;
  services:  ServiceOption[];
  onCreated: (booking: DashboardBooking) => void;
};

type Slot = string; // "HH:MM"

const TODAY = new Date().toISOString().split("T")[0];
const MAX_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

export default function ManualBookingPanel({ open, onClose, slug, services, onCreated }: Props) {
  const [serviceId,     setServiceId]     = useState(services[0]?.id ?? "");
  const [date,          setDate]          = useState(TODAY);
  const [startTime,     setStartTime]     = useState("");
  const [customerName,  setCustomerName]  = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes,         setNotes]         = useState("");

  const [slots,         setSlots]         = useState<Slot[]>([]);
  const [loadingSlots,  setLoadingSlots]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [created,       setCreated]       = useState<DashboardBooking | null>(null);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setServiceId(services[0]?.id ?? "");
    setDate(TODAY);
    setStartTime("");
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setSlots([]);
    setError("");
    setCreated(null);
  }, [open, services]);

  // Fetch available slots when service + date change
  const fetchSlots = useCallback(async () => {
    if (!serviceId || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    setStartTime("");
    setError("");
    try {
      const res  = await fetch(
        `/api/public/${slug}/slots?serviceId=${serviceId}&date=${date}`
      );
      const data = await res.json();
      setSlots(Array.isArray(data.slots) ? data.slots : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [serviceId, date, slug]);

  useEffect(() => {
    if (open) fetchSlots();
  }, [open, fetchSlots]);

  const selectedService = services.find((s) => s.id === serviceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!serviceId)       { setError("اختر الخدمة");              return; }
    if (!date)            { setError("اختر التاريخ");             return; }
    if (!startTime)       { setError("اختر الوقت المناسب");       return; }
    if (!customerName.trim()) { setError("أدخل اسم العميل");     return; }
    if (!customerPhone.trim()) { setError("أدخل رقم هاتف العميل"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/business/bookings", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          date,
          startTime,
          customerName:  customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes:         notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "حدث خطأ أثناء إنشاء الحجز");
        return;
      }

      setCreated(data as DashboardBooking);
      onCreated(data as DashboardBooking);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={!saving ? onClose : undefined} />

      {/* Panel */}
      <div className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[var(--color-brand)]" />
            <h2 className="font-bold text-[var(--color-text-primary)]">موعد جديد</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success state */}
        {created ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[var(--color-ok-soft)] flex items-center justify-center">
              <Check size={32} className="text-[var(--color-ok)]" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-[var(--color-text-primary)]">تم إنشاء الموعد</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                تم تأكيد الموعد لـ {created.customerName}
              </p>
            </div>
            <div className="w-full bg-[var(--color-surface-2)] rounded-[var(--radius-lg)] p-4 text-sm space-y-2.5 text-start">
              <Row icon={<User size={14} />}  label="العميل"   value={created.customerName} />
              <Row icon={<Phone size={14} />} label="الهاتف"   value={created.customerPhone} ltr />
              <Row icon={<Clock size={14} />} label="الخدمة"   value={created.serviceName} />
              <Row
                icon={<CalendarDays size={14} />}
                label="الموعد"
                value={`${formatDate(created.date)} — ${created.startTime}`}
                ltr
              />
            </div>
            <button onClick={onClose} className="btn btn-primary w-full">
              تم، إغلاق
            </button>
          </div>
        ) : (
          <>
            {/* Form body */}
            <form
              id="manual-booking-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {/* Service */}
              <div>
                <label className="form-label mb-1.5 block">
                  الخدمة <span className="text-[var(--color-danger)]">*</span>
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="input w-full"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr} — {s.duration} دقيقة — {s.price} {s.currency}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="form-label mb-1.5 block">
                  التاريخ <span className="text-[var(--color-danger)]">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  min={TODAY}
                  max={MAX_DATE}
                  onChange={(e) => setDate(e.target.value)}
                  className="input w-full"
                  dir="ltr"
                />
              </div>

              {/* Time slots */}
              <div>
                <label className="form-label mb-1.5 block">
                  الوقت <span className="text-[var(--color-danger)]">*</span>
                </label>

                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-text-muted)]">
                    <Loader2 size={16} className="animate-spin" />
                    جاري تحميل المواعيد...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-[var(--radius-md)] text-center">
                    لا توجد مواعيد متاحة في هذا اليوم
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setStartTime(slot)}
                        className={`py-2 text-sm rounded-[var(--radius-md)] border transition-all font-medium ${
                          startTime === slot
                            ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-sm"
                            : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                        }`}
                        dir="ltr"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}

                {/* Show end time hint */}
                {startTime && selectedService && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                    <Clock size={11} />
                    المدة {selectedService.duration} دقيقة · ينتهي الساعة{" "}
                    {calcEndTime(startTime, selectedService.duration)}
                  </p>
                )}
              </div>

              {/* Customer name + phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label mb-1.5 block">
                    الاسم <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اسم العميل"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="form-label mb-1.5 block">
                    الهاتف <span className="text-[var(--color-danger)]">*</span>
                  </label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="input w-full"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="form-label mb-1.5 block">ملاحظات — اختياري</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="أي ملاحظات خاصة بالموعد..."
                  className="input w-full resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 rounded-[var(--radius-md)]">{error}</p>
              )}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-3 shrink-0">
              <button type="button" onClick={onClose} className="btn btn-outline flex-1">
                إلغاء
              </button>
              <button
                type="submit"
                form="manual-booking-form"
                disabled={saving}
                className="btn btn-primary flex-1 gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "جاري الحفظ..." : "تأكيد الموعد"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function calcEndTime(startTime: string, duration: number) {
  const [h, m] = startTime.split(":").map(Number);
  const end    = h * 60 + m + duration;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ar-EG-u-nu-latn", {
    weekday: "short",
    day:     "numeric",
    month:   "long",
  });
}

function Row({
  icon,
  label,
  value,
  ltr,
}: {
  icon:   React.ReactNode;
  label:  string;
  value:  string;
  ltr?:   boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] shrink-0">
        {icon}
        {label}
      </span>
      <span
        className="text-xs font-medium text-[var(--color-text-primary)] text-end"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
