import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BookingStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

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

const statusConfig: Record<BookingStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  CONFIRMED: { label: "\u0645\u0624\u0643\u062f",         icon: CheckCircle, className: "bg-green-50 text-green-600" },
  PENDING:   { label: "\u0641\u064a \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631", icon: Clock,        className: "bg-amber-50 text-amber-600" },
  COMPLETED: { label: "\u0645\u0643\u062a\u0645\u0644",         icon: CheckCircle, className: "bg-blue-50 text-blue-600"  },
  CANCELLED: { label: "\u0645\u0644\u063a\u064a",          icon: XCircle,     className: "bg-red-50 text-red-500"    },
  NO_SHOW:   { label: "\u0644\u0645 \u064a\u062d\u0636\u0631",    icon: AlertCircle, className: "bg-gray-100 text-gray-500" },
};

const AR_MONTHS = [
  "\u064a\u0646\u0627\u064a\u0631","\u0641\u0628\u0631\u0627\u064a\u0631","\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064a\u0644","\u0645\u0627\u064a\u0648","\u064a\u0648\u0646\u064a\u0648",
  "\u064a\u0648\u0644\u064a\u0648","\u0623\u063a\u0633\u0637\u0633","\u0633\u0628\u062a\u0645\u0628\u0631",
  "\u0623\u0643\u062a\u0648\u0628\u0631","\u0646\u0648\u0641\u0645\u0628\u0631","\u062f\u064a\u0633\u0645\u0628\u0631",
];

function formatBookingDate(date: Date, startTime: string): string {
  const d = new Date(date);
  return `${d.getUTCDate()} ${AR_MONTHS[d.getUTCMonth()]}\u060c ${startTime}`;
}

export default function RecentBookings({ bookings }: RecentBookingsProps) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text-primary)]">
          \u0622\u062e\u0631 \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{bookings.length} \u062d\u062c\u0632</span>
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            \u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a \u0628\u0639\u062f \u2014 \u0633\u062a\u0638\u0647\u0631 \u0647\u0646\u0627 \u0628\u0639\u062f \u0623\u0648\u0644 \u062d\u062c\u0632
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {["\u0627\u0644\u0639\u0645\u064a\u0644", "\u0627\u0644\u062e\u062f\u0645\u0629", "\u0627\u0644\u0645\u0648\u0639\u062f", "\u0627\u0644\u0633\u0639\u0631", "\u0627\u0644\u062d\u0627\u0644\u0629"].map((h) => (
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
                const status    = statusConfig[booking.status];
                const StatusIcon = status.icon;
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
                        {booking.totalPrice.toLocaleString("ar-EG")} {booking.currency}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                          status.className,
                        )}
                      >
                        <StatusIcon size={11} />
                        {status.label}
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
