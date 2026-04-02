"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Plus } from "lucide-react";
import BookingFilters from "./BookingFilters";
import TodaySchedule from "./TodaySchedule";
import BookingsTable from "./BookingsTable";
import BookingDetailPanel from "./BookingDetailPanel";
import ManualBookingPanel, { type ServiceOption } from "@/features/dashboard/ManualBookingPanel";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  getTodayISO,
} from "@/features/dashboard/bookings/types";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";

interface BookingsClientProps {
  initialTodayBookings: DashboardBooking[];
  services:             Array<{ id: string; nameAr: string }>;
  serviceOptions:       ServiceOption[];
  slug:                 string;
  totalBookings:        number;
}

export default function BookingsClient({
  initialTodayBookings,
  services,
  serviceOptions,
  slug,
  totalBookings,
}: BookingsClientProps) {
  // ── Bookings data ──────────────────────────────────────────
  const [bookings,        setBookings]        = useState<DashboardBooking[]>([]);
  const [total,           setTotal]           = useState(totalBookings);
  const [totalPages,      setTotalPages]      = useState(1);
  const [page,            setPage]            = useState(1);
  const [loading,         setLoading]         = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen,  setNewBookingOpen]  = useState(false);

  // Today's schedule — seeded from server, kept in sync on status changes
  const [todayBookings, setTodayBookings] = useState<DashboardBooking[]>(
    initialTodayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );

  // ── Filters ───────────────────────────────────────────────
  const [statusFilter,  setStatusFilter]  = useState("ALL");
  const [search,        setSearch]        = useState("");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [serviceFilter, setServiceFilter] = useState("");

  // ── Fetch ─────────────────────────────────────────────────
  const fetchBookings = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setPage(targetPage);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim())          params.set("search", search.trim());
      if (dateFrom)               params.set("dateFrom", dateFrom);
      if (dateTo)                 params.set("dateTo", dateTo);
      if (serviceFilter)          params.set("serviceId", serviceFilter);
      params.set("page", String(targetPage));

      const res  = await fetch(`/api/business/bookings?${params}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFrom, dateTo, serviceFilter]);

  // Refetch page 1 whenever filters change
  useEffect(() => {
    fetchBookings(1);
  }, [fetchBookings]);

  // ── Manual booking created ────────────────────────────────
  function handleNewBooking(booking: DashboardBooking) {
    if (booking.date === getTodayISO()) {
      setTodayBookings((prev) =>
        [...prev, booking].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
    }
    fetchBookings(1);
    setTotal((t) => t + 1);
  }

  // ── Status update ──────────────────────────────────────────
  async function handleStatusChange(id: string, status: DashboardBookingStatus) {
    const res  = await fetch(`/api/business/bookings/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "حدث خطأ");

    const update = (b: DashboardBooking) =>
      b.id === id ? { ...b, status } : b;

    setBookings((prev)       => prev.map(update));
    setTodayBookings((prev)  => prev.map(update));
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  // ── Real-time updates via SSE ──────────────────────────────
  useRealtimeBookings((event) => {
    if (event.type === "BOOKING_UPDATED") {
      const { id, status } = event;
      const s = status as DashboardBookingStatus;
      setBookings((prev)        => prev.map((b) => b.id === id ? { ...b, status: s } : b));
      setTodayBookings((prev)   => prev.map((b) => b.id === id ? { ...b, status: s } : b));
      setSelectedBooking((prev) => prev?.id === id ? { ...prev, status: s } : prev);
    } else {
      // New booking from any source (public or manual).
      // fetchBookings updates both the list and the total count from the API.
      fetchBookings(page);
      const b = event.booking;
      if (b.date === getTodayISO() && b.status !== "CANCELLED") {
        setTodayBookings((prev) => {
          // Guard against the manual-booking flow already having added this booking
          if (prev.some((x) => x.id === b.id)) return prev;
          return [...prev, b].sort((a, x) => a.startTime.localeCompare(x.startTime));
        });
      }
    }
  });

  // ── Today filter ───────────────────────────────────────────
  const todayISO = getTodayISO();
  const activeTodayBookings = todayBookings.filter((b) => b.status !== "CANCELLED");
  const showTodaySchedule   = (!dateFrom && !dateTo) || (dateFrom <= todayISO && (!dateTo || dateTo >= todayISO));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
            الحجوزات
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {total.toLocaleString("ar-EG")} حجز
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <CalendarDays size={15} />
            {new Date().toLocaleDateString("ar-EG", { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <button
            onClick={() => setNewBookingOpen(true)}
            className="btn btn-primary btn-sm gap-2"
          >
            <Plus size={15} />
            موعد جديد
          </button>
        </div>
      </div>

      {/* Filters */}
      <BookingFilters
        statusFilter={statusFilter}    onStatusChange={setStatusFilter}
        search={search}                onSearchChange={setSearch}
        dateFrom={dateFrom}            onDateFromChange={setDateFrom}
        dateTo={dateTo}                onDateToChange={setDateTo}
        serviceFilter={serviceFilter}  onServiceChange={setServiceFilter}
        services={services}
        total={total}
      />

      {/* Today's schedule */}
      {showTodaySchedule && activeTodayBookings.length > 0 && (
        <TodaySchedule
          bookings={activeTodayBookings}
          onSelect={setSelectedBooking}
          onNewBooking={() => setNewBookingOpen(true)}
        />
      )}

      {/* Main bookings table */}
      <BookingsTable
        bookings={bookings}
        loading={loading}
        selected={selectedBooking?.id ?? null}
        onSelect={setSelectedBooking}
        onStatusChange={handleStatusChange}
        page={page}
        totalPages={totalPages}
        onPageChange={(p) => fetchBookings(p)}
      />

      {/* Detail panel overlay */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Manual booking panel */}
      <ManualBookingPanel
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        slug={slug}
        services={serviceOptions}
        onCreated={handleNewBooking}
      />
    </div>
  );
}
