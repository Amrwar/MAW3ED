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
          style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
        >
          {/* Card header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid #F1F5F9" }}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={16} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
              <h3 className="text-sm font-bold text-[#0F172A]">مواعيد اليوم</h3>
            </div>
            <Link
              href="/dashboard/bookings"
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#3B82F6" }}
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
                background:  "linear-gradient(135deg, rgba(29,78,216,0.08) 0%, rgba(99,102,241,0.06) 100%)",
                border:      "1px solid rgba(59,130,246,0.14)",
              }}
            >
              <CalendarDays size={32} strokeWidth={1.5} style={{ color: "#3B82F6" }} />
            </div>

            <p className="text-base font-bold text-[#0F172A] mb-1.5">
              لا توجد مواعيد اليوم
            </p>
            <p className="text-sm text-[#94A3B8] mb-6 max-w-xs leading-relaxed">
              لم يتم تسجيل أي حجوزات لهذا اليوم. أضف حجزًا يدويًا أو انتظر حجوزات عملائك.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setNewBookingOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                  boxShadow:  "0 4px 14px rgba(59,130,246,0.30)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(59,130,246,0.42)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.filter = "";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(59,130,246,0.30)";
                }}
              >
                <Plus size={15} strokeWidth={2.5} />
                إضافة حجز
              </button>
              <Link
                href="/dashboard/bookings"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
                style={{
                  background:  "#F8FAFC",
                  border:      "1px solid #E2E8F0",
                  color:       "#475569",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "#BFDBFE";
                  el.style.color = "#1D4ED8";
                  el.style.background = "#EFF6FF";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  el.style.borderColor = "#E2E8F0";
                  el.style.color = "#475569";
                  el.style.background = "#F8FAFC";
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
