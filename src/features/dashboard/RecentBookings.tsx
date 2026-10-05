"use client";

import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Avatar from "@/components/ui/Avatar";
import StatusBadge, { type BookingStatusKey } from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { money, clock, num } from "@/lib/fmt";

export type RecentBooking = {
  id:            string;
  customerName:  string;
  customerPhone: string;
  serviceName:   string;
  date:          Date;
  startTime:     string;
  status:        BookingStatusKey;
  totalPrice:    number;
  currency:      string;
};

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function RecentBookings({ bookings }: { bookings: RecentBooking[] }) {
  const { t, lang } = useLanguage();
  const rb = t.dashboard.recentBookings;
  const months = lang === "ar" ? AR_MONTHS : EN_MONTHS;

  /** Dates come back as UTC midnight, so read the UTC parts. */
  function fmtDate(date: Date) {
    const d = new Date(date);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  }


  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]">

      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <h2 className="m-0 flex items-center gap-2.5 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          {rb.title}
          {bookings.length > 0 && (
            <span className="num rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[0.71875rem] font-bold text-[var(--color-muted)]">
              {num(bookings.length, lang)}
            </span>
          )}
        </h2>
        <Link
          href="/dashboard/bookings"
          className="flex shrink-0 items-center gap-1 text-[0.75rem] font-bold text-[var(--color-jade)]"
        >
          {lang === "ar" ? "عرض الكل" : "View all"}
          <ArrowLeft size={12} aria-hidden="true" />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarRange size={24} strokeWidth={1.7} />}
          title={rb.empty}
          body={
            lang === "ar"
              ? "أول حجز هيظهر هنا بمجرد ما عميل يحجز من صفحتك."
              : "The first booking will appear here as soon as someone books."
          }
        />
      ) : (
        <Table minWidth="36rem">
          <THead>
            <TR>
              <TH>{rb.columns.customer}</TH>
              <TH>{rb.columns.service}</TH>
              <TH>{rb.columns.date}</TH>
              <TH>{rb.columns.price}</TH>
              <TH>{rb.columns.status}</TH>
            </TR>
          </THead>
          <TBody>
            {bookings.map((b) => (
              <TR key={b.id}>
                <TD>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={b.customerName} size="sm" />
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.875rem] font-bold text-[var(--color-ink)]">
                        {b.customerName}
                      </p>
                      <p className="num m-0 mt-0.5 text-xs text-[var(--color-subtle)]">
                        {b.customerPhone}
                      </p>
                    </div>
                  </div>
                </TD>

                <TD>
                  <p className="m-0 max-w-[10rem] truncate text-[0.875rem] text-[var(--color-muted)]">
                    {b.serviceName}
                  </p>
                </TD>

                <TD>
                  <p className="m-0 whitespace-nowrap text-[0.875rem] text-[var(--color-muted)]">
                    {fmtDate(b.date)} · <span className="num">{clock(b.startTime)}</span>
                  </p>
                </TD>

                <TD>
                  <p className="num m-0 whitespace-nowrap text-[0.875rem] font-bold text-[var(--color-ink)]">
                    {money(b.totalPrice, lang, b.currency)}
                  </p>
                </TD>

                <TD>
                  <StatusBadge status={b.status} lang={lang} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
