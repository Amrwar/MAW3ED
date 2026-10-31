"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CalendarDays, Plus, List } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import BookingFilters from "./BookingFilters";
import DayCalendar from "./DayCalendar";
import BookingsTable from "./BookingsTable";
import BookingDetailPanel from "./BookingDetailPanel";
import ManualBookingPanel, { type ServiceOption } from "@/features/dashboard/ManualBookingPanel";
import {
  type DashboardBooking,
  type DashboardBookingStatus,
  getTodayISO,
} from "@/features/dashboard/bookings/types";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { cn } from "@/lib/utils";

interface BookingsClientProps {
  initialTodayBookings: DashboardBooking[];
  /** ?status= from the URL, already checked against the known statuses. */
  initialStatus?:       string | null;
  services:             Array<{ id: string; nameAr: string }>;
  serviceOptions:       ServiceOption[];
  slug:                 string;
  totalBookings:        number;
  /** Whether this person may key a booking in (owner, or a delegate with reservations). */
  canCreate?:           boolean;
  /** Whether the detail panel offers collecting a balance (the owner's). */
  canCollect?:          boolean;
}

export default function BookingsClient({
  initialTodayBookings,
  services,
  serviceOptions,
  slug,
  totalBookings,
  initialStatus = null,
  canCreate = true,
  canCollect = true,
}: BookingsClientProps) {
  const { t, lang } = useLanguage();
  const b      = t.dashboard.bookings;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  // ── Data state ────────────────────────────────────────────
  const [bookings,        setBookings]        = useState<DashboardBooking[]>([]);
  const [total,           setTotal]           = useState(totalBookings);
  const [totalPages,      setTotalPages]      = useState(1);
  const [page,            setPage]            = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<DashboardBooking | null>(null);
  const [newBookingOpen,  setNewBookingOpen]  = useState(false);

  // The calendar is the default surface: this is an appointments
  // product, so the day view answers "what does today look like"
  // before the table answers "find me one booking".
  // A link such as the dashboard's "waiting for you" card opens the
  // filtered list directly.
  const [view,         setView]         = useState<"calendar" | "list">(initialStatus ? "list" : "calendar");
  const [calendarDate, setCalendarDate] = useState(getTodayISO());
  const [dayBookings,  setDayBookings]  = useState<DashboardBooking[]>(
    () => [...initialTodayBookings].sort((a, bk) => a.startTime.localeCompare(bk.startTime)),
  );
  const [dayLoading,   setDayLoading]   = useState(false);

  // ── Filter state ──────────────────────────────────────────
  const [statusFilter,  setStatusFilter]  = useState(initialStatus ?? "ALL");
  const [search,        setSearch]        = useState("");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [serviceFilter, setServiceFilter] = useState("");

  // ── Fetch ─────────────────────────────────────────────────
  // A new filter starts again from the first page.
  const filterKey = [statusFilter, search.trim(), dateFrom, dateTo, serviceFilter].join("|");
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const params = new URLSearchParams();
  if (statusFilter !== "ALL") params.set("status", statusFilter);
  if (search.trim())          params.set("search", search.trim());
  if (dateFrom)               params.set("dateFrom", dateFrom);
  if (dateTo)                 params.set("dateTo", dateTo);
  if (serviceFilter)          params.set("serviceId", serviceFilter);
  params.set("page", String(page));

  // Bumped to fetch the same page again after a change elsewhere.
  const [reloads, setReloads] = useState(0);
  const reloadBookings = () => setReloads((n) => n + 1);
  const requestKey = `${params}#${reloads}`;

  // The request whose rows are on screen; loading until it matches.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let stale = false;
    const query = requestKey.slice(0, requestKey.lastIndexOf("#"));
    fetch(`/api/business/bookings?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (stale) return;
        setBookings(data.bookings ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch(() => {
        // keep previous data on error
      })
      .finally(() => {
        if (!stale) setLoadedKey(requestKey);
      });
    return () => {
      stale = true;
    };
  }, [requestKey]);

  const fetchDay = useCallback(async (iso: string) => {
    setDayLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom: iso, dateTo: iso, page: "1" });
      const res  = await fetch(`/api/business/bookings?${params}`);
      const data = await res.json();
      setDayBookings(data.bookings ?? []);
    } catch {
      // keep the previous day's data on error
    } finally {
      setDayLoading(false);
    }
  }, []);

  // Today's bookings arrive from the server, so the first calendar
  // render needs no fetch; every other day does.
  const loadedDay = useRef(getTodayISO());
  useEffect(() => {
    if (view !== "calendar") return;
    if (loadedDay.current === calendarDate) return;
    loadedDay.current = calendarDate;
    fetchDay(calendarDate);
  }, [view, calendarDate, fetchDay]);

  // ── Manual booking created ────────────────────────────────
  function handleNewBooking(booking: DashboardBooking) {
    if (booking.date === calendarDate) {
      setDayBookings((prev) =>
        [...prev, booking].sort((a, bk) => a.startTime.localeCompare(bk.startTime)),
      );
    }
    setPage(1);
    reloadBookings();
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
    if (!res.ok) {
      // Ahead of the clock: worded from the code in the owner's language,
      // and the lists reloaded so the buttons match the server again.
      if (data.code === "too-early") {
        reloadBookings();
        fetchDay(calendarDate);
        throw new Error(t.dashboard.bookingActions.tooEarly);
      }
      throw new Error(data.error ?? t.dashboard.bookingActions.error);
    }

    const update = (bk: DashboardBooking) => bk.id === id ? { ...bk, status } : bk;
    setBookings((prev)        => prev.map(update));
    setDayBookings((prev)     => prev.map(update));
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
  }

  // ── Real-time updates ─────────────────────────────────────
  useRealtimeBookings((event) => {
    if (event.type === "BOOKING_UPDATED") {
      const { id, status } = event;
      const s = status as DashboardBookingStatus;
      setBookings((prev)        => prev.map((bk) => bk.id === id ? { ...bk, status: s } : bk));
      setDayBookings((prev)     => prev.map((bk) => bk.id === id ? { ...bk, status: s } : bk));
      setSelectedBooking((prev) => prev?.id === id ? { ...prev, status: s } : prev);
    } else {
      reloadBookings();
      const bk = event.booking;
      if (bk.date === calendarDate && bk.status !== "CANCELLED") {
        setDayBookings((prev) => {
          if (prev.some((x) => x.id === bk.id)) return prev;
          return [...prev, bk].sort((a, x) => a.startTime.localeCompare(x.startTime));
        });
      }
    }
  });

  const todayLabel = new Date().toLocaleDateString(locale, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]">
            {b.title}
          </h1>
          <p className="m-0 mt-2 text-[0.84375rem] text-[var(--color-subtle)]">
            <span className="num font-bold text-[var(--color-ink)]">
              {total.toLocaleString(locale)}
            </span>{" "}
            {b.count} · {todayLabel}
          </p>
        </div>

        {/* Wraps on a phone: the tabs and the button side by side were
            wider than 390 px, and the button sat flush on the edge. */}
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label={b.title}
            className="flex gap-1 rounded-full bg-[var(--color-surface-3)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={view === "calendar"}
              onClick={() => setView("calendar")}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-4 text-[0.8125rem] transition-colors",
                view === "calendar"
                  ? "bg-[var(--color-surface)] font-bold text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              <CalendarDays size={15} strokeWidth={1.8} aria-hidden="true" />
              {lang === "ar" ? "الجدول" : "Calendar"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-4 text-[0.8125rem] transition-colors",
                view === "list"
                  ? "bg-[var(--color-surface)] font-bold text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              <List size={15} strokeWidth={1.8} aria-hidden="true" />
              {lang === "ar" ? "قائمة" : "List"}
            </button>
          </div>

          {canCreate && (
            <button type="button" onClick={() => setNewBookingOpen(true)} className="btn btn-primary">
              <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
              {b.newBtn}
            </button>
          )}
        </div>
      </div>

      {view === "calendar" ? (
        <DayCalendar
          date={calendarDate}
          bookings={dayBookings}
          loading={dayLoading}
          isToday={calendarDate === getTodayISO()}
          onDateChange={setCalendarDate}
          onSelect={setSelectedBooking}
          onNewBooking={canCreate ? () => setNewBookingOpen(true) : undefined}
        />
      ) : (
        <>
          <BookingFilters
            statusFilter={statusFilter}    onStatusChange={setStatusFilter}
            search={search}                onSearchChange={setSearch}
            dateFrom={dateFrom}            onDateFromChange={setDateFrom}
            dateTo={dateTo}                onDateToChange={setDateTo}
            serviceFilter={serviceFilter}  onServiceChange={setServiceFilter}
            services={services}
            total={total}
          />

          <BookingsTable
            bookings={bookings}
            loading={loading}
            selected={selectedBooking?.id ?? null}
            onSelect={setSelectedBooking}
            onStatusChange={handleStatusChange}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}

      {/* ── Detail panel ── */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={handleStatusChange}
          canCollect={canCollect}
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
