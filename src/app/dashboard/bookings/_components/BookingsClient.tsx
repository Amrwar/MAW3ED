"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { t, lang } = useLanguage();
  const b      = t.dashboard.bookings;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  // ── Data state ────────────────────────────────────────────
  const [bookings,        setBookings]        = useState<DashboardBooking[]>([]);
  const [total,           setTotal]           = useState(totalBookings);
  const [totalPages,      setTotalPages]      = useState(1);
  const [page,            setPage]            = useState(1);
  const [loading,         setLoading]         = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen,  setNewBookingOpen]  = useState(false);

  const [todayBookings, setTodayBookings] = useState<DashboardBooking[]>(
    initialTodayBookings.sort((a, bk) => a.startTime.localeCompare(bk.startTime)),
  );

  // ── Filter state ──────────────────────────────────────────
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

  useEffect(() => { fetchBookings(1); }, [fetchBookings]);

  // ── Manual booking created ────────────────────────────────
  function handleNewBooking(booking: DashboardBooking) {
    if (booking.date === getTodayISO()) {
      setTodayBookings((prev) =>
        [...prev, booking].sort((a, bk) => a.startTime.localeCompare(bk.startTime)),
      );
    }
    fetchBookings(1);
    setTotal((t) => t + 1);
  }

  // ── Status update ─────────────────────────────────────────
  async function handleStatusChange(id: string, status: DashboardBookingStatus) {
    const res  = await fetch(`/api/business/bookings/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? t.dashboard.bookingActions.error);

    const update = (bk: DashboardBooking) => bk.id === id ? { ...bk, status } : bk;
    setBookings((prev)        => prev.map(update));
    setTodayBookings((prev)   => prev.map(update));
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  // ── Real-time updates ─────────────────────────────────────
  useRealtimeBookings((event) => {
    if (event.type === "BOOKING_UPDATED") {
      const { id, status } = event;
      const s = status as DashboardBookingStatus;
      setBookings((prev)        => prev.map((bk) => bk.id === id ? { ...bk, status: s } : bk));
      setTodayBookings((prev)   => prev.map((bk) => bk.id === id ? { ...bk, status: s } : bk));
      setSelectedBooking((prev) => prev?.id === id ? { ...prev, status: s } : prev);
    } else {
      fetchBookings(page);
      const bk = event.booking;
      if (bk.date === getTodayISO() && bk.status !== "CANCELLED") {
        setTodayBookings((prev) => {
          if (prev.some((x) => x.id === bk.id)) return prev;
          return [...prev, bk].sort((a, x) => a.startTime.localeCompare(x.startTime));
        });
      }
    }
  });

  const todayISO = getTodayISO();
  const activeTodayBookings = todayBookings.filter((bk) => bk.status !== "CANCELLED");
  const showTodaySchedule   = (!dateFrom && !dateTo) || (dateFrom <= todayISO && (!dateTo || dateTo >= todayISO));

  const todayLabel = new Date().toLocaleDateString(locale, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-5">

      {/* ── Premium page header ── */}
      <div
        className="rounded-2xl border bg-white px-6 py-5"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="font-black text-[#0F172A] leading-tight"
              style={{ fontSize: 22, letterSpacing: "-0.02em" }}
            >
              {b.title}
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              إدارة ومتابعة جميع الحجوزات ·{" "}
              <span className="font-semibold text-[#475569]">
                {total.toLocaleString(locale)} {b.count}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569" }}
            >
              <CalendarDays size={13} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
              {todayLabel}
            </span>
            <button
              onClick={() => setNewBookingOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(59,130,246,0.38)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.filter = "";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 14px rgba(59,130,246,0.28)";
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              {b.newBtn}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters card ── */}
      <BookingFilters
        statusFilter={statusFilter}    onStatusChange={setStatusFilter}
        search={search}                onSearchChange={setSearch}
        dateFrom={dateFrom}            onDateFromChange={setDateFrom}
        dateTo={dateTo}                onDateToChange={setDateTo}
        serviceFilter={serviceFilter}  onServiceChange={setServiceFilter}
        services={services}
        total={total}
      />

      {/* ── Today's schedule ── */}
      {showTodaySchedule && activeTodayBookings.length > 0 && (
        <TodaySchedule
          bookings={activeTodayBookings}
          onSelect={setSelectedBooking}
          onNewBooking={() => setNewBookingOpen(true)}
        />
      )}

      {/* ── Bookings table ── */}
      <BookingsTable
        bookings={bookings}
        loading={loading}
        selected={selectedBooking?.id ?? null}
        onSelect={setSelectedBooking}
        onStatusChange={handleStatusChange}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => fetchBookings(p)}
      />

      {/* ── Detail panel ── */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ── Manual booking panel ── */}
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
