"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";
import { statusStripe } from "@/components/ui/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { dateLong, clock, money, num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

/** 15 minutes per row keeps a 45-minute appointment exactly 3 rows tall. */
const ROW_MIN = 15;
const ROW_PX = 22;
const ROWS_PER_HOUR = 60 / ROW_MIN;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

type Laid = {
  booking: DashboardBooking;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

/**
 * Assigns overlapping appointments to side-by-side lanes so a double
 * booking is visible as two columns rather than one block hiding
 * another.
 */
function layout(bookings: DashboardBooking[]): Laid[] {
  const items = bookings
    .map((b) => {
      const start = toMinutes(b.startTime);
      const end = b.endTime
        ? toMinutes(b.endTime)
        : start + Math.max(ROW_MIN, b.serviceDuration || 30);
      return { booking: b, start, end };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const out: Laid[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((e) => e <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }
      return { ...item, lane };
    });
    const lanes = laneEnds.length;
    assigned.forEach((a) => out.push({ ...a, lanes }));
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return out;
}

interface Props {
  date: string;
  bookings: DashboardBooking[];
  loading?: boolean;
  onDateChange: (iso: string) => void;
  onSelect: (booking: DashboardBooking) => void;
  onNewBooking: () => void;
  isToday: boolean;
}

export default function DayCalendar({
  date,
  bookings,
  loading = false,
  onDateChange,
  onSelect,
  onNewBooking,
  isToday,
}: Props) {
  const { t, lang } = useLanguage();
  const b = t.dashboard.bookings;

  const active = useMemo(
    () => bookings.filter((bk) => bk.status !== "CANCELLED"),
    [bookings],
  );

  const laid = useMemo(() => layout(active), [active]);

  /** The window spans the working day, widened to fit anything outside it. */
  const { startHour, endHour } = useMemo(() => {
    let min = 9 * 60;
    let max = 18 * 60;
    for (const item of laid) {
      min = Math.min(min, item.start);
      max = Math.max(max, item.end);
    }
    return {
      startHour: Math.max(0, Math.floor(min / 60)),
      endHour: Math.min(24, Math.ceil(max / 60)),
    };
  }, [laid]);

  const totalRows = Math.max(1, (endHour - startHour) * ROWS_PER_HOUR);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  const revenue = active.reduce((sum, bk) => sum + bk.totalPrice, 0);

  /** Position of the now-line, or null when it falls outside the window. */
  const nowRow = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < startHour * 60 || mins > endHour * 60) return null;
    return (mins - startHour * 60) / ROW_MIN;
  }, [isToday, startHour, endHour]);

  const label = {
    free: lang === "ar" ? "فتحة فاضية" : "Free slot",
    expected: lang === "ar" ? "متوقّع" : "expected",
    empty: lang === "ar" ? "مفيش مواعيد في اليوم ده" : "No appointments this day",
    emptyBody:
      lang === "ar"
        ? "اضغط على أي وقت فاضي عشان تضيف حجز."
        : "Pick any free time to add a booking.",
    prev: lang === "ar" ? "اليوم السابق" : "Previous day",
    next: lang === "ar" ? "اليوم التالي" : "Next day",
    today: lang === "ar" ? "النهارده" : "Today",
  };

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]">

      {/* ── Day header ── */}
      <div className="flex flex-wrap items-center gap-4 border-b border-[var(--color-line)] px-6 py-4">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={label.prev}
            onClick={() => onDateChange(shiftDate(date, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
          >
            <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={label.next}
            onClick={() => onDateChange(shiftDate(date, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]"
          >
            <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="min-w-0">
          <h2 className="m-0 text-[1.25rem] font-bold text-[var(--color-ink)]">
            {dateLong(`${date}T00:00:00`, lang)}
          </h2>
          <p className="m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
            <span className="num">{num(active.length, lang)}</span> {b.count}
            {revenue > 0 && (
              <>
                {" · "}
                <span className="num">{money(revenue, lang, active[0]?.currency ?? "EGP")}</span>{" "}
                {label.expected}
              </>
            )}
          </p>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2.5">
          {!isToday && (
            <button
              type="button"
              onClick={() => onDateChange(new Date().toISOString().slice(0, 10))}
              className="btn btn-outline btn-sm"
            >
              {label.today}
            </button>
          )}
          <button type="button" onClick={onNewBooking} className="btn btn-primary btn-sm">
            <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
            {b.newBtn}
          </button>
        </div>
      </div>

      {/* ── Time grid ── */}
      <div className="px-6 py-5">
        {active.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span
              aria-hidden="true"
              className="mb-1 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-3)] text-[var(--color-muted)]"
            >
              <Clock size={24} strokeWidth={1.7} />
            </span>
            <h3 className="m-0 text-base font-bold text-[var(--color-ink)]">{label.empty}</h3>
            <p className="m-0 max-w-[40ch] text-sm text-[var(--color-subtle)]">{label.emptyBody}</p>
            <button type="button" onClick={onNewBooking} className="btn btn-primary btn-sm mt-3">
              <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
              {b.newBtn}
            </button>
          </div>
        ) : (
          <div
            className={cn("relative overflow-x-auto", loading && "opacity-60")}
            style={{
              display: "grid",
              gridTemplateColumns: "3.5rem minmax(0, 1fr)",
              gridAutoRows: `${ROW_PX}px`,
              columnGap: "0.75rem",
              // one hairline per hour
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--color-line) 0 1px, transparent 1px " +
                `${ROW_PX * ROWS_PER_HOUR}px)`,
            }}
          >
            {hours.map((h, i) => (
              <span
                key={h}
                className="num -translate-y-1.5 text-[0.71875rem] text-[var(--color-subtle)]"
                style={{ gridColumn: 1, gridRow: `${i * ROWS_PER_HOUR + 1} / span ${ROWS_PER_HOUR}` }}
              >
                {clock(`${h}:00`)}
              </span>
            ))}

            {/* keeps the grid its full height even on an empty-ish day */}
            <span aria-hidden="true" style={{ gridColumn: 2, gridRow: `1 / span ${totalRows}` }} />

            {laid.map(({ booking, start, end, lane, lanes }) => {
              const rowStart = Math.floor((start - startHour * 60) / ROW_MIN) + 1;
              const span = Math.max(1, Math.round((end - start) / ROW_MIN));
              const stripe = statusStripe(booking.status);
              const width = `${100 / lanes}%`;

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelect(booking)}
                  className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-start transition-shadow hover:shadow-[var(--shadow-raised)]"
                  style={{
                    gridColumn: 2,
                    gridRow: `${rowStart} / span ${span}`,
                    borderInlineStartWidth: 3,
                    borderInlineStartColor: stripe,
                    marginBlock: 1,
                    marginInlineStart: `calc(${lane} * ${width})`,
                    width: `calc(${width} - 4px)`,
                  }}
                >
                  <span className="block truncate text-[0.78125rem] font-bold text-[var(--color-ink)]">
                    {booking.customerName}
                  </span>
                  {span > 2 && (
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-[var(--color-muted)]">
                      {booking.serviceName} · <span className="num">{clock(booking.startTime)}</span>
                    </span>
                  )}
                  {span > 5 && (
                    <span className="num mt-1.5 block text-[0.6875rem] font-bold text-[var(--color-ink)]">
                      {money(booking.totalPrice, lang, booking.currency)}
                    </span>
                  )}
                </button>
              );
            })}

            {nowRow != null && (
              <div
                aria-hidden="true"
                className="relative h-0 self-start border-t-2 border-dashed border-[var(--color-danger)]"
                style={{ gridColumn: "1 / -1", gridRow: Math.floor(nowRow) + 1 }}
              >
                <span className="num absolute -top-2.5 start-0 rounded-[var(--radius-xs)] bg-[var(--color-danger)] px-1.5 py-0.5 text-[0.625rem] font-bold text-white">
                  {clock(`${new Date().getHours()}:${String(new Date().getMinutes()).padStart(2, "0")}`)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
