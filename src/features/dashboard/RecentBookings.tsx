"use client";

import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "PENDING_PAYMENT" | "FAILED_PAYMENT";

export type RecentBooking = {
  id:            string;
  customerName:  string;
  customerPhone: string;
  serviceName:   string;
  date:          Date;
  startTime:     string;
  status:        BookingStatus;
  totalPrice:    number;
  currency:      string;
};

interface RecentBookingsProps {
  bookings: RecentBooking[];
}

const STATUS_ICON: Record<BookingStatus, typeof CheckCircle> = {
  CONFIRMED:       CheckCircle,
  PENDING:         Clock,
  COMPLETED:       CheckCircle,
  CANCELLED:       XCircle,
  NO_SHOW:         AlertCircle,
  PENDING_PAYMENT: Clock,
  FAILED_PAYMENT:  XCircle,
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  CONFIRMED:       "bg-green-50 text-green-600",
  PENDING:         "bg-amber-50 text-amber-600",
  COMPLETED:       "bg-blue-50 text-blue-600",
  CANCELLED:       "bg-red-50 text-red-500",
  NO_SHOW:         "bg-gray-100 text-gray-500",
  PENDING_PAYMENT: "bg-orange-50 text-orange-600",
  FAILED_PAYMENT:  "bg-red-100 text-red-700",
};

const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function RecentBookings({ bookings }: RecentBookingsProps) {
  const { t, lang } = useLanguage();
  const rb      = t.dashboard.recentBookings;
  const bs      = t.dashboard.bookingStatus;
  const months  = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  const locale  = lang === "ar" ? "ar-EG" : "en-US";

  function formatBookingDate(date: Date, startTime: string): string {
    const d = new Date(date);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}، ${startTime}`;
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text-primary)]">
          {rb.title}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{bookings.length} {rb.count}</span>
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {rb.empty}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {[rb.columns.customer, rb.columns.service, rb.columns.date, rb.columns.price, rb.columns.status].map((h) => (
                  <th
                    key={h}
                    className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const StatusIcon  = STATUS_ICON[booking.status];
                const statusClass = STATUS_CLASS[booking.status];
                const statusLabel = (bs as Record<string, string>)[booking.status] ?? booking.status;
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {booking.customerName}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                        {booking.customerPhone}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--color-text-secondary)]">{booking.serviceName}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {formatBookingDate(booking.date, booking.startTime)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {booking.totalPrice.toLocaleString(locale)} {booking.currency}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                          statusClass,
                        )}
                      >
                        <StatusIcon size={11} />
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
