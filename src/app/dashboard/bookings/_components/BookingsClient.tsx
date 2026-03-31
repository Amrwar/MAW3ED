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
  const [loading,         setLoading]         = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen,  setNewBookingOpen]  = useState(false);

  // Today's schedule — starts from server-fetched data, kept in sync on status changes
  const [todayBookings, setTodayBookings] = useState<DashboardBooking[]>(
    initialTodayBookings.sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );

  // ── Filters ───────────────────────────────────────────────
  const [statusFilter,  setStatusFilter]  = useState("ALL");
  const [search,        setSearch]        = useState("");
  const [dateFilter,    setDateFilter]    = useState("");
  const [serviceFilter, setServiceFilter] = useState("");

  // ── Fetch bookings ─────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (search.trim())          params.set("search", search.trim());
      if (dateFilter)             params.set("date", dateFilter);
      if (serviceFilter)          params.set("serviceId", serviceFilter);

      const res  = await fetch(`/api/business/bookings?${params}`);
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFilter, serviceFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ── Manual booking created ────────────────────────────────
  function handleNewBooking(booking: DashboardBooking) {
    // Add to today's schedule if it's for today
    if (booking.date === getTodayISO()) {
      setTodayBookings((prev) =>
        [...prev, booking].sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
    }
    // Refresh the main bookings table
    fetchBookings();
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
    if (!res.ok) throw new Error(data.error ?? "\u062d\u062f\u062b \u062e\u0637\u0623");

    // Optimistically update all lists
    const update = (b: DashboardBooking) =>
      b.id === id ? { ...b, status } : b;

    setBookings((prev) => prev.map(update));
    setTodayBookings((prev) => prev.map(update));
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  // ── Today filter ───────────────────────────────────────────
  const todayISO = getTodayISO();
  // todayBookings that haven't been cancelled/completed already shown
  const activeTodayBookings = todayBookings.filter(
    (b) => b.status !== "CANCELLED",
  );

  const hasFilters = statusFilter !== "ALL" || search || dateFilter || serviceFilter;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
            \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {total.toLocaleString("ar-EG")} \u062d\u062c\u0632 \u0625\u062c\u0645\u0627\u0644\u064a\u064b\u0627
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
        dateFilter={dateFilter}        onDateChange={setDateFilter}
        serviceFilter={serviceFilter}  onServiceChange={setServiceFilter}
        services={services}
        total={total}
      />

      {/* Today's schedule — only when no date filter or date filter is today */}
      {(!dateFilter || dateFilter === todayISO) && activeTodayBookings.length > 0 && (
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
