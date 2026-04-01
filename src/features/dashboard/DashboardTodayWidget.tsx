"use client";

import { useState, useCallback } from "react";
import { CalendarDays } from "lucide-react";
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
  const [bookings,       setBookings]       = useState<DashboardBooking[]>(initialBookings);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen, setNewBookingOpen]  = useState(false);

  const handleStatusChange = useCallback(
    async (id: string, status: DashboardBookingStatus) => {
      const res = await fetch(`/api/dashboard/bookings/${id}/status`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("فشل تحديث الحالة");

      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status } : b))
      );
      setSelectedBooking((prev) =>
        prev?.id === id ? { ...prev, status } : prev
      );
    },
    [],
  );

  const handleCreated = useCallback((booking: DashboardBooking) => {
    // Only add to today's list if the booking is for today
    const today = new Date();
    const todayISO = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    if (booking.date === todayISO) {
      setBookings((prev) =>
        [...prev, booking].sort((a, b) => a.startTime.localeCompare(b.startTime))
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
        <div className="card p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
            <CalendarDays size={22} className="text-[var(--color-text-muted)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">لا توجد مواعيد اليوم</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              يمكنك إضافة حجز يدوي أو{" "}
              <Link href="/dashboard/bookings" className="text-[var(--color-brand)] hover:underline">
                عرض كل المواعيد
              </Link>
            </p>
          </div>
          <button
            onClick={() => setNewBookingOpen(true)}
            className="btn btn-primary btn-sm"
          >
            + إضافة حجز
          </button>
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
