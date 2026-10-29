"use client";

import Link from "@/components/shared/LocaleLink";
import { CalendarClock, Phone, Sun } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { money, num, clock } from "@/lib/fmt";
import { telHref } from "@/lib/contact";

export interface ListedBooking {
  id: string;
  reference: string | null;
  status: string;
  at: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  serviceName: string;
  staffName: string | null;
  resourceName: string | null;
  branchName: string | null;
  partySize: number | null;
  price: number;
  currency: string;
  notes: string | null;
}

/**
 * A day's or a week's appointments, in the order they happen.
 *
 * Shared by Today and Upcoming because the two differ only in what was
 * asked for, not in how an appointment reads.
 */
export default function BookingList({
  bookings,
  variant,
}: {
  bookings: ListedBooking[];
  variant: "today" | "upcoming";
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  if (bookings.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={
            variant === "today" ? (
              <Sun size={24} strokeWidth={1.7} />
            ) : (
              <CalendarClock size={24} strokeWidth={1.7} />
            )
          }
          title={
            variant === "today"
              ? ar
                ? "مفيش مواعيد النهارده"
                : "Nothing booked today"
              : ar
                ? "مفيش مواعيد جاية"
                : "Nothing coming up"
          }
          body={
            variant === "today"
              ? ar
                ? "يوم هادي. أول ما حد يحجز لليوم هيبان هنا."
                : "A quiet day. Anyone who books for today will appear here."
              : ar
                ? "أول ما حد يحجز، هتلاقيه هنا مرتّب بالوقت."
                : "New bookings appear here, in the order they happen."
          }
        />
      </div>
    );
  }

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));

  // Upcoming is read day by day; today needs no headings.
  const groups: { key: string; items: ListedBooking[] }[] = [];
  for (const b of bookings) {
    const key = variant === "today" ? "" : b.date;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(b);
    else groups.push({ key, items: [b] });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key || "today"}>
          {group.key && (
            <h2 className="m-0 mb-2 text-[0.8125rem] font-bold text-[var(--color-muted)]">
              {dayLabel(group.key)}
            </h2>
          )}

          <ul className="m-0 list-none space-y-2 p-0">
            {group.items.map((b) => (
              <li key={b.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                  <span className="num shrink-0 text-[1.0625rem] font-bold text-[var(--color-ink)]">
                    {clock(b.startTime)}
                    {b.endTime && (
                      <span className="block text-[0.6875rem] font-normal text-[var(--color-subtle)]">
                        {ar ? "لـ" : "to"} {clock(b.endTime)}
                      </span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
                      {b.customerId ? (
                        <Link
                          href={`/dashboard/customers/${b.customerId}`}
                          className="hover:text-[var(--color-jade)] hover:underline"
                        >
                          {b.customerName}
                        </Link>
                      ) : (
                        b.customerName
                      )}
                    </p>
                    <p className="m-0 mt-0.5 text-[0.8125rem] text-[var(--color-subtle)]">
                      {b.serviceName}
                      {b.staffName ? ` · ${b.staffName}` : ""}
                      {b.resourceName ? ` · ${b.resourceName}` : ""}
                      {b.branchName ? ` · ${b.branchName}` : ""}
                      {b.partySize ? ` · ${num(b.partySize, lang)}` : ""}
                    </p>
                    {b.notes && (
                      <p className="m-0 mt-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-[0.75rem] leading-relaxed text-[var(--color-muted)]">
                        {b.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusBadge status={b.status} />
                    <span className="num text-[0.8125rem] font-bold text-[var(--color-ink)]">
                      {money(b.price, lang, b.currency)}
                    </span>
                    <a
                      href={telHref(b.customerPhone)}
                      className="inline-flex min-h-9 items-center gap-1 text-[0.75rem] text-[var(--color-jade)]"
                      dir="ltr"
                    >
                      <Phone size={12} aria-hidden="true" />
                      {b.customerPhone}
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
