"use client";

import { useMemo } from "react";
import type { CalendarBlock, CalendarEntry, CalendarView } from "@/lib/scheduling/calendar";
import { datesBetween, layoutDay } from "@/lib/scheduling/calendar";
import { useLanguage } from "@/contexts/LanguageContext";
import { minutesToTime } from "@/lib/bookings/time";
import { cn } from "@/lib/utils";

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** How tall one minute is, in pixels. 56px an hour reads comfortably. */
const PX_PER_MIN = 56 / 60;

const STATUS_TONE: Record<string, string> = {
  PENDING_PAYMENT: "border-s-[var(--color-warn)] bg-[var(--color-warn-soft)]",
  PENDING: "border-s-[var(--color-star)] bg-[var(--color-warn-soft)]",
  CONFIRMED: "border-s-[var(--color-ok)] bg-[var(--color-ok-soft)]",
  ARRIVED: "border-s-[var(--color-jade)] bg-[var(--color-jade-soft)]",
  IN_PROGRESS: "border-s-[var(--color-info)] bg-[var(--color-info-soft)]",
  COMPLETED: "border-s-[var(--color-line-2)] bg-[var(--color-surface-2)]",
  NO_SHOW: "border-s-[var(--color-subtle)] bg-[var(--color-surface-2)]",
  CANCELLED: "border-s-[var(--color-danger)] bg-[var(--color-danger-soft)]",
  FAILED_PAYMENT: "border-s-[var(--color-danger)] bg-[var(--color-danger-soft)]",
};

interface Props {
  view: CalendarView;
  from: string;
  to: string;
  entries: CalendarEntry[];
  blocks: CalendarBlock[];
  /** Business opening window, so the day does not start at midnight. */
  dayStartMin: number;
  dayEndMin: number;
  onSelect: (entry: CalendarEntry) => void;
}

export default function CalendarGrid(props: Props) {
  if (props.view === "month") return <MonthGrid {...props} />;
  return <TimeGrid {...props} />;
}

/* ─── Day and week ───────────────────────────────────────── */

/**
 * A time axis with one column per day.
 *
 * Day and week are the same grid with a different number of columns —
 * splitting them into two components would mean maintaining the same
 * overlap arithmetic twice.
 */
function TimeGrid({
  from,
  to,
  entries,
  blocks,
  dayStartMin,
  dayEndMin,
  onSelect,
}: Props) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const days = useMemo(() => datesBetween(from, to), [from, to]);

  // Stretch the window to hold anything booked outside opening hours —
  // an owner who squeezed someone in at 08:00 must still see them.
  const earliest = Math.min(dayStartMin, ...entries.map((e) => e.startMin));
  const latest = Math.max(dayEndMin, ...entries.map((e) => e.endMin));
  const startMin = Math.floor(Math.min(earliest, dayStartMin) / 60) * 60;
  const endMin = Math.ceil(Math.max(latest, dayEndMin) / 60) * 60;
  const totalMin = Math.max(60, endMin - startMin);

  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-full"
        style={{ gridTemplateColumns: `4rem repeat(${days.length}, minmax(9rem, 1fr))` }}
      >
        {/* Day headers */}
        <div className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-surface)]" />
        {days.map((d) => {
          const dow = new Date(d + "T00:00:00Z").getUTCDay();
          const count = entries.filter((e) => e.date === d).length;
          return (
            <div
              key={d}
              className={cn(
                "sticky top-0 z-10 border-b border-s border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-center",
                d === today && "bg-[var(--color-jade-tint)]",
              )}
            >
              <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">
                {isAr ? AR_DAYS[dow] : EN_DAYS[dow]}
              </p>
              <p
                className={cn(
                  "num m-0 mt-0.5 text-[1.0625rem] font-bold",
                  d === today ? "text-[var(--color-jade)]" : "text-[var(--color-ink)]",
                )}
              >
                {Number(d.slice(-2))}
              </p>
              {count > 0 && (
                <p className="num m-0 mt-0.5 text-[0.625rem] text-[var(--color-subtle)]">
                  {count}
                </p>
              )}
            </div>
          );
        })}

        {/* Hour rail */}
        <div className="relative" style={{ height: totalMin * PX_PER_MIN }}>
          {hours.map((m) => (
            <div
              key={m}
              className="num absolute -translate-y-1/2 pe-2 text-end text-[0.6875rem] text-[var(--color-subtle)]"
              style={{ top: (m - startMin) * PX_PER_MIN, insetInlineEnd: 0, width: "100%" }}
            >
              {minutesToTime(m % (24 * 60))}
            </div>
          ))}
        </div>

        {/* One column per day */}
        {days.map((d) => {
          const dayEntries = entries.filter((e) => e.date === d);
          const laid = layoutDay(dayEntries);
          const dayBlocks = blocks.filter((b) => b.dates.includes(d));

          return (
            <div
              key={d}
              className="relative border-s border-[var(--color-line)]"
              style={{ height: totalMin * PX_PER_MIN }}
            >
              {/* Hour lines */}
              {hours.map((m) => (
                <div
                  key={m}
                  aria-hidden="true"
                  className="absolute inset-x-0 border-t border-[var(--color-line)]"
                  style={{ top: (m - startMin) * PX_PER_MIN }}
                />
              ))}

              {/* Closed time, drawn behind the appointments */}
              {dayBlocks.map((b) => {
                const bStart = b.startMin ?? startMin;
                const bEnd = b.endMin ?? endMin;
                return (
                  <div
                    key={`${b.id}-${d}`}
                    title={b.reason ?? b.kind}
                    className="absolute inset-x-0 bg-[var(--color-surface-3)]/70"
                    style={{
                      top: (Math.max(bStart, startMin) - startMin) * PX_PER_MIN,
                      height: Math.max(0, Math.min(bEnd, endMin) - Math.max(bStart, startMin)) * PX_PER_MIN,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent, transparent 6px, rgb(17 32 28 / 0.045) 6px, rgb(17 32 28 / 0.045) 12px)",
                    }}
                  />
                );
              })}

              {/* Appointments */}
              {laid.map(({ entry, column, columns }) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry)}
                  title={`${entry.customerName} — ${entry.serviceName}`}
                  className={cn(
                    "absolute overflow-hidden rounded-[var(--radius-sm)] border-s-[3px] px-2 py-1 text-start transition-shadow hover:shadow-[var(--shadow-raised)]",
                    STATUS_TONE[entry.status] ?? STATUS_TONE.PENDING,
                  )}
                  style={{
                    top: (entry.startMin - startMin) * PX_PER_MIN,
                    height: Math.max(18, entry.durationMinutes * PX_PER_MIN - 2),
                    insetInlineStart: `calc(${(column / columns) * 100}% + 2px)`,
                    width: `calc(${100 / columns}% - 4px)`,
                  }}
                >
                  <span className="num block truncate text-[0.625rem] text-[var(--color-muted)]">
                    {entry.startTime}
                  </span>
                  <span className="block truncate text-[0.6875rem] font-bold text-[var(--color-ink)]">
                    {entry.customerName}
                  </span>
                  {entry.durationMinutes >= 45 && (
                    <span className="block truncate text-[0.625rem] text-[var(--color-subtle)]">
                      {entry.serviceName}
                      {entry.staffName ? ` · ${entry.staffName}` : ""}
                      {entry.resourceName ? ` · ${entry.resourceName}` : ""}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Month ──────────────────────────────────────────────── */

/**
 * Six weeks of cells, each listing its appointments.
 *
 * A month cannot show a time axis without becoming unreadable, so it
 * shows what is in each day and how much, and defers the detail to the
 * day view.
 */
function MonthGrid({ from, to, entries, blocks, onSelect }: Props) {
  const { t, lang } = useLanguage();
  const isAr = lang === "ar";
  const days = useMemo(() => datesBetween(from, to), [from, to]);
  const today = new Date().toISOString().slice(0, 10);

  // The anchor month is whichever one most of the grid belongs to.
  const monthOf = (d: string) => d.slice(0, 7);
  const counts = new Map<string, number>();
  for (const d of days) counts.set(monthOf(d), (counts.get(monthOf(d)) ?? 0) + 1);
  const mainMonth = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const header = isAr ? AR_DAYS : EN_DAYS;
  // Saturday first, matching the week the range was built for.
  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7">
        {order.map((dow) => (
          <div
            key={dow}
            className="border-b border-s border-[var(--color-line)] bg-[var(--color-surface-2)] px-2 py-2 text-center text-[0.6875rem] font-bold text-[var(--color-subtle)] first:border-s-0"
          >
            {header[dow]}
          </div>
        ))}

        {days.map((d) => {
          const dayEntries = entries.filter((e) => e.date === d);
          const outside = monthOf(d) !== mainMonth;
          const blocked = blocks.some((b) => b.dates.includes(d) && b.startMin === null);

          return (
            <div
              key={d}
              className={cn(
                "min-h-[6.5rem] border-b border-s border-[var(--color-line)] p-1.5 [&:nth-child(7n+1)]:border-s-0",
                outside && "bg-[var(--color-surface-2)]/60",
                blocked && "bg-[var(--color-surface-3)]/50",
              )}
            >
              <p
                className={cn(
                  "num m-0 mb-1 text-[0.75rem]",
                  d === today
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-jade)] font-bold text-[var(--color-inverse)]"
                    : outside
                      ? "text-[var(--color-faint)]"
                      : "text-[var(--color-muted)]",
                )}
              >
                {Number(d.slice(-2))}
              </p>

              <ul className="m-0 list-none space-y-1 p-0">
                {dayEntries.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(e)}
                      className={cn(
                        "flex w-full items-center gap-1 overflow-hidden rounded-[var(--radius-xs)] border-s-2 px-1.5 py-0.5 text-start",
                        STATUS_TONE[e.status] ?? STATUS_TONE.PENDING,
                      )}
                    >
                      <span className="num shrink-0 text-[0.5625rem] text-[var(--color-muted)]">
                        {e.startTime}
                      </span>
                      <span className="truncate text-[0.625rem] font-bold text-[var(--color-ink)]">
                        {e.customerName}
                      </span>
                    </button>
                  </li>
                ))}

                {dayEntries.length > 3 && (
                  <li className="num px-1.5 text-[0.5625rem] text-[var(--color-subtle)]">
                    +{dayEntries.length - 3} {t.calendar.more}
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
