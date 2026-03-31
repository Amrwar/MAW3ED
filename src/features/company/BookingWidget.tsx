"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, Calendar, Clock, User, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Service } from "@/types/service";
import { formatPrice, formatDuration } from "@/lib/utils";

interface BookingWidgetProps {
  services: Service[];
  businessName: string;
}

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "13:00", "14:00", "14:30", "15:00", "16:00",
];

const days = [
  { date: "الأحد", num: "١", available: true },
  { date: "الاثنين", num: "٢", available: true },
  { date: "الثلاثاء", num: "٣", available: true },
  { date: "الأربعاء", num: "٤", available: false },
  { date: "الخميس", num: "٥", available: true },
  { date: "الجمعة", num: "٦", available: false },
  { date: "السبت", num: "٧", available: true },
];

type Step = 1 | 2 | 3 | 4;

export default function BookingWidget({ services, businessName }: BookingWidgetProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const steps = [
    { num: 1, label: "الخدمة" },
    { num: 2, label: "الموعد" },
    { num: 3, label: "بياناتك" },
    { num: 4, label: "تأكيد" },
  ];

  return (
    <div className="card p-0 overflow-hidden sticky top-24">
      {/* Header */}
      <div className="bg-[var(--color-brand)] px-5 py-4">
        <h3 className="text-white font-bold text-base">احجز موعدك</h3>
        <p className="text-white/60 text-xs mt-0.5">{businessName}</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                step >= s.num
                  ? "bg-[var(--color-brand)] text-white"
                  : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}
            >
              {step > s.num ? <CheckCircle size={12} /> : s.num}
            </div>
            <span
              className={`text-[10px] font-medium ms-1 ${
                step >= s.num
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  step > s.num ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="p-5">
        {/* Step 1: Service selection */}
        {step === 1 && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              اختار الخدمة
            </p>
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => setSelectedService(service)}
                className={`w-full text-start p-3.5 rounded-xl border transition-all ${
                  selectedService?.id === service.id
                    ? "border-[var(--color-brand)] bg-[var(--color-surface-2)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-brand)]/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {service.nameAr}
                    </p>
                    {service.duration > 0 && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {formatDuration(service.duration)}
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-black text-[var(--color-accent)]">
                      {formatPrice(service.price, service.currency)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            <Button
              variant="primary"
              fullWidth
              className="mt-4"
              disabled={!selectedService}
              onClick={() => setStep(2)}
            >
              التالي
              <ChevronLeft size={15} />
            </Button>
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              اختار اليوم
            </p>
            <div className="grid grid-cols-7 gap-1 mb-5">
              {days.map((d) => (
                <button
                  key={d.num}
                  disabled={!d.available}
                  onClick={() => setSelectedDay(d.num)}
                  className={`flex flex-col items-center py-2.5 rounded-xl text-xs transition-all ${
                    !d.available
                      ? "opacity-40 cursor-not-allowed bg-[var(--color-surface-2)]"
                      : selectedDay === d.num
                      ? "bg-[var(--color-brand)] text-white"
                      : "bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)]"
                  }`}
                >
                  <span className="text-[9px] mb-0.5 opacity-70">{d.date.slice(0, 2)}</span>
                  <span className="font-bold">{d.num}</span>
                </button>
              ))}
            </div>

            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
              اختار الوقت
            </p>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((slot, i) => (
                <button
                  key={slot}
                  disabled={i % 4 === 3}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    i % 4 === 3
                      ? "opacity-40 cursor-not-allowed bg-gray-50 border-[var(--color-border)] text-[var(--color-text-muted)] line-through"
                      : selectedTime === slot
                      ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                      : "bg-white border-[var(--color-border)] hover:border-[var(--color-brand)] text-[var(--color-text-primary)]"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                <ChevronRight size={15} />
                رجوع
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!selectedDay || !selectedTime}
                onClick={() => setStep(3)}
              >
                التالي
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-4">
              بياناتك
            </p>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                الاسم الكامل
              </label>
              <input
                type="text"
                placeholder="محمد أحمد"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                رقم الهاتف
              </label>
              <input
                type="tel"
                placeholder="01xxxxxxxxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                ملاحظات (اختياري)
              </label>
              <textarea
                placeholder="أي معلومات إضافية..."
                rows={2}
                className="input resize-none"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                <ChevronRight size={15} />
                رجوع
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                disabled={!name || !phone}
                onClick={() => setStep(4)}
              >
                تأكيد الحجز
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <h3 className="font-black text-xl text-[var(--color-text-primary)] mb-2">
              تم الحجز!
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              سيصلك تأكيد الحجز على واتساب قريبًا.
            </p>

            {/* Summary */}
            <div className="text-start bg-[var(--color-surface-2)] rounded-xl p-4 space-y-2.5 mb-5">
              {[
                { label: "الخدمة", value: selectedService?.nameAr },
                { label: "اليوم", value: `أبريل ${selectedDay}` },
                { label: "الوقت", value: selectedTime },
                { label: "الإجمالي", value: selectedService ? formatPrice(selectedService.price, selectedService.currency) : "" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">{r.label}</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setStep(1);
                setSelectedService(null);
                setSelectedDay(null);
                setSelectedTime(null);
                setName("");
                setPhone("");
              }}
            >
              حجز موعد آخر
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
