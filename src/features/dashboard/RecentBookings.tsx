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
  CONFIRMED: { label: "مؤكد",         icon: CheckCircle, className: "bg-green-50 text-green-600" },
  PENDING:   { label: "في الانتظار",  icon: Clock,        className: "bg-amber-50 text-amber-600" },
  COMPLETED: { label: "مكتمل",        icon: CheckCircle, className: "bg-blue-50 text-blue-600"  },
  CANCELLED: { label: "ملغي",         icon: XCircle,     className: "bg-red-50 text-red-500"    },
  NO_SHOW:   { label: "لم يحضر",      icon: AlertCircle, className: "bg-gray-100 text-gray-500" },
};

const AR_MONTHS = [
  "يناير", "فبراير", "مارس",
  "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر",
  "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatBookingDate(date: Date, startTime: string): string {
  const d = new Date(date);
  return `${d.getUTCDate()} ${AR_MONTHS[d.getUTCMonth()]}، ${startTime}`;
}

export default function RecentBookings({ bookings }: RecentBookingsProps) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text-primary)]">
          آخر الحجوزات
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{bookings.length} حجز</span>
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            لا توجد حجوزات بعد — ستظهر هنا بعد أول حجز
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {["العميل", "الخدمة", "الموعد", "السعر", "الحالة"].map((h) => (
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
