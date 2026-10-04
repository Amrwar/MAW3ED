"use client";

import { useState, useCallback } from "react";
import { CalendarDays, Plus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TodaySchedule from "@/app/dashboard/bookings/_components/TodaySchedule";
import BookingDetailPanel from "@/app/dashboard/bookings/_components/BookingDetailPanel";
import ManualBookingPanel, { type ServiceOption } from "@/features/dashboard/ManualBookingPanel";
import { type DashboardBooking, type DashboardBookingStatus } from "@/features/dashboard/bookings/types";

interface DashboardTodayWidgetProps {
  initialBookings: DashboardBooking[];
  slug:            string;
  services:        ServiceOption[];
}

export default function DashboardTodayWidget({
  initialBookings,
  slug,
  services,
}: DashboardTodayWidgetProps) {
  const [bookings,        setBookings]        = useState<DashboardBooking[]>(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen,  setNewBookingOpen]  = useState(false);

  const handleStatusChange = useCallback(async (id: string, status: DashboardBookingStatus) => {
    const res = await fetch(`/api/dashboard/bookings/${id}/status`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("فشل تحديث الحالة");
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }, []);

  const handleCreated = useCallback((booking: DashboardBooking) => {
    const today = new Date();
    const todayISO = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    if (booking.date === todayISO) {
      setBookings((prev) =>
        [...prev, booking].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    }
    setNewBookingOpen(false);
  }, []);

  return (
    <>
      {bookings.length > 0 ? (
        <TodaySchedule
          bookings={bookings}
          onSelect={setSelectedBooking}
          onNewBooking={() => setNewBookingOpen(true)}
        />
      ) : (
        /* ── Premium empty state ── */
        <div
          className="rounded-2xl border bg-white overflow-hidden"
          style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
        >
          {/* Card header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--color-surface-3)" }}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />
              <h3 className="text-sm font-bold text-[var(--color-ink)]">مواعيد اليوم</h3>
            </div>
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "var(--color-jade)" }}
            >
              عرض الكل
              <ArrowLeft size={12} />
            </Link>
          </div>

          {/* Empty body */}
          <div className="py-14 flex flex-col items-center text-center px-6">
            {/* Decorative icon area */}
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
              style={{
                background:  "linear-gradient(135deg, rgba(10,95,71,0.08) 0%, rgba(14,127,94,0.06) 100%)",
                border:      "1px solid rgba(14,127,94,0.14)",
              }}
            >
              <CalendarDays size={32} strokeWidth={1.5} style={{ color: "var(--color-jade)" }} />
            </div>

            <p className="text-base font-bold text-[var(--color-ink)] mb-1.5">
              لا توجد مواعيد اليوم
            </p>
            <p className="text-sm text-[var(--color-subtle)] mb-6 max-w-xs leading-relaxed">
              لم يتم تسجيل أي حجوزات لهذا اليوم. أضف حجزًا يدويًا أو انتظر حجوزات عملائك.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setNewBookingOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                  boxShadow:  "0 4px 14px rgba(14,127,94,0.30)",
                }}
              >
                <Plus size={15} strokeWidth={2.5} />
                إضافة حجز
              </button>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                style={{
                  background:  "var(--color-surface-2)",
                  border:      "1px solid var(--color-line)",
                  color:       "var(--color-muted)",
                }}
              >
                عرض المواعيد
              </Link>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      <ManualBookingPanel
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        slug={slug}
        services={services}
        onCreated={handleCreated}
      />
    </>
  );
}
