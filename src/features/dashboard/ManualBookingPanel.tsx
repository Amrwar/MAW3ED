"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, CalendarDays, Clock, User, Phone } from "lucide-react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { clock } from "@/lib/fmt";

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
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes,         setNotes]         = useState("");

  const [slots,         setSlots]         = useState<Slot[]>([]);
  const [loadingSlots,  setLoadingSlots]  = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [created,       setCreated]       = useState<DashboardBooking | null>(null);

  // Reset when opened. During render rather than in an effect, so the
  // last booking's details never flash up before clearing.
  const [shownFor, setShownFor] = useState<{ open: boolean; services: ServiceOption[] }>({
    open: false,
    services,
  });
  if (shownFor.open !== open || shownFor.services !== services) {
    setShownFor({ open, services });
    if (open) {
      setServiceId(services[0]?.id ?? "");
      setDate(TODAY);
      setStartTime("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setNotes("");
      setSlots([]);
      setError("");
      setCreated(null);
    }
  }

  // A new service or day asks for the times again, with no time chosen.
  const slotsKey = open && serviceId && date ? `${serviceId}|${date}|${slug}` : null;
  const [slotsFor, setSlotsFor] = useState<string | null>(null);
  if (slotsKey !== slotsFor) {
    setSlotsFor(slotsKey);
    setStartTime("");
    if (slotsKey) {
      setLoadingSlots(true);
      setError("");
    } else {
      setSlots([]);
    }
  }

  // Fetch available slots when service + date change. A reply that
  // arrives after the choice has moved on is dropped.
  useEffect(() => {
    if (!slotsKey) return;
    let stale = false;
    fetch(`/api/public/${slug}/slots?serviceId=${serviceId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (!stale) setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch(() => {
        if (!stale) setSlots([]);
      })
      .finally(() => {
        if (!stale) setLoadingSlots(false);
      });
    return () => {
      stale = true;
    };
    // slotsKey carries serviceId, date and slug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey]);

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
          customerEmail: customerEmail.trim() || undefined,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title="حجز جديد"
      footer={
        created ? (
          <Button type="button" variant="primary" fullWidth onClick={onClose}>
            تم، إغلاق
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              إلغاء
            </Button>
            <Button
              type="submit"
              form="manual-booking-form"
              variant="primary"
              isLoading={saving}
              className="flex-1"
            >
              تأكيد الموعد
            </Button>
          </div>
        )
      }
    >
      {/* Success state */}
      {created ? (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-ok-soft)] flex items-center justify-center">
              <Check size={32} className="text-[var(--color-ok)]" />
            </div>
            <div>
              <p className="text-xl font-extrabold text-[var(--color-ink)]">تم إنشاء الموعد</p>
              <p className="text-sm text-[var(--color-muted)] mt-1">
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
                value={`${formatDate(created.date)} — ${clock(created.startTime)}`}
                ltr
              />
            </div>
        </div>
      ) : (
        <form id="manual-booking-form" onSubmit={handleSubmit} className="space-y-5">
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
                  <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-muted)]">
                    <Loader2 size={16} className="animate-spin" />
                    جاري تحميل المواعيد...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="py-4 text-sm text-[var(--color-muted)] bg-[var(--color-surface-2)] rounded-[var(--radius-md)] text-center">
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
                            ? "bg-[var(--color-jade)] text-white border-[var(--color-jade)] shadow-[var(--shadow-card)]"
                            : "border-[var(--color-line)] text-[var(--color-text-secondary)] hover:border-[var(--color-jade)] hover:text-[var(--color-jade)]"
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
                  <p className="text-xs text-[var(--color-muted)] mt-2 flex items-center gap-1">
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

              {/* Where this booking's confirmation and reminder emails
                  go. Kept on the booking, as an online booking's is. */}
              <div>
                <label htmlFor="manual-booking-email" className="form-label mb-1.5 block">
                  البريد الإلكتروني — اختياري
                </label>
                <input
                  id="manual-booking-email"
                  type="email"
                  autoComplete="off"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input w-full"
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-[var(--color-subtle)]">
                  هيوصل للعميل عليه تأكيد الحجز والتذكير.
                </p>
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

          {error && <Alert tone="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
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
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] shrink-0">
        {icon}
        {label}
      </span>
      <span
        className="text-xs font-medium text-[var(--color-ink)] text-end"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
